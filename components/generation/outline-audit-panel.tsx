'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/lib/hooks/use-i18n';
import type {
  OutlineAuditFinding,
  OutlineAuditOperation,
  OutlineAuditSessionState,
} from '@/lib/generation/outline-audit-types';
import { cn } from '@/lib/utils';

interface OutlineAuditPanelProps {
  audit?: OutlineAuditSessionState;
  outlineRevision: number;
  isStreaming: boolean;
  onRetry: () => void;
  onApplySelected: (findingIds: string[]) => void;
  onRejectRemaining: () => void;
  onSkip: () => void;
}

function operationLabel(operation: OutlineAuditOperation, t: ReturnType<typeof useI18n>['t']) {
  switch (operation.type) {
    case 'update_field':
      return t('generation.outlineAuditOperationUpdate', { field: operation.field });
    case 'insert_scene':
      return t('generation.outlineAuditOperationInsert');
    case 'delete_scene':
      return t('generation.outlineAuditOperationDelete');
    case 'move_scene':
      return t('generation.outlineAuditOperationMove');
    case 'change_scene_type':
      return t('generation.outlineAuditOperationType', { type: operation.newType });
  }
}

function FindingCard({
  finding,
  selected,
  decision,
  onSelectedChange,
}: {
  finding: OutlineAuditFinding;
  selected: boolean;
  decision?: 'applied' | 'rejected';
  onSelectedChange: (selected: boolean) => void;
}) {
  const { t } = useI18n();
  const canApply = !decision && finding.operations.length > 0;
  return (
    <article className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-start gap-2.5">
        {canApply ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={t('generation.outlineAuditSelectFinding', { reason: finding.reason })}
            className="mt-0.5"
          />
        ) : (
          <span className="mt-0.5 size-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                finding.severity === 'error'
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
              )}
            >
              {t(`generation.outlineAuditSeverity_${finding.severity}`)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t(`generation.outlineAuditCategory_${finding.category}`)}
            </span>
            {decision && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {t(`generation.outlineAuditDecision_${decision}`)}
              </span>
            )}
            {!decision && finding.operations.length === 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-500/15 dark:text-slate-300">
                {t('generation.outlineAuditManualOnly')}
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-5 text-foreground">{finding.reason}</p>
          {finding.relatedSceneIds.length > 0 && (
            <p className="break-words text-xs text-muted-foreground">
              {t('generation.outlineAuditRelatedScenes', {
                scenes: finding.relatedSceneIds.join(', '),
              })}
            </p>
          )}
        </div>
      </div>

      {finding.evidence.length > 0 && (
        <div className="space-y-1 rounded-xl bg-muted/60 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('generation.outlineAuditEvidence')}
          </p>
          {finding.evidence.map((evidence) => (
            <blockquote key={evidence.sourceId} className="text-xs leading-5 text-foreground/80">
              <span className="font-mono font-semibold">[{evidence.sourceId}]</span>{' '}
              {evidence.excerpt}
            </blockquote>
          ))}
        </div>
      )}

      <dl className="grid gap-2 text-xs">
        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.04] p-2.5">
          <dt className="mb-1 font-semibold text-red-700 dark:text-red-300">
            {t('generation.outlineAuditBefore')}
          </dt>
          <dd className="whitespace-pre-wrap break-words text-foreground/80">{finding.before}</dd>
        </div>
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-2.5">
          <dt className="mb-1 font-semibold text-emerald-700 dark:text-emerald-300">
            {t('generation.outlineAuditAfter')}
          </dt>
          <dd className="whitespace-pre-wrap break-words text-foreground/80">{finding.after}</dd>
        </div>
      </dl>

      {finding.operations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('generation.outlineAuditOperations')}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {finding.operations.map((operation, index) => (
              <li key={`${operation.type}-${index}`}>{operationLabel(operation, t)}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function OutlineAuditPanel({
  audit,
  outlineRevision,
  isStreaming,
  onRetry,
  onApplySelected,
  onRejectRemaining,
  onSkip,
}: OutlineAuditPanelProps) {
  const { t } = useI18n();
  const [selection, setSelection] = useState<{ auditId?: string; ids: string[] }>({ ids: [] });
  const [skipOpen, setSkipOpen] = useState(false);
  const resultId = audit?.result?.auditId;

  const selected = selection.auditId === resultId ? selection.ids : [];

  const applied = useMemo(() => new Set(audit?.appliedFindingIds ?? []), [audit]);
  const rejected = useMemo(() => new Set(audit?.rejectedFindingIds ?? []), [audit]);
  const pending =
    audit?.result?.findings.filter(
      (finding) => !applied.has(finding.id) && !rejected.has(finding.id),
    ) ?? [];
  const selectedPending = selected.filter((id) => pending.some((finding) => finding.id === id));
  const status = isStreaming ? 'streaming' : (audit?.status ?? 'idle');
  const completedAt = audit?.result?.completedAt ?? audit?.completedAt;

  const toggleFinding = (id: string, checked: boolean) => {
    setSelection((current) => {
      const ids = current.auditId === resultId ? current.ids : [];
      return {
        auditId: resultId,
        ids: checked ? [...new Set([...ids, id])] : ids.filter((candidate) => candidate !== id),
      };
    });
  };

  return (
    <aside
      aria-label={t('generation.outlineAuditTitle')}
      aria-live="polite"
      className="min-w-0 rounded-3xl border border-border/50 bg-white/85 p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/70 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-tight">{t('generation.outlineAuditTitle')}</h3>
          <p className="text-xs text-muted-foreground">
            Doubao Seed Evolving · {t('generation.outlineAuditRevision', { revision: outlineRevision })}
          </p>
        </div>
      </div>

      {(status === 'streaming' || status === 'idle') && (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-4 text-center">
          <Clock3 className="mx-auto size-7 text-muted-foreground" />
          <p className="text-sm font-medium">{t('generation.outlineAuditWaiting')}</p>
          <p className="text-xs text-muted-foreground">{t('generation.outlineAuditWaitingDesc')}</p>
        </div>
      )}

      {status === 'running' && (
        <div className="space-y-3 rounded-2xl bg-violet-500/[0.06] p-4 text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-violet-600 dark:text-violet-300" />
          <p className="text-sm font-medium">{t('generation.outlineAuditRunning')}</p>
          <p className="text-xs text-muted-foreground">{t('generation.outlineAuditRunningDesc')}</p>
        </div>
      )}

      {status === 'passed' && (
        <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-5" />
            <p className="font-semibold">{t('generation.outlineAuditPassed')}</p>
          </div>
          <p className="text-sm text-foreground/80">{t('generation.outlineAuditPassedDesc')}</p>
          {audit?.result?.summary && (
            <p className="text-xs text-muted-foreground">{audit.result.summary}</p>
          )}
        </div>
      )}

      {(status === 'changes_proposed' || status === 'resolved') && audit?.result && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-amber-500/[0.07] p-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {status === 'resolved'
                ? t('generation.outlineAuditResolved')
                : t('generation.outlineAuditChangesFound', {
                    count: audit.result.findings.length,
                  })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{audit.result.summary}</p>
          </div>

          <div className="space-y-3">
            {audit.result.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                selected={selected.includes(finding.id)}
                decision={
                  applied.has(finding.id)
                    ? 'applied'
                    : rejected.has(finding.id)
                      ? 'rejected'
                      : undefined
                }
                onSelectedChange={(checked) => toggleFinding(finding.id, checked)}
              />
            ))}
          </div>

          {status === 'changes_proposed' && (
            <div className="grid gap-2">
              <Button
                type="button"
                onClick={() => onApplySelected(selectedPending)}
                disabled={selectedPending.length === 0}
                className="w-full"
              >
                <WandSparkles className="size-4" />
                {t('generation.outlineAuditApplySelected', { count: selectedPending.length })}
              </Button>
              <Button type="button" variant="outline" onClick={onRejectRemaining}>
                {t('generation.outlineAuditRejectRemaining', { count: pending.length })}
              </Button>
            </div>
          )}
        </div>
      )}

      {(status === 'failed' || status === 'stale') && (
        <div className="space-y-3">
          <div
            className={cn(
              'rounded-2xl border p-4',
              status === 'failed'
                ? 'border-red-500/20 bg-red-500/[0.06]'
                : 'border-amber-500/20 bg-amber-500/[0.06]',
            )}
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                className={cn('size-5', status === 'failed' ? 'text-red-600' : 'text-amber-600')}
              />
              <p className="text-sm font-semibold">
                {status === 'failed'
                  ? t('generation.outlineAuditFailed')
                  : t('generation.outlineAuditStale')}
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {status === 'failed'
                ? (audit?.error?.message ?? t('generation.outlineAuditFailedDesc'))
                : t('generation.outlineAuditStaleDesc')}
            </p>
            {audit?.error?.auditId && (
              <p className="mt-1 text-[11px] font-mono text-muted-foreground">ID: {audit.error.auditId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-4" />
              {t('generation.outlineAuditRetry')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSkipOpen(true)}>
              <SkipForward className="size-4" />
              {t('generation.outlineAuditSkip')}
            </Button>
          </div>
        </div>
      )}

      {status === 'skipped' && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold">{t('generation.outlineAuditSkipped')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('generation.outlineAuditSkippedDesc')}
          </p>
        </div>
      )}

      {completedAt && status !== 'running' && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t('generation.outlineAuditCompletedAt', {
            time: new Date(completedAt).toLocaleString(),
          })}
        </p>
      )}

      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('generation.outlineAuditSkipConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('generation.outlineAuditSkipConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('generation.outlineAuditSkipCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onSkip}>
              {t('generation.outlineAuditSkipConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
