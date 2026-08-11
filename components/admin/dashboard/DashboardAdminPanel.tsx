'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  AdminStatusBadge,
} from '@/components/admin/AdminSurface';
import {
  AdminActivityChart,
  type AdminActivityRange,
} from '@/components/admin/dashboard/AdminActivityChart';
import { AdminLoadingState } from '@/components/admin/AdminPatterns';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { Button } from '@/components/antd/AntdButton';
import { adminErrorMessage, adminToast } from '@/lib/admin/toast';
import { createAdminClient, type AdminDashboard } from '@/lib/admin/client';

export { formatDashboardPercent, toDashboardProgressRatio } from '@/lib/admin/presentation';

interface DashboardAdminClient {
  getDashboard(): Promise<unknown>;
  listRoles(): Promise<unknown>;
  listInviteCodes(): Promise<unknown>;
  listUsers(): Promise<unknown>;
}
export async function loadDashboardAdminData(client: DashboardAdminClient) {
  const [dashboard, roles, inviteCodes, users] = await Promise.all([
    client.getDashboard(),
    client.listRoles(),
    client.listInviteCodes(),
    client.listUsers(),
  ]);
  return { dashboard, roles, inviteCodes, users };
}

function percent(value: number | null) {
  return value === null ? '—' : `${value}%`;
}

/** 数据条中的单个指标：标题 + 数值 + 可选说明，无独立卡片边框。 */
export function DashboardStripMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6" data-dashboard-metric-item>
      <dt className="text-sm font-medium leading-5 text-[var(--admin-muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums leading-8 text-[var(--admin-heading)]">
        {value}
      </dd>
      {detail ? (
        <dd className="mt-0.5 text-xs leading-4 text-[var(--admin-muted-foreground)]">
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

export function DashboardPendingItems({ pending }: { pending: AdminDashboard['pending'] }) {
  return (
    <AdminCard className="p-6" data-dashboard-pending-items>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">待处理事项</h2>
        <AdminStatusBadge tone={pending.total > 0 ? 'danger' : 'success'}>
          {pending.total}个待处理
        </AdminStatusBadge>
      </div>
      {pending.items.length ? (
        <div className="mt-5 grid gap-3">
          {pending.items.map((item) => (
            <article
              className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-4"
              key={item.id}
            >
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">{item.title}</h3>
                <span className="tabular-nums">{item.count}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
                {item.description}
              </p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link href={item.href}>{item.actionLabel}</Link>
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <AdminEmptyState compact title="暂无待处理事项" />
      )}
    </AdminCard>
  );
}

export function DashboardAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [range, setRange] = useState<AdminActivityRange>('month');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (notify = false) => {
      setLoading(true);
      setError(null);
      try {
        setDashboard(await client.getDashboard(range));
        if (notify) adminToast.success('看板已刷新');
      } catch (cause) {
        const message = adminErrorMessage(cause, '看板加载失败');
        setError(message);
        if (notify) adminToast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [client, range],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminPage id="admin-dashboard">
      <AdminSectionHeader title="数据看板" />
      {dashboard ? (
        <>
          {/* 四个指标合成一条数据条：一个表面，内部 2/4 列分隔，不做四个独立大卡片 */}
          <AdminCard className="overflow-hidden" data-dashboard-metric-strip>
            <dl className="grid grid-cols-2 divide-x divide-[var(--admin-border-subtle)] xl:grid-cols-4">
              <DashboardStripMetric
                detail={dashboard.summary.learnerCount === 0 ? undefined : '非管理员学习账号'}
                label="总学员数"
                value={dashboard.summary.learnerCount}
              />
              <DashboardStripMetric
                detail={dashboard.summary.activeCourseCount === 0 ? undefined : '当前已发布课程'}
                label="活跃课程数"
                value={dashboard.summary.activeCourseCount}
              />
              <DashboardStripMetric
                detail={
                  dashboard.summary.courseCompletionRate === null ? undefined : '已完成 / 已开始'
                }
                label="课程完成率"
                value={percent(dashboard.summary.courseCompletionRate)}
              />
              <DashboardStripMetric
                detail={
                  dashboard.summary.examPassRate === null
                    ? undefined
                    : `共 ${dashboard.summary.examAttemptCount} 次考核`
                }
                label="考核通过率"
                value={percent(dashboard.summary.examPassRate)}
              />
            </dl>
          </AdminCard>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
            <AdminActivityChart
              activity={dashboard.communityActivity}
              loading={loading}
              onRangeChange={setRange}
              range={range}
            />
            <DashboardPendingItems pending={dashboard.pending} />
          </div>
        </>
      ) : loading ? (
        <AdminLoadingState label="正在加载看板…" />
      ) : (
        <AdminEmptyState
          action={
            <Button onClick={() => void load()} variant="outline">
              重新加载
            </Button>
          }
          description={error ?? undefined}
          kind="error"
          title="看板加载失败"
        />
      )}
    </AdminPage>
  );
}
