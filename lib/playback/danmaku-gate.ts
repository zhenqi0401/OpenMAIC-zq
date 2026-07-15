import type { Scene, StageMode } from '@/lib/types/stage';
import type { PlaybackCursorPhase } from './types';

export type DanmakuGateReason =
  | 'enabled'
  | 'local-course'
  | 'edit-mode'
  | 'unsupported-scene'
  | 'whiteboard-open'
  | 'discussion-active';

export interface DanmakuGateResult {
  enabled: boolean;
  reason: DanmakuGateReason;
}

export function resolveDanmakuPlaybackGate(input: {
  courseId: string | null | undefined;
  scene: Scene | null | undefined;
  mode: StageMode;
  whiteboardOpen: boolean;
  phase?: PlaybackCursorPhase;
}): DanmakuGateResult {
  if (!input.courseId) return { enabled: false, reason: 'local-course' };
  if (input.mode === 'edit') return { enabled: false, reason: 'edit-mode' };
  if (!input.scene || input.scene.type !== 'slide' || input.scene.content?.type !== 'slide') {
    return { enabled: false, reason: 'unsupported-scene' };
  }
  if (input.whiteboardOpen) return { enabled: false, reason: 'whiteboard-open' };
  if (input.phase === 'discussion') return { enabled: false, reason: 'discussion-active' };
  return { enabled: true, reason: 'enabled' };
}
