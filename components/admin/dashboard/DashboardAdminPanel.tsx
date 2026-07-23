'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, RefreshCw } from 'lucide-react';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
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

const series = [
  { key: 'interactions', label: '总互动', color: 'var(--admin-action-primary)' },
  { key: 'posts', label: '帖子', color: 'var(--admin-success)' },
  { key: 'replies', label: '回复', color: 'var(--admin-focus)' },
  { key: 'danmaku', label: '弹幕', color: 'var(--admin-danger)' },
] as const;

function ActivityChart({ dashboard }: { dashboard: AdminDashboard }) {
  const points = dashboard.communityActivity.points;
  const max = Math.max(1, ...points.flatMap((point) => series.map((item) => point[item.key])));
  const polyline = (key: (typeof series)[number]['key']) =>
    points
      .map(
        (point, index) =>
          `${points.length === 1 ? 0 : (index / (points.length - 1)) * 100},${100 - (point[key] / max) * 88}`,
      )
      .join(' ');
  return (
    <AdminCard className="min-w-0 p-6" data-admin-community-chart>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">社区活跃趋势</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
            真实帖子、回复和弹幕聚合；关闭的功能类型不计入互动。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((item) => (
            <span className="inline-flex items-center gap-1.5 text-xs" key={item.key}>
              <i className="size-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 h-72 w-full">
        <svg
          aria-label="社区活跃趋势图"
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              stroke="var(--admin-border-subtle)"
              strokeWidth="0.35"
              x1="0"
              x2="100"
              y1={y}
              y2={y}
            />
          ))}
          {series.map((item) => (
            <polyline
              fill="none"
              key={item.key}
              points={polyline(item.key)}
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex justify-between text-xs text-[var(--admin-muted-foreground)]">
        <span>{points[0]?.date ?? '—'}</span>
        <span>{points.at(-1)?.date ?? '—'}</span>
      </div>
    </AdminCard>
  );
}

export function DashboardAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month');
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
            leading={
              <Button
                aria-busy={loading}
                className={adminSecondaryButtonClassName}
                disabled={loading}
                onClick={() => void load(true)}
                type="button"
                variant="outline"
              >
                <RefreshCw className="size-4" />
                {loading ? '刷新中…' : '刷新'}
              </Button>
            }
          />
        }
        description="学习运营、社区互动和明确异常集中在首屏。"
        eyebrow="Dashboard"
        icon={<BarChart3 className="size-4" />}
        title="数据看板"
      />
      <div className="flex justify-end gap-1" role="group" aria-label="趋势周期">
        {(['week', 'month', 'year'] as const).map((item) => (
          <Button
            aria-pressed={range === item}
            className={
              range === item
                ? 'bg-[var(--admin-selection-background)] text-[var(--admin-action-primary)]'
                : ''
            }
            key={item}
            onClick={() => setRange(item)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {{ week: '周', month: '月', year: '年' }[item]}
          </Button>
        ))}
      </div>
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
            <ActivityChart dashboard={dashboard} />
            <AdminCard className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">待处理事项</h2>
                  <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
                    只列出已确认的配置或内容异常。
                  </p>
                </div>
                <span className="text-2xl font-semibold tabular-nums">
                  {dashboard.pending.total}
                </span>
              </div>
              {dashboard.pending.items.length ? (
                <div className="mt-5 grid gap-3">
                  {dashboard.pending.items.map((item) => (
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
