'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminMetricCard, AdminStatusChip } from '@/components/admin/AdminPatterns';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  createAdminClient,
  type AdminExamAttemptResponse,
  type AdminExamPolicy,
} from '@/lib/admin/client';

function displayPercent(value: number | null) {
  return value === null ? '暂无记录' : `${value}%`;
}

export function ExamResultsDrawer({
  policy,
  onOpenChange,
}: {
  policy: AdminExamPolicy | null;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useMemo(() => createAdminClient(), []);
  const [data, setData] = useState<AdminExamAttemptResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!policy) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      void client
        .getExamPolicyAttempts(policy.id, page, 20)
        .then((result) => active && setData(result))
        .finally(() => active && setLoading(false));
    });
    return () => {
      active = false;
    };
  }, [client, page, policy]);

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(policy)}>
      <DialogContent
        {...adminThemeAttributes}
        className="inset-y-0 left-auto right-0 top-0 h-[100dvh] max-h-none w-[min(96vw,760px)] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-l-[var(--admin-radius-dialog)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle>{policy?.title ?? '考核结果'}</DialogTitle>
          <DialogDescription>仅展示考核作答结果，不包含课程学习进度。</DialogDescription>
        </DialogHeader>
        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <AdminMetricCard label="参与人数" value={data.summary.participantCount} />
              <AdminMetricCard label="考核次数" value={data.summary.attemptCount} />
              <AdminMetricCard label="通过率" value={displayPercent(data.summary.passRate)} />
              <AdminMetricCard label="平均分" value={data.summary.averageScore ?? '暂无记录'} />
            </div>
            {data.attempts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)]">
                      <th className="p-3">学员</th>
                      <th className="p-3">角色</th>
                      <th className="p-3">得分</th>
                      <th className="p-3">结果</th>
                      <th className="p-3">次数</th>
                      <th className="p-3">提交时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attempts.map((attempt) => (
                      <tr className="border-b border-[var(--admin-border-subtle)]" key={attempt.id}>
                        <td className="p-3">{attempt.displayName}</td>
                        <td className="p-3">{attempt.roleName}</td>
                        <td className="p-3 tabular-nums">{attempt.score}</td>
                        <td className="p-3">
                          <AdminStatusChip tone={attempt.passed ? 'success' : 'danger'}>
                            {attempt.passed ? '通过' : '未通过'}
                          </AdminStatusChip>
                        </td>
                        <td className="p-3">第 {attempt.attemptNumber} 次</td>
                        <td className="p-3">
                          <time dateTime={attempt.submittedAt}>
                            {new Date(attempt.submittedAt).toLocaleString()}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState title={loading ? '正在加载结果' : '暂无考核记录'} />
            )}
            <AdminPagination
              end={Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)}
              loading={loading}
              onPageChange={setPage}
              page={data.pagination.page}
              start={
                data.pagination.total
                  ? (data.pagination.page - 1) * data.pagination.pageSize + 1
                  : 0
              }
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
            />
          </>
        ) : (
          <AdminEmptyState title={loading ? '正在加载考核结果' : '暂无考核结果'} />
        )}
      </DialogContent>
    </Dialog>
  );
}
