import type {
  OutlineAuditErrorCode,
  OutlineAuditResult,
  OutlineAuditSessionState,
} from '@/lib/generation/outline-audit-types';
import type { UserRequirements } from '@/lib/types/generation';

export function isOutlineAuditRequired(input: {
  requirements: UserRequirements;
  taskEngineMode?: boolean;
}): boolean {
  return input.requirements.interactiveMode !== true && input.taskEngineMode !== true;
}

export function normalizeOutlineRevision(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

export function createRunningOutlineAudit(revision: number): OutlineAuditSessionState {
  return {
    status: 'running',
    baseRevision: revision,
    appliedFindingIds: [],
    rejectedFindingIds: [],
    startedAt: new Date().toISOString(),
  };
}

export function completeOutlineAudit(result: OutlineAuditResult): OutlineAuditSessionState {
  return {
    status: result.verdict === 'pass' ? 'passed' : 'changes_proposed',
    baseRevision: result.baseRevision,
    result,
    appliedFindingIds: [],
    rejectedFindingIds: [],
    completedAt: result.completedAt,
  };
}

export function failOutlineAudit(
  revision: number,
  error: { code: OutlineAuditErrorCode; message: string; retryable: boolean },
): OutlineAuditSessionState {
  return {
    status: 'failed',
    baseRevision: revision,
    appliedFindingIds: [],
    rejectedFindingIds: [],
    error,
    completedAt: new Date().toISOString(),
  };
}

export function staleOutlineAudit(
  state: OutlineAuditSessionState | undefined,
): OutlineAuditSessionState {
  return {
    ...(state ?? {
      baseRevision: 0,
      appliedFindingIds: [],
      rejectedFindingIds: [],
    }),
    status: 'stale',
    error: undefined,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function allFindingsHandled(state: OutlineAuditSessionState): boolean {
  if (!state.result) return false;
  const handled = new Set([...state.appliedFindingIds, ...state.rejectedFindingIds]);
  return state.result.findings.every((finding) => handled.has(finding.id));
}

export function markAuditFindingsApplied(
  state: OutlineAuditSessionState,
  findingIds: string[],
  newRevision: number,
): OutlineAuditSessionState {
  const next: OutlineAuditSessionState = {
    ...state,
    baseRevision: newRevision,
    appliedFindingIds: unique([...state.appliedFindingIds, ...findingIds]),
    error: undefined,
  };
  next.status = allFindingsHandled(next) ? 'resolved' : 'changes_proposed';
  if (next.status === 'resolved') next.completedAt = new Date().toISOString();
  return next;
}

export function rejectRemainingAuditFindings(
  state: OutlineAuditSessionState,
): OutlineAuditSessionState {
  if (!state.result) return state;
  const applied = new Set(state.appliedFindingIds);
  const rejectedFindingIds = unique([
    ...state.rejectedFindingIds,
    ...state.result.findings
      .filter((finding) => !applied.has(finding.id))
      .map((finding) => finding.id),
  ]);
  return {
    ...state,
    status: 'resolved',
    rejectedFindingIds,
    error: undefined,
    completedAt: new Date().toISOString(),
  };
}

export function skipOutlineAudit(revision: number): OutlineAuditSessionState {
  return {
    status: 'skipped',
    baseRevision: revision,
    appliedFindingIds: [],
    rejectedFindingIds: [],
    completedAt: new Date().toISOString(),
  };
}

export function isOutlineAuditCurrent(
  state: OutlineAuditSessionState | undefined,
  revision: number,
): boolean {
  return !!state && state.baseRevision === revision;
}

export function canConfirmWithOutlineAudit(
  state: OutlineAuditSessionState | undefined,
  revision: number,
): boolean {
  return (
    isOutlineAuditCurrent(state, revision) &&
    (state?.status === 'passed' || state?.status === 'resolved' || state?.status === 'skipped')
  );
}
