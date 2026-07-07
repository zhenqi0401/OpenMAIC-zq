'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import {
  AdminCard,
  AdminSectionHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  buildRoleOptions,
  createAdminClient,
  createUserRoleDrafts,
  getInviteCodeView,
  type AdminDashboard,
  type AdminInviteCode,
  type AdminRole,
  type AdminUser,
} from '@/lib/admin/client';

interface AdminSlice08PanelProps {
  view?: 'all' | 'dashboard' | 'access';
  afterDashboard?: ReactNode;
}

type AdminSlice08View = NonNullable<AdminSlice08PanelProps['view']>;

export function getAdminSlice08LoadPlan(view: AdminSlice08View) {
  return {
    dashboard: view === 'all' || view === 'dashboard',
    roles: true,
    inviteCodes: view === 'all' || view === 'access',
    users: view === 'all' || view === 'access',
  };
}

interface RoleDraft {
  code: string;
  name: string;
  isAdmin: boolean;
}

interface InviteDraft {
  roleId: string;
  enabled: boolean;
  expiresAt: string;
}

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
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

function normalizeExpiresAt(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function notifyAdminError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback);
}

export function AdminSlice08Panel({ view = 'all', afterDashboard }: AdminSlice08PanelProps) {
  const client = useMemo(() => createAdminClient(), []);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [inviteDrafts, setInviteDrafts] = useState<Record<string, InviteDraft>>({});
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, string>>({});
  const [newRole, setNewRole] = useState<RoleDraft>({ code: '', name: '', isAdmin: false });
  const [newInvite, setNewInvite] = useState({
    code: '',
    roleId: '',
    enabled: true,
    expiresAt: '',
  });
  const [dashboardFilters, setDashboardFilters] = useState({
    userId: '',
    roleId: '',
    courseId: '',
  });
  const [loading, setLoading] = useState(true);

  const roleOptions = useMemo(() => buildRoleOptions(roles), [roles]);
  const loadPlan = useMemo(() => getAdminSlice08LoadPlan(view), [view]);
  const pendingItems = useMemo(
    () => buildDashboardPendingItems(dashboard, roles, inviteCodes, users),
    [dashboard, roles, inviteCodes, users],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardData, roleData, inviteData, userData] = await Promise.all([
        loadPlan.dashboard ? client.getDashboard() : Promise.resolve<AdminDashboard | null>(null),
        client.listRoles(),
        loadPlan.inviteCodes ? client.listInviteCodes() : Promise.resolve<AdminInviteCode[]>([]),
        loadPlan.users ? client.listUsers() : Promise.resolve<AdminUser[]>([]),
      ]);
      setDashboard(dashboardData);
      setRoles(roleData);
      setInviteCodes(inviteData);
      setUsers(userData);
      setRoleDrafts(
        Object.fromEntries(
          roleData.map((role) => [
            role.id,
            { code: role.code, name: role.name, isAdmin: role.isAdmin },
          ]),
        ),
      );
      setInviteDrafts(
        Object.fromEntries(
          inviteData.map((inviteCode) => [
            inviteCode.id,
            {
              roleId: inviteCode.roleId,
              enabled: inviteCode.enabled,
              expiresAt: toDatetimeLocal(inviteCode.expiresAt),
            },
          ]),
        ),
      );
      setUserRoleDrafts(createUserRoleDrafts(userData));
      setNewInvite((draft) => ({ ...draft, roleId: draft.roleId || roleData[0]?.id || '' }));
    } catch (loadError) {
      notifyAdminError(loadError, '后台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [client, loadPlan]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function loadDashboard() {
    try {
      setDashboard(
        await client.getDashboard({
          userId: dashboardFilters.userId,
          roleId: dashboardFilters.roleId,
          courseId: dashboardFilters.courseId,
        }),
      );
      toast.success('看板已刷新');
    } catch (loadError) {
      notifyAdminError(loadError, '看板刷新失败');
    }
  }

  async function createRole() {
    if (!newRole.code.trim() || !newRole.name.trim()) {
      toast.error('角色标识和名称必填');
      return;
    }
    try {
      await client.createRole({
        code: newRole.code.trim(),
        name: newRole.name.trim(),
        isAdmin: newRole.isAdmin,
      });
      setNewRole({ code: '', name: '', isAdmin: false });
      toast.success('角色已创建');
      await loadAll();
    } catch (saveError) {
      notifyAdminError(saveError, '角色创建失败');
    }
  }

  async function saveRole(roleId: string) {
    const draft = roleDrafts[roleId];
    if (!draft) return;
    try {
      await client.updateRole(roleId, draft);
      toast.success('角色已保存');
      await loadAll();
    } catch (saveError) {
      notifyAdminError(saveError, '角色保存失败');
    }
  }

  async function createInviteCode() {
    if (!newInvite.code.trim() || !newInvite.roleId) {
      toast.error('邀请码明文和绑定角色必填');
      return;
    }
    try {
      await client.createInviteCode({
        code: newInvite.code.trim(),
        roleId: newInvite.roleId,
        enabled: newInvite.enabled,
        expiresAt: normalizeExpiresAt(newInvite.expiresAt),
      });
      setNewInvite({
        code: '',
        roleId: roles[0]?.id || '',
        enabled: true,
        expiresAt: '',
      });
      toast.success('邀请码已创建。列表按后端安全规则不展示明文。');
      await loadAll();
    } catch (saveError) {
      notifyAdminError(saveError, '邀请码创建失败');
    }
  }

  async function saveInviteCode(inviteCodeId: string) {
    const draft = inviteDrafts[inviteCodeId];
    if (!draft) return;
    try {
      await client.updateInviteCode(inviteCodeId, {
        roleId: draft.roleId,
        enabled: draft.enabled,
        expiresAt: normalizeExpiresAt(draft.expiresAt),
      });
      toast.success('邀请码已保存');
      await loadAll();
    } catch (saveError) {
      notifyAdminError(saveError, '邀请码保存失败');
    }
  }

  async function saveUserRole(user: AdminUser) {
    const roleId = userRoleDrafts[user.id];
    if (!roleId) return;
    try {
      await client.updateUserRole(user.id, roleId);
      toast.success('用户角色已更新');
      await loadAll();
    } catch (saveError) {
      setUserRoleDrafts((drafts) => ({ ...drafts, [user.id]: user.role.id }));
      notifyAdminError(saveError, '用户角色更新失败');
    }
  }

  const showDashboard = view === 'all' || view === 'dashboard';
  const showAccess = view === 'all' || view === 'access';

  return (
    <div className="space-y-6">
      {showDashboard && (
        <section className="scroll-mt-4 space-y-4" id="admin-dashboard">
          <AdminSectionHeader
            action={
              <Button
                className="rounded-[4px] border-[#d8c8b9]"
                onClick={loadDashboard}
                variant="outline"
              >
                <RefreshCw className="size-4" />
                刷新看板
              </Button>
            }
            description="课程完成、测评通过、阶段考核和待处理事项集中在首屏。"
            eyebrow="Dashboard"
            icon={<BarChart3 className="size-4" />}
            title="运营状态一眼看清"
          />
          {loading && !dashboard ? (
            <AdminCard>
              <EmptyState text="正在加载看板数据..." />
            </AdminCard>
          ) : dashboard ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric
                  label="课程完成率"
                  value={formatDashboardPercent(dashboard.summary.courseCompletionRate)}
                  progress={toDashboardProgressRatio(dashboard.summary.courseCompletionRate)}
                  note={`学员 ${dashboard.summary.learnerCount} 人`}
                />
                <Metric
                  label="测评通过率"
                  value={formatDashboardPercent(dashboard.summary.assessmentPassRate)}
                  progress={toDashboardProgressRatio(dashboard.summary.assessmentPassRate)}
                  note={`测评 ${dashboard.summary.assessmentAttemptCount} 次`}
                />
                <Metric
                  label="阶段考核通过率"
                  value={formatDashboardPercent(dashboard.summary.examPassRate)}
                  progress={toDashboardProgressRatio(dashboard.summary.examPassRate)}
                  note={`考核 ${dashboard.summary.examAttemptCount} 次`}
                />
                <Metric
                  label="待处理事项"
                  value={String(pendingItems.length)}
                  progress={pendingItems.length === 0 ? 0 : Math.min(pendingItems.length / 8, 1)}
                  note={`课程 ${dashboard.summary.courseCount} 门`}
                />
              </div>
              <AdminCard className="grid gap-2 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  className={adminInputClassName}
                  placeholder="按用户 ID 筛选"
                  value={dashboardFilters.userId}
                  onChange={(event) =>
                    setDashboardFilters((filters) => ({ ...filters, userId: event.target.value }))
                  }
                />
                <select
                  className={adminSelectClassName}
                  value={dashboardFilters.roleId}
                  onChange={(event) =>
                    setDashboardFilters((filters) => ({ ...filters, roleId: event.target.value }))
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
                    setDashboardFilters((filters) => ({ ...filters, courseId: event.target.value }))
                  }
                />
                <Button
                  className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
                  onClick={loadDashboard}
                >
                  应用筛选
                </Button>
              </AdminCard>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
                <DashboardProgressTable progress={dashboard.progress} />
                <AdminCard className="p-4">
                  <div className="mb-3">
                    <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
                      需要处理
                    </div>
                    <p className="mt-1 text-sm text-[#75665d]">
                      不把筛选做成主角，优先呈现下一步。
                    </p>
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
          ) : (
            <AdminCard>
              <EmptyState text="看板暂无数据" />
            </AdminCard>
          )}
        </section>
      )}

      {afterDashboard}

      {showAccess && (
        <section className="scroll-mt-4 space-y-4" id="admin-access">
        <AdminSectionHeader
          description="集中维护角色、邀请码和用户角色，不绕过后端安全规则。"
          eyebrow="Access"
          icon={<Shield className="size-4" />}
          title="访问与角色"
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <AdminCard className="space-y-3 p-4">
            <div className="text-sm font-semibold text-[#2b211d]">角色维护</div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
              <Input
                className={adminInputClassName}
                placeholder="角色标识 code"
                value={newRole.code}
                onChange={(event) =>
                  setNewRole((draft) => ({ ...draft, code: event.target.value }))
                }
              />
              <Input
                className={adminInputClassName}
                placeholder="角色名称"
                value={newRole.name}
                onChange={(event) =>
                  setNewRole((draft) => ({ ...draft, name: event.target.value }))
                }
              />
              <label className="inline-flex items-center gap-2 text-sm text-[#75665d]">
                <input
                  checked={newRole.isAdmin}
                  onChange={(event) =>
                    setNewRole((draft) => ({ ...draft, isAdmin: event.target.checked }))
                  }
                  type="checkbox"
                />
                管理员
              </label>
              <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" onClick={createRole}>
                <Plus className="size-4" />
                新建
              </Button>
            </div>
            <div className="overflow-x-auto md:overflow-visible">
              <div className="min-w-[680px] divide-y divide-[#eaded1] md:min-w-0">
                {roles.length === 0 ? (
                  <EmptyState text="暂无角色" />
                ) : (
                  roles.map((role) => {
                    const draft = roleDrafts[role.id] ?? role;
                    return (
                      <div
                        className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 py-3 text-sm"
                        key={role.id}
                      >
                        <Input
                          className={adminInputClassName}
                          value={draft.code}
                          onChange={(event) =>
                            setRoleDrafts((drafts) => ({
                              ...drafts,
                              [role.id]: { ...draft, code: event.target.value },
                            }))
                          }
                        />
                        <Input
                          className={adminInputClassName}
                          value={draft.name}
                          onChange={(event) =>
                            setRoleDrafts((drafts) => ({
                              ...drafts,
                              [role.id]: { ...draft, name: event.target.value },
                            }))
                          }
                        />
                        <label className="inline-flex items-center gap-2 text-[#75665d]">
                          <input
                            checked={draft.isAdmin}
                            onChange={(event) =>
                              setRoleDrafts((drafts) => ({
                                ...drafts,
                                [role.id]: { ...draft, isAdmin: event.target.checked },
                              }))
                            }
                            type="checkbox"
                          />
                          管理员
                        </label>
                        <Button onClick={() => saveRole(role.id)} size="icon" title="保存角色">
                          <Save className="size-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AdminCard>

          <AdminCard className="space-y-3 p-4">
            <div className="text-sm font-semibold text-[#2b211d]">用户角色</div>
            <div className="overflow-x-auto md:overflow-visible">
              <div className="min-w-[720px] divide-y divide-[#eaded1] md:min-w-0">
                {users.length === 0 ? (
                  <EmptyState text="暂无用户" />
                ) : (
                  users.map((user) => (
                    <div
                      className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] items-center gap-3 py-3 text-sm"
                      key={user.id}
                    >
                      <span className="flex items-center gap-2 font-medium text-[#2b211d]">
                        <Users className="size-4 text-[#9b897d]" />
                        {user.displayName}
                      </span>
                      <span className="text-[#75665d]">{user.phone ?? '-'}</span>
                      <span className="truncate text-[#75665d]">{user.hostUserId ?? '-'}</span>
                      <select
                        className={adminSelectClassName}
                        value={userRoleDrafts[user.id] ?? user.role.id}
                        onChange={(event) =>
                          setUserRoleDrafts((drafts) => ({
                            ...drafts,
                            [user.id]: event.target.value,
                          }))
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <Button onClick={() => saveUserRole(user)} variant="outline">
                        <Save className="size-4" />
                        保存
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdminCard>
        </div>

        <AdminCard className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2b211d]">
            <KeyRound className="size-4 text-[#9b897d]" />
            邀请码维护
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Input
              className={adminInputClassName}
              placeholder="新邀请码明文"
              value={newInvite.code}
              onChange={(event) =>
                setNewInvite((draft) => ({ ...draft, code: event.target.value }))
              }
            />
            <select
              className={adminSelectClassName}
              value={newInvite.roleId}
              onChange={(event) =>
                setNewInvite((draft) => ({ ...draft, roleId: event.target.value }))
              }
            >
              <option value="">绑定角色</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <Input
              className={adminInputClassName}
              type="datetime-local"
              value={newInvite.expiresAt}
              onChange={(event) =>
                setNewInvite((draft) => ({ ...draft, expiresAt: event.target.value }))
              }
            />
            <label className="inline-flex items-center gap-2 text-sm text-[#75665d]">
              <input
                checked={newInvite.enabled}
                onChange={(event) =>
                  setNewInvite((draft) => ({ ...draft, enabled: event.target.checked }))
                }
                type="checkbox"
              />
              启用
            </label>
            <Button
              className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
              onClick={createInviteCode}
            >
              <Plus className="size-4" />
              新建
            </Button>
          </div>
          <div className="overflow-x-auto md:overflow-visible">
            <div className="min-w-[840px] divide-y divide-[#eaded1] md:min-w-0">
              {inviteCodes.length === 0 ? (
                <EmptyState text="暂无邀请码" />
              ) : (
                inviteCodes.map((inviteCode) => {
                  const view = getInviteCodeView(inviteCode, roles);
                  const draft = inviteDrafts[inviteCode.id] ?? {
                    roleId: inviteCode.roleId,
                    enabled: inviteCode.enabled,
                    expiresAt: toDatetimeLocal(inviteCode.expiresAt),
                  };
                  return (
                    <div
                      className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr_auto_auto] items-center gap-3 py-3 text-sm"
                      key={inviteCode.id}
                    >
                      <StatusBadge status={view.status} />
                      <div>
                        <div className="font-medium text-[#2b211d]">{view.roleLabel}</div>
                        <div className="text-xs text-[#75665d]">明文仅创建时输入，不在列表展示</div>
                      </div>
                      <select
                        className={adminSelectClassName}
                        value={draft.roleId}
                        onChange={(event) =>
                          setInviteDrafts((drafts) => ({
                            ...drafts,
                            [inviteCode.id]: { ...draft, roleId: event.target.value },
                          }))
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        className={adminInputClassName}
                        type="datetime-local"
                        value={draft.expiresAt}
                        onChange={(event) =>
                          setInviteDrafts((drafts) => ({
                            ...drafts,
                            [inviteCode.id]: { ...draft, expiresAt: event.target.value },
                          }))
                        }
                      />
                      <label className="inline-flex items-center gap-2 text-[#75665d]">
                        <input
                          checked={draft.enabled}
                          onChange={(event) =>
                            setInviteDrafts((drafts) => ({
                              ...drafts,
                              [inviteCode.id]: { ...draft, enabled: event.target.checked },
                            }))
                          }
                          type="checkbox"
                        />
                        启用
                      </label>
                      <Button onClick={() => saveInviteCode(inviteCode.id)} size="icon">
                        <Save className="size-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </AdminCard>
        </section>
      )}
    </div>
  );
}

function Metric({
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

function DashboardProgressTable({ progress }: { progress: AdminDashboard['progress'] }) {
  if (progress.length === 0) {
    return (
      <AdminCard>
        <EmptyState text="当前筛选无学员明细" />
      </AdminCard>
    );
  }

  return (
    <AdminCard className="overflow-hidden">
      <div className="overflow-x-auto md:overflow-visible">
        <div className="min-w-[760px] md:min-w-0">
          <div className="grid grid-cols-[1fr_0.8fr_1fr_0.7fr_1fr] gap-3 border-b border-[#d8c8b9] px-4 py-3 text-xs font-semibold uppercase text-[#75665d]">
            <span>学员</span>
            <span>角色</span>
            <span>课程</span>
            <span>状态</span>
            <span>最近活动</span>
          </div>
          {progress.map((row) => (
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
          ))}
        </div>
      </div>
    </AdminCard>
  );
}

function StatusBadge({ status }: { status: 'active' | 'disabled' | 'expired' }) {
  const label = status === 'active' ? '启用中' : status === 'disabled' ? '已停用' : '已过期';
  const tone = status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'neutral';
  return <AdminStatusBadge tone={tone}>{label}</AdminStatusBadge>;
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
