import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  DanmakuPlaybackScheduler,
  type DanmakuHistoryPage,
  type PlaybackCursorEvent,
} from '@/lib/playback';
import type { PublicDanmaku } from '@/lib/community/danmaku';

function item(id: string, actionOffsetMs: number, actionId = 'action-1'): PublicDanmaku {
  return {
    id,
    sceneKey: 'scene-1',
    actionId,
    actionOffsetMs,
    content: `message-${id}`,
    inputSource: 'text',
    createdAt: '2026-07-15T00:00:00.000Z',
  };
}

function cursor(
  reason: PlaybackCursorEvent['reason'],
  patch: Partial<PlaybackCursorEvent['cursor']> = {},
): PlaybackCursorEvent {
  return {
    reason,
    cursor: {
      courseId: 'course-1',
      sceneKey: 'scene-1',
      sceneIndex: 0,
      actionId: reason === 'scene-change' ? null : 'action-1',
      actionIndex: 0,
      actionOffsetMs: 0,
      phase: 'playing',
      playbackRate: 1,
      emittedAt: Date.now(),
      ...patch,
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

describe('PLAY-02 danmaku scheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('loads bounded cursor pages and emits only the current action at its relative time', async () => {
    const onDue = vi.fn();
    const loadPage = vi.fn(
      async ({ cursor: pageCursor }): Promise<DanmakuHistoryPage> =>
        pageCursor
          ? {
              items: [item('later', 1_000), item('other-action', 200, 'action-2')],
              nextCursor: null,
            }
          : { items: [item('first', 500)], nextCursor: 'page-2' },
    );
    const scheduler = new DanmakuPlaybackScheduler({ onDue, loadPage, maxPages: 2 });
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: true, reason: 'enabled' },
    });
    scheduler.handleCursor(cursor('scene-change'));
    scheduler.handleCursor(cursor('action-start'));
    await flushAsyncWork();
    expect(loadPage).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(499);
    expect(onDue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onDue).toHaveBeenCalledWith(expect.objectContaining({ danmaku: item('first', 500) }));
    await vi.advanceTimersByTimeAsync(500);
    expect(onDue).toHaveBeenCalledTimes(2);
    expect(onDue).not.toHaveBeenCalledWith(
      expect.objectContaining({ danmaku: expect.objectContaining({ id: 'other-action' }) }),
    );
  });

  test('cancels on pause and reschedules from the frozen offset on resume and rate change', async () => {
    const onDue = vi.fn();
    const scheduler = new DanmakuPlaybackScheduler({
      onDue,
      loadPage: async () => ({ items: [item('one', 1_000)], nextCursor: null }),
    });
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: true, reason: 'enabled' },
    });
    scheduler.handleCursor(cursor('scene-change'));
    scheduler.handleCursor(cursor('action-start'));
    await flushAsyncWork();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(400);
    scheduler.handleCursor(
      cursor('pause', { phase: 'paused', actionOffsetMs: 400, emittedAt: Date.now() }),
    );
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onDue).not.toHaveBeenCalled();

    scheduler.handleCursor(
      cursor('resume', {
        phase: 'playing',
        actionOffsetMs: 400,
        playbackRate: 2,
        emittedAt: Date.now(),
      }),
    );
    await vi.advanceTimersByTimeAsync(299);
    expect(onDue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onDue).toHaveBeenCalledOnce();
  });

  test('clears scene state on switch and ignores aborted stale loads', async () => {
    const onDue = vi.fn();
    let resolveFirst: ((page: DanmakuHistoryPage) => void) | undefined;
    const loadPage = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<DanmakuHistoryPage>((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValue({ items: [], nextCursor: null });
    const scheduler = new DanmakuPlaybackScheduler({ onDue, loadPage });
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: true, reason: 'enabled' },
    });
    scheduler.handleCursor(cursor('scene-change'));
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-2',
      gate: { enabled: true, reason: 'enabled' },
    });
    scheduler.handleCursor(
      cursor('scene-change', { sceneKey: 'scene-2', actionId: null, emittedAt: Date.now() }),
    );
    resolveFirst?.({ items: [item('stale', 0)], nextCursor: null });
    await vi.runAllTicks();
    scheduler.handleCursor(
      cursor('action-start', { sceneKey: 'scene-2', actionId: 'action-1', emittedAt: Date.now() }),
    );
    await vi.runAllTimersAsync();
    expect(onDue).not.toHaveBeenCalled();
  });

  test('limits dense history and assigns configured lanes', async () => {
    const onDue = vi.fn();
    const dense = Array.from({ length: 10 }, (_, index) => item(String(index), 100));
    const scheduler = new DanmakuPlaybackScheduler({
      onDue,
      loadPage: async () => ({ items: dense, nextCursor: null }),
      laneCount: 2,
      maxPerSecond: 3,
      maxPerAction: 3,
    });
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: true, reason: 'enabled' },
    });
    scheduler.handleCursor(cursor('scene-change'));
    scheduler.handleCursor(cursor('action-start'));
    await flushAsyncWork();
    expect(vi.getTimerCount()).toBe(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(onDue).toHaveBeenCalledTimes(3);
    expect(new Set(onDue.mock.calls.map(([event]) => event.lane))).toEqual(new Set([0, 1]));
  });

  test('loads and resumes the current scene when a whiteboard gate is reopened', async () => {
    const onDue = vi.fn();
    const loadPage = vi.fn(async () => ({ items: [item('after-gate', 200)], nextCursor: null }));
    const scheduler = new DanmakuPlaybackScheduler({ onDue, loadPage });
    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: false, reason: 'whiteboard-open' },
    });
    scheduler.handleCursor(cursor('scene-change'));
    scheduler.handleCursor(cursor('action-start'));
    await flushAsyncWork();
    expect(loadPage).not.toHaveBeenCalled();

    scheduler.setContext({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      gate: { enabled: true, reason: 'enabled' },
    });
    await flushAsyncWork();
    expect(loadPage).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(200);
    expect(onDue).toHaveBeenCalledOnce();
  });
});
