import {
  canConfirmWithOutlineAudit,
  isOutlineAuditRequired,
  normalizeOutlineRevision,
} from '@/lib/generation/outline-audit-state';
import type { GenerationSessionState } from './types';

/** Compatibility normalization for browser sessions created before outline audit existed. */
export function normalizeRestoredGenerationSession(
  session: GenerationSessionState,
): GenerationSessionState {
  const normalized: GenerationSessionState = {
    ...session,
    taskEngineMode: session.taskEngineMode === true,
    outlineRevision: normalizeOutlineRevision(session.outlineRevision),
  };
  if (
    normalized.sceneOutlines?.length &&
    isOutlineAuditRequired({
      requirements: normalized.requirements,
      taskEngineMode: normalized.taskEngineMode,
    }) &&
    !canConfirmWithOutlineAudit(normalized.outlineAudit, normalized.outlineRevision!)
  ) {
    normalized.previewPhase = 'review';
  }
  return normalized;
}
