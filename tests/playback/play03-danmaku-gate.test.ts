import { describe, expect, test } from 'vitest';

import { resolveDanmakuPlaybackGate } from '@/lib/playback';
import type { Scene } from '@/lib/types/stage';

function scene(type: 'slide' | 'quiz' | 'interactive' | 'pbl'): Scene {
  return {
    id: `${type}-1`,
    type,
    title: type,
    content: { type, elements: [] },
    actions: [],
  } as unknown as Scene;
}

describe('PLAY-03 danmaku scene gate', () => {
  test('enables ordinary enterprise lecture slides and video-bearing slides', () => {
    expect(
      resolveDanmakuPlaybackGate({
        courseId: 'course-1',
        scene: scene('slide'),
        mode: 'playback',
        whiteboardOpen: false,
        phase: 'playing',
      }),
    ).toEqual({ enabled: true, reason: 'enabled' });
  });

  test.each([
    [{ courseId: null }, 'local-course'],
    [{ mode: 'edit' as const }, 'edit-mode'],
    [{ scene: scene('quiz') }, 'unsupported-scene'],
    [{ scene: scene('interactive') }, 'unsupported-scene'],
    [{ scene: scene('pbl') }, 'unsupported-scene'],
    [{ whiteboardOpen: true }, 'whiteboard-open'],
    [{ phase: 'discussion' as const }, 'discussion-active'],
  ])('blocks %s with an explicit reason', (patch, reason) => {
    expect(
      resolveDanmakuPlaybackGate({
        courseId: 'course-1',
        scene: scene('slide'),
        mode: 'playback',
        whiteboardOpen: false,
        phase: 'playing',
        ...patch,
      }),
    ).toEqual({ enabled: false, reason });
  });

  test('blocks missing and non-slide content even if a forged scene type says slide', () => {
    expect(
      resolveDanmakuPlaybackGate({
        courseId: 'course-1',
        scene: { ...scene('slide'), content: { type: 'quiz', questions: [] } } as unknown as Scene,
        mode: 'playback',
        whiteboardOpen: false,
      }),
    ).toEqual({ enabled: false, reason: 'unsupported-scene' });
  });
});
