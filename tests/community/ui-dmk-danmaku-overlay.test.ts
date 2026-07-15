import { describe, expect, it } from 'vitest';
import { estimateDanmakuOffset, getDanmakuDuration } from '@/components/community/DanmakuOverlay';
import type { PlaybackCursorSnapshot } from '@/lib/playback';

function cursor(patch: Partial<PlaybackCursorSnapshot> = {}): PlaybackCursorSnapshot {
  return {
    courseId: 'course-1',
    sceneKey: 'scene-1',
    sceneIndex: 0,
    actionId: 'action-1',
    actionIndex: 0,
    actionOffsetMs: 500,
    phase: 'playing',
    playbackRate: 1.5,
    emittedAt: 1_000,
    ...patch,
  };
}

describe('UI-DMK danmaku overlay helpers', () => {
  it('anchors a send to the live playback offset and rate', () => {
    expect(estimateDanmakuOffset(cursor(), 2_000)).toBe(2_000);
  });

  it('does not advance the anchor while playback is paused', () => {
    expect(estimateDanmakuOffset(cursor({ phase: 'paused' }), 20_000)).toBe(500);
  });

  it('gives longer comments more reading time and caps the duration', () => {
    expect(getDanmakuDuration('短评')).toBe(5_160);
    expect(getDanmakuDuration('x'.repeat(200))).toBe(12_000);
  });
});
