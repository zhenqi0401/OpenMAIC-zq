'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import {
  AdminCard,
  AdminSectionHeader,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  buildRoleOptions,
  createAdminClient,
  type AdminDashboard,
  type AdminInviteCode,
  type AdminRole,
  type AdminUser,
} from '@/lib/admin/client';
import { paginateAdminRows } from '@/lib/admin/pagination';

interface DashboardFilters {
  userId: string;
  roleId: string;
  courseId: string;
}

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

function clampDashboardPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function formatDashboardPercent(value: number): string {
  return `${clampDashboardPercent(value)}%`;
}

export function toDashboardProgressRatio(value: number): number {
  return clampDashboardPercent(value) / 100;
}

function notifyAdminError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback);
}

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

  const roleOptions = useMemo(() => buildRoleOptions(roles), [roles]);
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

  async function loadDashboard(filters = dashboardFilters) {
    try {
      setDashboard(
        await client.getDashboard({
          userId: filters.userId,
          roleId: filters.roleId,
          courseId: filters.courseId,
        }),
      );
      toast.success('看板已刷新');
    } catch (loadError) {
      notifyAdminError(loadError, '看板刷新失败');
    }
  }

  function applyDashboardFilters() {
    setDashboardPage(1);
    void loadDashboard();
  }

  function resetDashboardFilters() {
    const emptyFilters = { userId: '', roleId: '', courseId: '' };
    setDashboardFilters(emptyFilters);
    setDashboardPage(1);
    void loadDashboard(emptyFilters);
  }

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
      {dashboard ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <DashboardMetric
              label="课程完成率"
              value={formatDashboardPercent(dashboard.summary.courseCompletionRate)}
              progress={toDashboardProgressRatio(dashboard.summary.courseCompletionRate)}
              note="已完成人数 / 已开始学习人数"
            />
            <DashboardMetric
              label="测评通过率"
              value={formatDashboardPercent(dashboard.summary.assessmentPassRate)}
              progress={toDashboardProgressRatio(dashboard.summary.assessmentPassRate)}
              note={`测评 ${dashboard.summary.assessmentAttemptCount} 次`}
            />
            <DashboardMetric
              label="阶段考核通过率"
              value={formatDashboardPercent(dashboard.summary.examPassRate)}
              progress={toDashboardProgressRatio(dashboard.summary.examPassRate)}
              note={`考核 ${dashboard.summary.examAttemptCount} 次`}
            />
            <DashboardMetric
              label="待处理事项"
              value={String(pendingItems.length)}
              progress={pendingItems.length === 0 ? 0 : Math.min(pendingItems.length / 8, 1)}
              note={`课程 ${dashboard.summary.courseCount} 门`}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
            <DashboardProgressTable
              dashboardFilters={dashboardFilters}
              emptyText="当前筛选无学员明细"
              onFilterChange={setDashboardFilters}
              onPageChange={setDashboardPage}
              onReset={resetDashboardFilters}
              onSubmit={applyDashboardFilters}
              page={dashboardPage}
              progress={dashboard.progress}
              roleOptions={roleOptions}
            />
            <AdminCard className="p-4">
              <div className="mb-3">
                <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
                  需要处理
                </div>
                <p className="mt-1 text-sm text-[#75665d]">不把筛选做成主角，优先呈现下一步。</p>
              </div>
              {pendingItems.length === 0 ? (
                <EmptyState text="暂无待处理事项" />
              ) : (
                <div className="grid gap-3">
                  {pendingItems.map((item) => (
                    <div
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[#eaded1] pb-3 text-sm last:border-b-0 last:pb-0"
                      key={item}
                    >
                      <span className="mt-1.5 size-2.5 rounded-full border border-[#9b5b47] bg-[#c96f54]" />
                      <span>{item}</span>
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
          roleOptions={roleOptions}
        />
      ) : (
        <AdminCard>
          <EmptyState text="看板暂无数据" />
        </AdminCard>
      )}
    </section>
  );
}

function DashboardMetric({
  label,
  value,
  progress,
  note,
}: {
  label: string;
  value: string;
  progress: number;
  note: string;
}) {
  const width = `${Math.max(0, Math.min(progress, 1)) * 100}%`;
  return (
    <AdminCard className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
        <span>{label}</span>
        <CheckCircle2 className="size-4 text-[#6f8068]" aria-hidden="true" />
      </div>
      <div className="text-[32px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[#2b211d]">
        {value}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eaded1]">
        <span className="block h-full rounded-full bg-[#c96f54]" style={{ width }} />
      </div>
      <p className="text-sm text-[#75665d]">{note}</p>
    </AdminCard>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-[#75665d]">{text}</div>;
}

function DashboardProgressTable({
  progress,
  emptyText,
  dashboardFilters,
  roleOptions,
  onFilterChange,
  onPageChange,
  onReset,
  onSubmit,
  page,
}: {
  progress: AdminDashboard['progress'];
  emptyText: string;
  dashboardFilters: DashboardFilters;
  roleOptions: ReturnType<typeof buildRoleOptions>;
  onFilterChange: Dispatch<SetStateAction<DashboardFilters>>;
  onPageChange: (page: number) => void;
  onReset: () => void;
  onSubmit: () => void;
  page: number;
}) {
  const pagination = paginateAdminRows(progress, page);
  const hasFilters = Object.values(dashboardFilters).some((value) => value.trim().length > 0);

  return (
    <AdminCard className="overflow-hidden" data-admin-dashboard-progress-panel="true">
      <div className="border-b border-[#d8c8b9] px-4 py-4">
        <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
          学员列表
        </div>
        <p className="mt-1 text-sm text-[#75665d]">先筛选学员、角色或课程，再查看学习明细。</p>
      </div>
      <div className="grid gap-2 border-b border-[#eaded1] p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input
          className={adminInputClassName}
          placeholder="按用户 ID 筛选"
          value={dashboardFilters.userId}
          onChange={(event) =>
            onFilterChange((filters) => ({ ...filters, userId: event.target.value }))
          }
        />
        <select
          className={adminSelectClassName}
          value={dashboardFilters.roleId}
          onChange={(event) =>
            onFilterChange((filters) => ({ ...filters, roleId: event.target.value }))
          }
        >
          <option value="">全部角色</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <Input
          className={adminInputClassName}
          placeholder="按课程 ID 筛选"
          value={dashboardFilters.courseId}
          onChange={(event) =>
            onFilterChange((filters) => ({ ...filters, courseId: event.target.value }))
          }
        />
        <div className="flex gap-2">
          <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" onClick={onSubmit}>
            应用筛选
          </Button>
          {hasFilters ? (
            <Button className="rounded-[4px]" onClick={onReset} variant="outline">
              重置
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto md:overflow-visible">
        <div className="min-w-[760px] md:min-w-0">
          <div className="grid grid-cols-[1fr_0.8fr_1fr_0.7fr_1fr] gap-3 border-b border-[#d8c8b9] px-4 py-3 text-xs font-semibold uppercase text-[#75665d]">
            <span>学员</span>
            <span>角色</span>
            <span>课程</span>
            <span>状态</span>
            <span>最近活动</span>
          </div>
          {pagination.total === 0 ? (
            <EmptyState text={emptyText} />
          ) : (
            pagination.rows.map((row) => (
              <div
                className="grid grid-cols-[1fr_0.8fr_1fr_0.7fr_1fr] gap-3 border-b border-[#eaded1] px-4 py-3 text-sm last:border-b-0"
                key={`${row.userId}-${row.courseId}`}
              >
                <span className="font-medium text-[#2b211d]">{row.displayName}</span>
                <span className="text-[#75665d]">{row.roleCode}</span>
                <span className="text-[#75665d]">{row.courseName}</span>
                <span className="text-[#75665d]">{row.completed ? '已完成' : '未完成'}</span>
                <span className="text-[#75665d]">{new Date(row.updatedAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaded1] px-4 py-3 text-sm text-[#75665d]">
        <span>
          {pagination.total === 0
            ? '显示 0 条，共 0 条'
            : `显示 ${pagination.start}-${pagination.end} 条，共 ${pagination.total} 条`}
        </span>
        <div className="flex items-center gap-3">
          <span>
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              className="rounded-[4px]"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              variant="outline"
            >
              上一页
            </Button>
            <Button
              className="rounded-[4px]"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              variant="outline"
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}

function buildDashboardPendingItems(
  dashboard: AdminDashboard | null,
  roles: readonly AdminRole[],
  inviteCodes: readonly AdminInviteCode[],
  users: readonly AdminUser[],
): string[] {
  const items: string[] = [];
  if (roles.length === 0) items.push('还没有可分配角色，请先创建角色。');
  if (inviteCodes.length === 0) items.push('还没有可用邀请码，学员注册入口不可闭环。');
  if (users.length === 0) items.push('还没有学员或管理员用户记录。');
  if (dashboard && dashboard.progress.length === 0) items.push('当前筛选条件下没有学习进度明细。');
  return items;
}
