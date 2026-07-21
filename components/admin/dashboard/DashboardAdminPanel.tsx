'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { AdminCard, AdminSectionHeader } from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { DashboardMetric } from '@/components/admin/dashboard/DashboardMetric';
import {
  DashboardProgressTable,
  type DashboardFilters,
} from '@/components/admin/dashboard/DashboardProgressTable';
import { Button } from '@/components/ui/button';
import { adminErrorMessage, adminToast } from '@/lib/admin/toast';
import {
  createAdminClient,
  type AdminDashboard,
  type AdminInviteCode,
  type AdminRole,
  type AdminUser,
} from '@/lib/admin/client';
import {
  buildDashboardPendingItems,
  formatDashboardPercent,
  getDashboardPassRateDisplay,
  toDashboardProgressRatio,
  type DashboardPendingItem,
} from '@/lib/admin/presentation';

export { formatDashboardPercent, toDashboardProgressRatio } from '@/lib/admin/presentation';

type DashboardAdminClient = Pick<
  ReturnType<typeof createAdminClient>,
  'getDashboard' | 'listRoles' | 'listInviteCodes' | 'listUsers'
>;

export async function loadDashboardAdminData(client: DashboardAdminClient) {
  const [dashboard, roles, inviteCodes, users] = await Promise.all([
    client.getDashboard(),
    client.listRoles(),
    client.listInviteCodes(),
    client.listUsers(),
  ]);

  return { dashboard, roles, inviteCodes, users };
}

function notifyAdminError(error: unknown, fallback: string) {
  adminToast.error(adminErrorMessage(error, fallback));
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-[#75665d]">{text}</div>;
}

const pendingSeverityClassName: Record<DashboardPendingItem['severity'], string> = {
  high: 'border-[#9b5b47] bg-[#c96f54]',
  medium: 'border-[#b68345] bg-[#d8a45c]',
  info: 'border-[#748274] bg-[#8da08b]',
};

export function DashboardAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>({
    userId: '',
    roleId: '',
    courseId: '',
  });
  const [loading, setLoading] = useState(true);

  const pendingItems = useMemo(
    () => buildDashboardPendingItems(dashboard, roles, inviteCodes, users),
    [dashboard, roles, inviteCodes, users],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadDashboardAdminData(client);
      setDashboard(data.dashboard);
      setRoles(data.roles);
      setInviteCodes(data.inviteCodes);
      setUsers(data.users);
    } catch (loadError) {
      notifyAdminError(loadError, '后台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function loadDashboard(filters = dashboardFilters, successMessage = '看板已刷新') {
    try {
      setDashboard(
        await client.getDashboard({
          userId: filters.userId,
          roleId: filters.roleId,
          courseId: filters.courseId,
        }),
      );
      adminToast.success(successMessage);
    } catch (loadError) {
      notifyAdminError(loadError, '看板刷新失败');
    }
  }

  function applyDashboardFilters() {
    setDashboardPage(1);
    void loadDashboard(dashboardFilters, '筛选条件已应用');
  }

  function resetDashboardFilters() {
    const emptyFilters = { userId: '', roleId: '', courseId: '' };
    setDashboardFilters(emptyFilters);
    setDashboardPage(1);
    void loadDashboard(emptyFilters, '筛选条件已重置');
  }

  const assessmentMetric = dashboard
    ? getDashboardPassRateDisplay(
        dashboard.summary.assessmentPassRate,
        dashboard.summary.assessmentAttemptCount,
        '测评',
      )
    : null;
  const examMetric = dashboard
    ? getDashboardPassRateDisplay(
        dashboard.summary.examPassRate,
        dashboard.summary.examAttemptCount,
        '考核',
      )
    : null;

  return (
    <section className="scroll-mt-4 space-y-4" id="admin-dashboard">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={
              <Button
                className="rounded-[4px] border-[#d8c8b9]"
                onClick={() => void loadDashboard()}
                variant="outline"
              >
                刷新看板
              </Button>
            }
          />
        }
        description="课程完成、测评通过、阶段考核和待处理事项集中在首屏。"
        eyebrow="Dashboard"
        icon={<BarChart3 className="size-4" />}
        title="运营状态一眼看清"
      />
      {dashboard && assessmentMetric && examMetric ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <DashboardMetric
              label="课程完成率"
              value={formatDashboardPercent(dashboard.summary.courseCompletionRate)}
              progress={toDashboardProgressRatio(dashboard.summary.courseCompletionRate)}
              note="当前课程学习记录口径"
              tooltip="已完成人数 / 已开始学习人数"
            />
            <DashboardMetric label="测评通过率" {...assessmentMetric} />
            <DashboardMetric label="阶段考核通过率" {...examMetric} />
            <DashboardMetric
              label="学员人数"
              value={String(dashboard.summary.learnerCount)}
              progress={null}
              note={`覆盖课程 ${dashboard.summary.courseCount} 门`}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
            <DashboardProgressTable
              dashboardFilters={dashboardFilters}
              emptyText="当前筛选无学习记录"
              onFilterChange={setDashboardFilters}
              onPageChange={setDashboardPage}
              onReset={resetDashboardFilters}
              onSubmit={applyDashboardFilters}
              page={dashboardPage}
              progress={dashboard.progress}
              roles={roles}
            />
            <AdminCard className="p-4">
              <div className="mb-3">
                <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
                  需要处理
                </div>
                <p className="mt-1 text-sm text-[#75665d]">每一项都给出可直接执行的下一步。</p>
              </div>
              {pendingItems.length === 0 ? (
                <EmptyState text="暂无待处理事项" />
              ) : (
                <div className="grid gap-3">
                  {pendingItems.map((item) => (
                    <div
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[#eaded1] pb-3 text-sm last:border-b-0 last:pb-0"
                      key={item.id}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2.5 rounded-full border ${pendingSeverityClassName[item.severity]}`}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-[#2b211d]">{item.title}</div>
                        {item.description ? (
                          <p className="mt-1 leading-5 text-[#75665d]">{item.description}</p>
                        ) : null}
                        <Button
                          asChild
                          className="mt-2 h-8 rounded-[4px] border-[#d8c8b9]"
                          size="sm"
                          variant="outline"
                        >
                          <Link href={item.href}>{item.actionLabel}</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        </>
      ) : loading ? (
        <DashboardProgressTable
          dashboardFilters={dashboardFilters}
          emptyText="正在加载看板数据..."
          onFilterChange={setDashboardFilters}
          onPageChange={setDashboardPage}
          onReset={resetDashboardFilters}
          onSubmit={applyDashboardFilters}
          page={dashboardPage}
          progress={[]}
          roles={roles}
        />
      ) : (
        <AdminCard>
          <EmptyState text="看板暂无数据" />
        </AdminCard>
      )}
    </section>
  );
}
