import type {
  PlaybackCursorEvent,
  PlaybackCursorPhase,
  PlaybackCursorReason,
  PlaybackCursorSnapshot,
} from './types';

export class PlaybackCursorController {
  private sceneKey: string | null = null;
  private sceneIndex = 0;
  private actionId: string | null = null;
  private actionIndex = 0;
  private actionOffsetMs = 0;
  private activeSince: number | null = null;
  private phase: PlaybackCursorPhase = 'idle';
  private playbackRate: number;

  constructor(
    private readonly courseId: string | null,
    initialPlaybackRate: number,
    private readonly emit: ((event: PlaybackCursorEvent) => void) | undefined,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.playbackRate = this.validRate(initialPlaybackRate);
  }

  getSnapshot(): PlaybackCursorSnapshot {
    const emittedAt = this.now();
    return {
      courseId: this.courseId,
      sceneKey: this.sceneKey,
      sceneIndex: this.sceneIndex,
      actionId: this.actionId,
      actionIndex: this.actionIndex,
      actionOffsetMs: Math.max(0, Math.round(this.currentOffset(emittedAt))),
      phase: this.phase,
      playbackRate: this.playbackRate,
      emittedAt,
    };
  }

  play(): void {
    this.phase = 'playing';
    this.activeSince = this.now();
    this.publish('play');
  }

  pause(): void {
    this.settleOffset();
    this.phase = 'paused';
    this.publish('pause');
  }

  resume(): void {
    this.phase = 'playing';
    this.activeSince = this.now();
    this.publish('resume');
  }

  startAction(input: {
    sceneKey: string;
    sceneIndex: number;
    actionId: string;
    actionIndex: number;
  }): void {
    if (this.sceneKey !== input.sceneKey) {
      this.sceneKey = input.sceneKey;
      this.sceneIndex = input.sceneIndex;
      this.actionId = null;
      this.actionOffsetMs = 0;
      this.activeSince = this.phase === 'playing' ? this.now() : null;
      this.publish('scene-change');
    }
    this.actionId = input.actionId;
    this.actionIndex = input.actionIndex;
    this.actionOffsetMs = 0;
    this.activeSince = this.phase === 'playing' ? this.now() : null;
    this.publish('action-start');
  }

  discussionStart(): void {
    if (this.phase === 'discussion') return;
    this.settleOffset();
    this.phase = 'discussion';
    this.publish('discussion-start');
  }

  resumeDiscussion(): void {
    this.phase = 'discussion';
    this.activeSince = null;
    this.publish('resume');
  }

  discussionEnd(): void {
    this.phase = 'idle';
    this.activeSince = null;
    this.publish('discussion-end');
  }

  setPlaybackRate(rate: number): void {
    const nextRate = this.validRate(rate);
    if (nextRate === this.playbackRate) return;
    this.settleOffset();
    this.playbackRate = nextRate;
    if (this.phase === 'playing') this.activeSince = this.now();
    this.publish('rate-change');
  }

  complete(): void {
    this.settleOffset();
    this.phase = 'completed';
    this.publish('complete');
  }

  stop(): void {
    this.settleOffset();
    this.phase = 'idle';
    this.activeSince = null;
    this.publish('stop');
  }

  private currentOffset(at: number): number {
    return (
      this.actionOffsetMs +
      (this.phase === 'playing' && this.activeSince !== null
        ? (at - this.activeSince) * this.playbackRate
        : 0)
    );
  }

  private settleOffset(): void {
    const at = this.now();
    this.actionOffsetMs = this.currentOffset(at);
    this.activeSince = null;
  }

  private publish(reason: PlaybackCursorReason): void {
    this.emit?.({ reason, cursor: this.getSnapshot() });
  }

  private validRate(rate: number): number {
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }
}

/** Process-local channel used by the classroom shell and future playback consumers. */
export class PlaybackCursorChannel {
  private latest: PlaybackCursorEvent | null = null;
  private readonly listeners = new Set<(event: PlaybackCursorEvent) => void>();

  publish = (event: PlaybackCursorEvent): void => {
    this.latest = event;
    for (const listener of this.listeners) listener(event);
  };

  getLatest(): PlaybackCursorEvent | null {
    return this.latest;
  }

  subscribe(listener: (event: PlaybackCursorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const playbackCursorChannel = new PlaybackCursorChannel();
