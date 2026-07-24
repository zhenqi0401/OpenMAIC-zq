'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  AdminStatusBadge,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { AdminRefreshButton } from '@/components/admin/AdminRefreshButton';
import {
  AdminActivityChart,
  type AdminActivityRange,
} from '@/components/admin/dashboard/AdminActivityChart';
import { AdminMetricCard, AdminLoadingState } from '@/components/admin/AdminPatterns';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { Button } from '@/components/ui/button';
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
    <AdminPage className="space-y-4" id="admin-dashboard">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={<AdminRefreshButton loading={loading} onRefresh={() => void load(true)} />}
          />
        }
        description="学习运营、社区互动和明确异常集中在首屏。"
        eyebrow="Dashboard"
        icon={<BarChart3 className="size-4" />}
        title="数据看板"
      />
      {dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="总学员数"
              value={dashboard.summary.learnerCount}
              detail="非管理员学习账号"
            />
            <AdminMetricCard
              label="活跃课程数"
              value={dashboard.summary.activeCourseCount}
              detail="当前已发布课程"
            />
            <AdminMetricCard
              label="课程完成率"
              value={percent(dashboard.summary.courseCompletionRate)}
              detail={
                dashboard.summary.courseCompletionRate === null ? '暂无学习记录' : '已完成 / 已开始'
              }
            />
            <AdminMetricCard
              label="考核通过率"
              value={percent(dashboard.summary.examPassRate)}
              detail={
                dashboard.summary.examPassRate === null
                  ? '暂无考核记录'
                  : `共 ${dashboard.summary.examAttemptCount} 次考核`
              }
            />
          </div>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
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
