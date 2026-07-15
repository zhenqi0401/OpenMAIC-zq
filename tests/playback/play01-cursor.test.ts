import { describe, expect, test, vi } from 'vitest';

import {
  PlaybackCursorChannel,
  PlaybackCursorController,
  PlaybackEngine,
  type PlaybackCursorEvent,
} from '@/lib/playback';
import type { ActionEngine } from '@/lib/action/engine';
import type { AudioPlayer } from '@/lib/utils/audio-player';
import type { Scene } from '@/lib/types/stage';

describe('PLAY-01 playback cursor controller', () => {
  test('publishes course, scene and action identity without advancing while paused', () => {
    let now = 1_000;
    const events: PlaybackCursorEvent[] = [];
    const cursor = new PlaybackCursorController(
      'course-1',
      1,
      (event) => events.push(event),
      () => now,
    );

    cursor.play();
    cursor.startAction({
      sceneKey: 'scene-2',
      sceneIndex: 1,
      actionId: 'action-3',
      actionIndex: 2,
    });
    now += 500;
    cursor.pause();
    const paused = cursor.getSnapshot();
    now += 5_000;

    expect(events.map((event) => event.reason)).toEqual([
      'play',
      'scene-change',
      'action-start',
      'pause',
    ]);
    expect(paused).toMatchObject({
      courseId: 'course-1',
      sceneKey: 'scene-2',
      sceneIndex: 1,
      actionId: 'action-3',
      actionIndex: 2,
      actionOffsetMs: 500,
      phase: 'paused',
    });
    expect(cursor.getSnapshot().actionOffsetMs).toBe(500);
  });

  test('accounts for resume and playback-rate changes in action-relative time', () => {
    let now = 0;
    const cursor = new PlaybackCursorController(null, 1, undefined, () => now);
    cursor.play();
    cursor.startAction({ sceneKey: 'local-scene', sceneIndex: 0, actionId: 'a1', actionIndex: 0 });
    now = 1_000;
    cursor.setPlaybackRate(2);
    now = 2_000;
    cursor.pause();
    now = 10_000;
    cursor.resume();
    now = 10_500;

    expect(cursor.getSnapshot()).toMatchObject({
      courseId: null,
      actionOffsetMs: 4_000,
      playbackRate: 2,
      phase: 'playing',
    });
  });

  test('freezes during discussion and exposes resume, discussion-end and completion', () => {
    let now = 0;
    const reasons: string[] = [];
    const cursor = new PlaybackCursorController(
      'course-1',
      1,
      (event) => reasons.push(event.reason),
      () => now,
    );
    cursor.play();
    cursor.startAction({ sceneKey: 's1', sceneIndex: 0, actionId: 'a1', actionIndex: 0 });
    now = 400;
    cursor.discussionStart();
    now = 4_000;
    expect(cursor.getSnapshot().actionOffsetMs).toBe(400);
    cursor.pause();
    cursor.resumeDiscussion();
    cursor.discussionEnd();
    cursor.complete();

    expect(reasons).toEqual([
      'play',
      'scene-change',
      'action-start',
      'discussion-start',
      'pause',
      'resume',
      'discussion-end',
      'complete',
    ]);
  });

  test('channel retains the latest event and supports unsubscribe', () => {
    const channel = new PlaybackCursorChannel();
    const listener = vi.fn();
    const unsubscribe = channel.subscribe(listener);
    const cursor = new PlaybackCursorController('course-1', 1, channel.publish, () => 100);
    cursor.play();
    expect(listener).toHaveBeenCalledOnce();
    expect(channel.getLatest()?.reason).toBe('play');
    unsubscribe();
    cursor.stop();
    expect(listener).toHaveBeenCalledOnce();
    expect(channel.getLatest()?.reason).toBe('stop');
  });
});

describe('PLAY-01 PlaybackEngine integration', () => {
  test('emits global scene/action cursor events and completion', async () => {
    const events: PlaybackCursorEvent[] = [];
    const actionEngine = {
      clearEffects: vi.fn(),
      execute: vi.fn(async () => undefined),
    } as unknown as ActionEngine;
    const audioPlayer = {
      stop: vi.fn(),
      isPlaying: vi.fn(() => false),
      hasActiveAudio: vi.fn(() => false),
    } as unknown as AudioPlayer;
    const scene = {
      id: 'scene-3',
      type: 'slide',
      title: 'Scene',
      content: { type: 'slide', elements: [] },
      actions: [{ id: 'action-1', type: 'spotlight', elementId: 'element-1' }],
    } as unknown as Scene;
    const engine = new PlaybackEngine([scene], actionEngine, audioPlayer, {
      onPlaybackCursor: (event) => events.push(event),
    });
    engine.setPlaybackCursorContext({
      courseId: 'course-1',
      sceneIndexBase: 2,
      now: () => 1_000,
    });

    engine.start();
    await vi.waitFor(() => expect(events.at(-1)?.reason).toBe('complete'));

    expect(events.map((event) => event.reason)).toEqual([
      'play',
      'scene-change',
      'action-start',
      'complete',
    ]);
    expect(events.find((event) => event.reason === 'action-start')?.cursor).toMatchObject({
      courseId: 'course-1',
      sceneKey: 'scene-3',
      sceneIndex: 2,
      actionId: 'action-1',
      actionIndex: 0,
    });
    expect(engine.getPlaybackCursor().phase).toBe('completed');
  });
});
