import type { PublicDanmaku } from '@/lib/community/danmaku';
import type { PlaybackCursorEvent, PlaybackCursorSnapshot } from './types';
import type { DanmakuGateResult } from './danmaku-gate';
import { getDanmakuDuration } from './danmaku-motion';

export interface DanmakuDueEvent {
  danmaku: PublicDanmaku;
  courseId: string;
  sceneKey: string;
  actionId: string;
  lane: number;
}

export interface DanmakuHistoryPage {
  items: PublicDanmaku[];
  nextCursor: string | null;
}

export interface DanmakuSchedulerContext {
  courseId: string | null;
  sceneKey: string | null;
  gate: DanmakuGateResult;
}

export interface DanmakuSchedulerOptions {
  onDue: (event: DanmakuDueEvent) => void;
  loadPage?: (input: {
    courseId: string;
    sceneKey: string;
    cursor: string | null;
    limit: number;
    signal: AbortSignal;
  }) => Promise<DanmakuHistoryPage>;
  laneCount?: number;
  pageSize?: number;
  maxPages?: number;
  maxPerAction?: number;
  maxPerSecond?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 3;
const DEFAULT_LANES = 8;
const DEFAULT_MAX_PER_ACTION = 60;
const DEFAULT_MAX_PER_SECOND = 4;

async function loadDanmakuPage(input: {
  courseId: string;
  sceneKey: string;
  cursor: string | null;
  limit: number;
  signal: AbortSignal;
}): Promise<DanmakuHistoryPage> {
  const search = new URLSearchParams({ sceneKey: input.sceneKey, limit: String(input.limit) });
  if (input.cursor) search.set('cursor', input.cursor);
  const response = await fetch(
    `/api/courses/${encodeURIComponent(input.courseId)}/danmaku?${search.toString()}`,
    { signal: input.signal },
  );
  if (!response.ok) throw new Error(`Could not load danmaku history (${response.status})`);
  const body = (await response.json()) as {
    success?: boolean;
    danmaku?: PublicDanmaku[];
    nextCursor?: string | null;
  };
  if (!body.success || !Array.isArray(body.danmaku)) {
    throw new Error('Invalid danmaku history response');
  }
  return { items: body.danmaku, nextCursor: body.nextCursor ?? null };
}

export class DanmakuPlaybackScheduler {
  private readonly onDue: DanmakuSchedulerOptions['onDue'];
  private readonly loadPage: NonNullable<DanmakuSchedulerOptions['loadPage']>;
  private readonly laneCount: number;
  private readonly pageSize: number;
  private readonly maxPages: number;
  private readonly maxPerAction: number;
  private readonly maxPerSecond: number;
  private readonly now: () => number;
  private readonly setTimer: NonNullable<DanmakuSchedulerOptions['setTimer']>;
  private readonly clearTimer: NonNullable<DanmakuSchedulerOptions['clearTimer']>;
  private context: DanmakuSchedulerContext = {
    courseId: null,
    sceneKey: null,
    gate: { enabled: false, reason: 'local-course' },
  };
  private cursor: PlaybackCursorSnapshot | null = null;
  private sceneItems: PublicDanmaku[] = [];
  private sceneLoaded = false;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private emittedIds = new Set<string>();
  private loadAbort: AbortController | null = null;
  private loadGeneration = 0;

  constructor(options: DanmakuSchedulerOptions) {
    this.onDue = options.onDue;
    this.loadPage = options.loadPage ?? loadDanmakuPage;
    this.laneCount = Math.max(1, options.laneCount ?? DEFAULT_LANES);
    this.pageSize = Math.min(100, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));
    this.maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
    this.maxPerAction = Math.max(1, options.maxPerAction ?? DEFAULT_MAX_PER_ACTION);
    this.maxPerSecond = Math.max(1, options.maxPerSecond ?? DEFAULT_MAX_PER_SECOND);
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  setContext(context: DanmakuSchedulerContext): void {
    const sceneChanged =
      this.context.courseId !== context.courseId || this.context.sceneKey !== context.sceneKey;
    this.context = context;
    if (sceneChanged) {
      this.resetScene();
      if (this.cursor?.sceneKey === context.sceneKey) void this.loadCurrentScene();
      return;
    }
    if (!context.gate.enabled) {
      this.clearTimers();
      return;
    }
    if (!this.sceneLoaded && this.cursor?.sceneKey === context.sceneKey) {
      void this.loadCurrentScene();
      return;
    }
    this.scheduleCurrentAction();
  }

  handleCursor(event: PlaybackCursorEvent): void {
    this.cursor = event.cursor;
    if (event.reason === 'scene-change') {
      this.resetScene();
      void this.loadCurrentScene();
      return;
    }
    if (event.reason === 'action-start') {
      this.clearTimers();
      this.emittedIds.clear();
      this.scheduleCurrentAction();
      return;
    }
    if (
      event.reason === 'pause' ||
      event.reason === 'discussion-start' ||
      event.reason === 'discussion-end' ||
      event.reason === 'complete' ||
      event.reason === 'stop'
    ) {
      this.clearTimers();
      return;
    }
    if (event.reason === 'resume' || event.reason === 'rate-change' || event.reason === 'play') {
      this.clearTimers();
      this.scheduleCurrentAction();
    }
  }

  dispose(): void {
    this.resetScene();
    this.cursor = null;
  }

  private async loadCurrentScene(): Promise<void> {
    const { courseId, sceneKey, gate } = this.context;
    if (!gate.enabled || !courseId || !sceneKey || this.cursor?.sceneKey !== sceneKey) return;
    if (this.loadAbort && !this.loadAbort.signal.aborted) return;
    this.loadAbort?.abort();
    const abort = new AbortController();
    this.loadAbort = abort;
    const generation = ++this.loadGeneration;
    const items: PublicDanmaku[] = [];
    let nextCursor: string | null = null;
    try {
      for (let page = 0; page < this.maxPages; page++) {
        const result = await this.loadPage({
          courseId,
          sceneKey,
          cursor: nextCursor,
          limit: this.pageSize,
          signal: abort.signal,
        });
        items.push(...result.items);
        if (!result.nextCursor || result.nextCursor === nextCursor) break;
        nextCursor = result.nextCursor;
      }
      if (abort.signal.aborted || generation !== this.loadGeneration) return;
      this.sceneItems = items;
      this.sceneLoaded = true;
      this.loadAbort = null;
      this.scheduleCurrentAction();
    } catch (error) {
      if (!abort.signal.aborted) {
        // Loading failure must not affect course playback. A later scene entry can retry.
        console.warn('Could not load danmaku history', error);
      }
      if (this.loadAbort === abort) this.loadAbort = null;
    }
  }

  private scheduleCurrentAction(): void {
    const cursor = this.cursor;
    const { courseId, sceneKey, gate } = this.context;
    if (
      !gate.enabled ||
      !courseId ||
      !sceneKey ||
      !cursor ||
      cursor.phase !== 'playing' ||
      cursor.courseId !== courseId ||
      cursor.sceneKey !== sceneKey ||
      !cursor.actionId
    ) {
      return;
    }
    const currentOffset = this.currentOffset(cursor);
    const candidates = this.applyDensityLimit(
      this.sceneItems
        .filter(
          (item) =>
            item.actionId === cursor.actionId &&
            item.actionOffsetMs >= currentOffset - 100 &&
            !this.emittedIds.has(item.id),
        )
        .sort((left, right) =>
          left.actionOffsetMs === right.actionOffsetMs
            ? left.id.localeCompare(right.id)
            : left.actionOffsetMs - right.actionOffsetMs,
        ),
    );
    const lanes = this.assignLanes(candidates);
    for (const { item, lane } of lanes) {
      if (this.timers.has(item.id)) continue;
      const delay = Math.max(0, (item.actionOffsetMs - currentOffset) / cursor.playbackRate);
      const timer = this.setTimer(() => {
        this.timers.delete(item.id);
        const active = this.cursor;
        if (
          !this.context.gate.enabled ||
          !active ||
          active.phase !== 'playing' ||
          active.courseId !== courseId ||
          active.sceneKey !== sceneKey ||
          active.actionId !== item.actionId ||
          this.emittedIds.has(item.id)
        ) {
          return;
        }
        this.emittedIds.add(item.id);
        this.onDue({ danmaku: item, courseId, sceneKey, actionId: item.actionId, lane });
      }, delay);
      this.timers.set(item.id, timer);
    }
  }

  private currentOffset(cursor: PlaybackCursorSnapshot): number {
    if (cursor.phase !== 'playing') return cursor.actionOffsetMs;
    return cursor.actionOffsetMs + (this.now() - cursor.emittedAt) * cursor.playbackRate;
  }

  private applyDensityLimit(items: PublicDanmaku[]): PublicDanmaku[] {
    const bucketCounts = new Map<number, number>();
    const accepted: PublicDanmaku[] = [];
    for (const item of items) {
      const bucket = Math.floor(item.actionOffsetMs / 1_000);
      const count = bucketCounts.get(bucket) ?? 0;
      if (count >= this.maxPerSecond) continue;
      bucketCounts.set(bucket, count + 1);
      accepted.push(item);
      if (accepted.length >= this.maxPerAction) break;
    }
    return accepted;
  }

  private assignLanes(items: PublicDanmaku[]): Array<{ item: PublicDanmaku; lane: number }> {
    const availableAt = Array.from({ length: this.laneCount }, () => 0);
    return items.map((item) => {
      let lane = availableAt.findIndex((offset) => offset <= item.actionOffsetMs);
      if (lane < 0) {
        lane = availableAt.reduce(
          (best, offset, index) => (offset < availableAt[best] ? index : best),
          0,
        );
      }
      const readableDuration = getDanmakuDuration(item.content);
      availableAt[lane] = item.actionOffsetMs + readableDuration;
      return { item, lane };
    });
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) this.clearTimer(timer);
    this.timers.clear();
  }

  private resetScene(): void {
    this.clearTimers();
    this.loadAbort?.abort();
    this.loadAbort = null;
    this.loadGeneration++;
    this.sceneItems = [];
    this.sceneLoaded = false;
    this.emittedIds.clear();
  }
}

export class DanmakuScheduleChannel {
  private readonly listeners = new Set<(event: DanmakuDueEvent) => void>();

  publish = (event: DanmakuDueEvent): void => {
    for (const listener of this.listeners) listener(event);
  };

  subscribe(listener: (event: DanmakuDueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const danmakuScheduleChannel = new DanmakuScheduleChannel();
