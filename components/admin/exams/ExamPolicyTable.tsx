'use client';

import { useState } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';

import { AdminRowActions } from '@/components/admin/AdminRowActions';
import {
  AdminStatusBadge,
  adminDangerButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { Button } from '@/components/antd/AntdButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/antd/AntdAlertDialog';
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
  onView,
}: {
  policies: readonly AdminExamPolicy[];
  roleNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  deletingPolicyId: string | null;
  onEdit: (policy: AdminExamPolicy) => void;
  onPublish: (policyId: string) => void;
  onArchive: (policyId: string) => void;
  onDelete: (policyId: string) => void;
  onView: (policy: AdminExamPolicy) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<AdminExamPolicy | null>(null);
  const columns: ProColumns<AdminExamPolicy>[] = [
    { title: '考核名称', dataIndex: 'title', ellipsis: true, width: 180 },
    {
      title: '目标角色',
      dataIndex: 'targetRoleId',
      width: 130,
      renderText: (roleId) => roleNames.get(roleId) ?? roleId,
    },
    {
      title: '覆盖范围',
      width: 210,
      render: (_, policy) => getPolicyScopeSummary(policy, categoryNames),
    },
    { title: '题量', dataIndex: 'questionCount', width: 80, align: 'right' },
    {
      title: '候选题数',
      dataIndex: 'candidateQuestionCount',
      width: 100,
      renderText: (value) => `${value ?? 0} 题`,
    },
    {
      title: '通过线',
      dataIndex: 'passThreshold',
      width: 90,
      align: 'right',
      renderText: (value) => `${value}%`,
    },
    {
      title: '限时',
      dataIndex: 'timeLimitMinutes',
      width: 100,
      align: 'right',
      renderText: (value) => (value ? `${value} 分钟` : '不限时'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, policy) => {
        const status = getPolicyStatusView(policy.status);
        return <AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge>;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, policy) => (
        <AdminRowActions
          actions={getPolicyMenuLabels(policy.status).map((label) => ({
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
              onClick={() => (policy.status === 'published' ? onView(policy) : onEdit(policy))}
              type="button"
              variant="outline"
            >
              {policy.status === 'published' ? '查看' : '编辑'}
            </Button>
          }
          triggerAriaLabel={`${policy.title}的更多操作`}
        />
      ),
    },
  ];

  return (
    <>
      <div className="w-full overflow-hidden" data-exam-policy-table>
        <ProTable<AdminExamPolicy>
          columns={columns}
          dataSource={[...policies]}
          options={false}
          pagination={false}
          rowKey="id"
          search={false}
          scroll={{ x: 1210 }}
          tableAlertRender={false}
        />
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
            <AlertDialogCancel
              className={adminSecondaryButtonClassName}
              disabled={Boolean(deletingPolicyId)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              aria-busy={Boolean(deletingPolicyId)}
              className={adminDangerButtonClassName}
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
