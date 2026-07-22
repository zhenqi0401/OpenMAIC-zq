'use client';

import { useState } from 'react';
import { AdminRowActions } from '@/components/admin/AdminRowActions';
import { AdminStatusBadge, adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';
import { Button } from '@/components/ui/button';
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
import type { AdminExamPolicy } from '@/lib/admin/client';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  getPolicyMenuLabels,
  getPolicyScopeSummary,
  getPolicyStatusView,
} from '@/lib/admin/exam-policy-presentation';

export function ExamPolicyTable({
  policies,
  roleNames,
  categoryNames,
  deletingPolicyId,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
}: {
  policies: readonly AdminExamPolicy[];
  roleNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  deletingPolicyId: string | null;
  onEdit: (policy: AdminExamPolicy) => void;
  onPublish: (policyId: string) => void;
  onArchive: (policyId: string) => void;
  onDelete: (policyId: string) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<AdminExamPolicy | null>(null);

  return (
    <>
      <div className="w-full overflow-hidden" data-exam-policy-table>
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            考核名称、目标角色、覆盖范围、题量、候选题数、通过线、限时、状态和操作
          </caption>
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[7%]" />
            <col className="w-[12%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--admin-border)] text-xs font-semibold tracking-[0.03em] text-[var(--admin-muted-foreground)]">
              <th className="px-3 py-3" scope="col">
                考核名称
              </th>
              <th className="px-2 py-3" scope="col">
                目标角色
              </th>
              <th className="px-2 py-3" scope="col">
                覆盖范围
              </th>
              <th className="px-2 py-3 text-right" scope="col">
                题量
              </th>
              <th className="px-2 py-3" scope="col">
                候选题数
              </th>
              <th className="px-2 py-3 text-right" scope="col">
                通过线
              </th>
              <th className="px-2 py-3 text-right" scope="col">
                限时
              </th>
              <th className="px-2 py-3" scope="col">
                状态
              </th>
              <th className="px-3 py-3 text-right" scope="col">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const candidateQuestionCount = policy.candidateQuestionCount ?? 0;
              const status = getPolicyStatusView(policy.status);
              const menuLabels = getPolicyMenuLabels(policy.status);
              return (
                <tr
                  className="border-b border-[var(--admin-border-subtle)] align-top last:border-b-0"
                  key={policy.id}
                >
                  <td className="break-words px-3 py-3 font-medium text-[var(--admin-foreground)]">
                    {policy.title}
                  </td>
                  <td className="break-words px-2 py-3 text-[var(--admin-muted-foreground)]">
                    {roleNames.get(policy.targetRoleId) ?? policy.targetRoleId}
                  </td>
                  <td className="break-words px-2 py-3 text-xs leading-5 text-[var(--admin-muted-foreground)]">
                    {getPolicyScopeSummary(policy, categoryNames)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{policy.questionCount}</td>
                  <td className="px-2 py-3">
                    <span className="whitespace-nowrap tabular-nums text-[var(--admin-foreground)]">
                      {candidateQuestionCount} 题
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{policy.passThreshold}%</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {policy.timeLimitMinutes ? `${policy.timeLimitMinutes} 分钟` : '不限时'}
                  </td>
                  <td className="px-2 py-3">
                    <AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <AdminRowActions
                      actions={menuLabels.map((label) => ({
                        id: label,
                        label,
                        destructive: label === '删除',
                        onSelect: () => {
                          if (label === '删除') setDeleteTarget(policy);
                          else if (label === '下架') onArchive(policy.id);
                          else onPublish(policy.id);
                        },
                      }))}
                      primaryAction={
                        <Button
                          className={adminSecondaryButtonClassName}
                          onClick={() => onEdit(policy)}
                          type="button"
                          variant="outline"
                        >
                          编辑
                        </Button>
                      }
                      triggerAriaLabel={`${policy.title}的更多操作`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
      >
        <AlertDialogContent
          {...adminThemeAttributes}
          className="max-w-[420px] rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-foreground)]"
        >
          <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
            <AlertDialogTitle className="text-xl font-normal">删除考核策略</AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-6">
              {deleteTarget
                ? `确认删除考核策略「${deleteTarget.title}」？仅草稿可以删除，删除后不可恢复。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-[var(--admin-border-subtle)] px-5 pb-5 pt-3">
            <AlertDialogCancel disabled={Boolean(deletingPolicyId)}>取消</AlertDialogCancel>
            <AlertDialogAction
              aria-busy={Boolean(deletingPolicyId)}
              disabled={Boolean(deletingPolicyId)}
              onClick={() => deleteTarget && onDelete(deleteTarget.id)}
              variant="destructive"
            >
              {deletingPolicyId ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ExamPolicyActions({
  policy,
  deleting,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
}: {
  policy: AdminExamPolicy;
  deleting: boolean;
  onEdit: (policy: AdminExamPolicy) => void;
  onPublish: (policyId: string) => void;
  onArchive: (policyId: string) => void;
  onDelete: (policyId: string) => void;
}) {
  return (
    <AdminRowActions
      actions={getPolicyMenuLabels(policy.status).map((label) => ({
        id: label,
        label: deleting && label === '删除' ? '删除中…' : label,
        disabled: deleting && label === '删除',
        destructive: label === '删除',
        onSelect: () => {
          if (label === '删除') onDelete(policy.id);
          else if (label === '下架') onArchive(policy.id);
          else onPublish(policy.id);
        },
      }))}
      primaryAction={
        <Button
          className={adminSecondaryButtonClassName}
          onClick={() => onEdit(policy)}
          type="button"
          variant="outline"
        >
          编辑
        </Button>
      }
    />
  );
}
