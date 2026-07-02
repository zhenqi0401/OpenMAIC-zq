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
  UserCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const selectClassName =
  'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function normalizeExpiresAt(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function AdminSlice08Panel() {
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = useMemo(() => buildRoleOptions(roles), [roles]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, roleData, inviteData, userData] = await Promise.all([
        client.getDashboard(),
        client.listRoles(),
        client.listInviteCodes(),
        client.listUsers(),
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
      setError(loadError instanceof Error ? loadError.message : '后台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function loadDashboard() {
    setError(null);
    try {
      setDashboard(
        await client.getDashboard({
          userId: dashboardFilters.userId,
          roleId: dashboardFilters.roleId,
          courseId: dashboardFilters.courseId,
        }),
      );
      setMessage('看板已刷新');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '看板刷新失败');
    }
  }

  async function createRole() {
    if (!newRole.code.trim() || !newRole.name.trim()) {
      setMessage('角色标识和名称必填');
      return;
    }
    try {
      await client.createRole({
        code: newRole.code.trim(),
        name: newRole.name.trim(),
        isAdmin: newRole.isAdmin,
      });
      setNewRole({ code: '', name: '', isAdmin: false });
      setMessage('角色已创建');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '角色创建失败');
    }
  }

  async function saveRole(roleId: string) {
    const draft = roleDrafts[roleId];
    if (!draft) return;
    try {
      await client.updateRole(roleId, draft);
      setMessage('角色已保存');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '角色保存失败');
    }
  }

  async function createInviteCode() {
    if (!newInvite.code.trim() || !newInvite.roleId) {
      setMessage('邀请码明文和绑定角色必填');
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
      setMessage('邀请码已创建，列表按后端安全规则不展示明文');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '邀请码创建失败');
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
      setMessage('邀请码已保存');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '邀请码保存失败');
    }
  }

  async function saveUserRole(user: AdminUser) {
    const roleId = userRoleDrafts[user.id];
    if (!roleId) return;
    try {
      await client.updateUserRole(user.id, roleId);
      setMessage('用户角色已更新');
      await loadAll();
    } catch (saveError) {
      setUserRoleDrafts((drafts) => ({ ...drafts, [user.id]: user.role.id }));
      setError(saveError instanceof Error ? saveError.message : '用户角色更新失败');
    }
  }

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          {error ?? message}
        </div>
      )}

      <section className="space-y-4">
        <SectionTitle
          icon={<BarChart3 className="size-4" />}
          subtitle="课程完成、测评通过和阶段考核概览"
          title="看板"
        />
        {loading && !dashboard ? (
          <EmptyState text="正在加载看板数据..." />
        ) : dashboard ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="课程完成率" value={percent(dashboard.summary.courseCompletionRate)} />
              <Metric label="测评通过率" value={percent(dashboard.summary.assessmentPassRate)} />
              <Metric label="阶段考核通过率" value={percent(dashboard.summary.examPassRate)} />
            </div>
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                placeholder="按用户 ID 筛选"
                value={dashboardFilters.userId}
                onChange={(event) =>
                  setDashboardFilters((filters) => ({ ...filters, userId: event.target.value }))
                }
              />
              <select
                className={selectClassName}
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
                placeholder="按课程 ID 筛选"
                value={dashboardFilters.courseId}
                onChange={(event) =>
                  setDashboardFilters((filters) => ({ ...filters, courseId: event.target.value }))
                }
              />
              <Button onClick={loadDashboard} variant="outline">
                <RefreshCw className="size-4" />
                刷新
              </Button>
            </div>
            <DashboardProgressTable progress={dashboard.progress} />
          </>
        ) : (
          <EmptyState text="看板暂无数据" />
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle
          icon={<Shield className="size-4" />}
          subtitle="维护角色标识、名称和管理员权限"
          title="角色"
        />
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_1fr_auto_auto]">
          <Input
            placeholder="角色标识 code"
            value={newRole.code}
            onChange={(event) => setNewRole((draft) => ({ ...draft, code: event.target.value }))}
          />
          <Input
            placeholder="角色名称"
            value={newRole.name}
            onChange={(event) => setNewRole((draft) => ({ ...draft, name: event.target.value }))}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              checked={newRole.isAdmin}
              onChange={(event) =>
                setNewRole((draft) => ({ ...draft, isAdmin: event.target.checked }))
              }
              type="checkbox"
            />
            管理员
          </label>
          <Button onClick={createRole}>
            <Plus className="size-4" />
            新建
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {roles.length === 0 ? (
            <EmptyState text="暂无角色" />
          ) : (
            roles.map((role) => {
              const draft = roleDrafts[role.id] ?? role;
              return (
                <div
                  className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800 md:grid-cols-[1fr_1fr_auto_auto]"
                  key={role.id}
                >
                  <Input
                    value={draft.code}
                    onChange={(event) =>
                      setRoleDrafts((drafts) => ({
                        ...drafts,
                        [role.id]: { ...draft, code: event.target.value },
                      }))
                    }
                  />
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      setRoleDrafts((drafts) => ({
                        ...drafts,
                        [role.id]: { ...draft, name: event.target.value },
                      }))
                    }
                  />
                  <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
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
      </section>

      <section className="space-y-4">
        <SectionTitle
          icon={<KeyRound className="size-4" />}
          subtitle="创建、启停并绑定角色；列表不假设保存明文邀请码"
          title="邀请码"
        />
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <Input
            placeholder="新邀请码明文"
            value={newInvite.code}
            onChange={(event) => setNewInvite((draft) => ({ ...draft, code: event.target.value }))}
          />
          <select
            className={selectClassName}
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
            type="datetime-local"
            value={newInvite.expiresAt}
            onChange={(event) =>
              setNewInvite((draft) => ({ ...draft, expiresAt: event.target.value }))
            }
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              checked={newInvite.enabled}
              onChange={(event) =>
                setNewInvite((draft) => ({ ...draft, enabled: event.target.checked }))
              }
              type="checkbox"
            />
            启用
          </label>
          <Button onClick={createInviteCode}>
            <Plus className="size-4" />
            新建
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
                  className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800 md:grid-cols-[0.8fr_1.2fr_1fr_1fr_auto_auto]"
                  key={inviteCode.id}
                >
                  <StatusBadge status={view.status} />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {view.roleLabel}
                    </div>
                    <div className="text-xs text-slate-500">明文仅创建时输入，不在列表展示</div>
                  </div>
                  <select
                    className={selectClassName}
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
                    type="datetime-local"
                    value={draft.expiresAt}
                    onChange={(event) =>
                      setInviteDrafts((drafts) => ({
                        ...drafts,
                        [inviteCode.id]: { ...draft, expiresAt: event.target.value },
                      }))
                    }
                  />
                  <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
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
                  <Button
                    onClick={() => saveInviteCode(inviteCode.id)}
                    size="icon"
                    title="保存邀请码"
                  >
                    <Save className="size-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          icon={<UserCog className="size-4" />}
          subtitle="用户当前角色通过角色列表下拉修改"
          title="用户"
        />
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {users.length === 0 ? (
            <EmptyState text="暂无用户" />
          ) : (
            users.map((user) => (
              <div
                className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]"
                key={user.id}
              >
                <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Users className="size-4 text-slate-400" />
                  {user.displayName}
                </span>
                <span className="text-slate-500">{user.phone ?? '-'}</span>
                <span className="truncate text-slate-500">{user.hostUserId ?? '-'}</span>
                <select
                  className={selectClassName}
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
      </section>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <CheckCircle2 className="size-4" />
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function DashboardProgressTable({ progress }: { progress: AdminDashboard['progress'] }) {
  if (progress.length === 0) return <EmptyState text="暂无学员明细" />;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_1fr] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:border-slate-800">
        <span>学员</span>
        <span>角色</span>
        <span>课程</span>
        <span>完成</span>
        <span>更新时间</span>
      </div>
      {progress.map((row) => (
        <div
          className="grid grid-cols-[1fr_1fr_1fr_0.8fr_1fr] gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800"
          key={`${row.userId}-${row.courseId}`}
        >
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.displayName}</span>
          <span className="text-slate-500">{row.roleCode}</span>
          <span className="text-slate-500">{row.courseName}</span>
          <span className="text-slate-500">{row.completed ? '已完成' : '未完成'}</span>
          <span className="text-slate-500">{new Date(row.updatedAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'disabled' | 'expired' }) {
  const label = status === 'active' ? '启用中' : status === 'disabled' ? '已停用' : '已过期';
  const className =
    status === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300';

  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-md border px-2 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
