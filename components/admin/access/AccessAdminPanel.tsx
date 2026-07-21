'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import {
  AdminCard,
  AdminSectionHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminDeleteDialog } from '@/components/admin/AdminDeleteDialog';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  buildRoleOptions,
  createAdminClient,
  createUserRoleDrafts,
  getInviteCodeView,
  type AdminInviteCode,
  type AdminRole,
  type AdminUser,
} from '@/lib/admin/client';
import { paginateAdminRows } from '@/lib/admin/pagination';
import {
  getInviteCodeValidationIssue,
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  normalizeInviteCode,
  type InviteCodeValidationIssue,
} from '@/lib/auth/invite-code';

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

type AccessAdminClient = Pick<
  ReturnType<typeof createAdminClient>,
  'listRoles' | 'listInviteCodes' | 'listUsers'
>;

export async function loadAccessAdminData(client: AccessAdminClient) {
  const [roles, inviteCodes, users] = await Promise.all([
    client.listRoles(),
    client.listInviteCodes(),
    client.listUsers(),
  ]);

  return { roles, inviteCodes, users };
}

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function normalizeExpiresAt(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function notifyAdminError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback);
}

function getInviteCodeValidationMessage(issue: InviteCodeValidationIssue): string {
  if (issue === 'REQUIRED') return '请输入邀请码明文';
  if (issue === 'TOO_SHORT') return `邀请码至少需要 ${INVITE_CODE_MIN_LENGTH} 个字符`;
  return `邀请码不能超过 ${INVITE_CODE_MAX_LENGTH} 个字符`;
}

export function AccessAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
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
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [deletingInviteCodeId, setDeletingInviteCodeId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userRolePage, setUserRolePage] = useState(1);

  const roleOptions = useMemo(() => buildRoleOptions(roles), [roles]);
  const userRolePagination = useMemo(
    () => paginateAdminRows(users, userRolePage),
    [userRolePage, users],
  );

  const loadAll = useCallback(async () => {
    try {
      const data = await loadAccessAdminData(client);
      setRoles(data.roles);
      setInviteCodes(data.inviteCodes);
      setUsers(data.users);
      setRoleDrafts(
        Object.fromEntries(
          data.roles.map((role) => [
            role.id,
            { code: role.code, name: role.name, isAdmin: role.isAdmin },
          ]),
        ),
      );
      setInviteDrafts(
        Object.fromEntries(
          data.inviteCodes.map((inviteCode) => [
            inviteCode.id,
            {
              roleId: inviteCode.roleId,
              enabled: inviteCode.enabled,
              expiresAt: toDatetimeLocal(inviteCode.expiresAt),
            },
          ]),
        ),
      );
      setUserRoleDrafts(createUserRoleDrafts(data.users));
      setNewInvite((draft) => ({
        ...draft,
        roleId: draft.roleId || data.roles[0]?.id || '',
      }));
    } catch (loadError) {
      notifyAdminError(loadError, '后台数据加载失败');
    }
  }, [client]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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

  async function deleteRole(role: AdminRole) {
    setDeletingRoleId(role.id);
    try {
      await client.deleteRole(role.id);
      toast.success('角色已删除');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '角色删除失败');
    } finally {
      setDeletingRoleId(null);
    }
  }

  async function createInviteCode() {
    const inviteCodeIssue = getInviteCodeValidationIssue(newInvite.code);
    if (inviteCodeIssue) {
      toast.error(getInviteCodeValidationMessage(inviteCodeIssue));
      return;
    }
    if (!newInvite.roleId) {
      toast.error('绑定角色必填');
      return;
    }
    try {
      await client.createInviteCode({
        code: normalizeInviteCode(newInvite.code),
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

  async function deleteInviteCode(inviteCode: AdminInviteCode) {
    setDeletingInviteCodeId(inviteCode.id);
    try {
      await client.deleteInviteCode(inviteCode.id);
      toast.success('邀请码已删除');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '邀请码删除失败');
    } finally {
      setDeletingInviteCodeId(null);
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

  async function deleteUser(user: AdminUser) {
    setDeletingUserId(user.id);
    try {
      await client.deleteUser(user.id);
      toast.success('用户已删除');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '用户删除失败');
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <section className="scroll-mt-4 space-y-4" id="admin-access">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={
              <Button
                className="rounded-[4px] border-[#d8c8b9]"
                onClick={loadAll}
                variant="outline"
              >
                刷新
              </Button>
            }
          />
        }
        description="集中维护角色、邀请码和用户角色，不绕过后端安全规则。"
        eyebrow="Access"
        icon={<Shield className="size-4" />}
        title="访问与角色"
      />

      <div className="grid gap-4" data-admin-access-layout>
        <div
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.9fr)]"
          data-admin-access-top
        >
          <AdminCard className="space-y-3 p-4" data-admin-access-roles>
            <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
              角色与用户
            </div>
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
                新建角色
              </Button>
            </div>
            <div className="overflow-x-auto md:overflow-visible">
              <div className="min-w-[680px] divide-y divide-[#eaded1] md:min-w-0">
                <div className="grid grid-cols-[1fr_1fr_auto_minmax(130px,auto)] gap-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
                  <span>角色标识</span>
                  <span>角色名称</span>
                  <span>权限</span>
                  <span className="text-right">操作</span>
                </div>
                {roles.length === 0 ? (
                  <EmptyState text="暂无角色" />
                ) : (
                  roles.map((role) => {
                    const draft = roleDrafts[role.id] ?? role;
                    return (
                      <div
                        className="grid grid-cols-[1fr_1fr_auto_minmax(130px,auto)] items-center gap-3 py-3 text-sm"
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
                        <div className="flex justify-end gap-2">
                          <Button
                            className="rounded-[4px]"
                            onClick={() => saveRole(role.id)}
                            variant="outline"
                          >
                            保存
                          </Button>
                          <AdminDeleteDialog
                            deleting={deletingRoleId === role.id}
                            description={`确认删除角色「${role.name}（${role.code}）」？至少需要保留一个管理员角色；若已有用户、邀请码或阶段考试策略正在使用该角色，需要先迁移或删除关联数据。`}
                            onDelete={() => deleteRole(role)}
                            title="删除角色"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AdminCard>

          <AdminCard className="space-y-3 p-4" data-admin-access-invites>
            <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
              邀请码维护
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <Input
                className={adminInputClassName}
                maxLength={INVITE_CODE_MAX_LENGTH}
                placeholder="新邀请码明文"
                value={newInvite.code}
                onChange={(event) =>
                  setNewInvite((draft) => ({
                    ...draft,
                    code: normalizeInviteCode(event.target.value),
                  }))
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
                className="rounded-[4px] bg-[#c96f54] text-[#fffaf2] md:col-span-2"
                onClick={createInviteCode}
              >
                新建邀请码
              </Button>
            </div>
            <div className="overflow-x-auto" data-admin-access-invite-table>
              <div className="min-w-[900px] divide-y divide-[#eaded1] whitespace-nowrap">
                <div className="grid grid-cols-[0.8fr_1.2fr_1.15fr_1fr_auto_auto] gap-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
                  <span>邀请码状态</span>
                  <span>绑定角色</span>
                  <span>角色选择</span>
                  <span>过期时间</span>
                  <span>启用</span>
                  <span className="text-right">操作</span>
                </div>
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
                        className="grid grid-cols-[0.8fr_1.2fr_1.15fr_1fr_auto_auto] items-center gap-3 py-3 text-sm"
                        key={inviteCode.id}
                      >
                        <StatusBadge status={view.status} />
                        <div>
                          <div className="font-medium text-[#2b211d]">{view.roleLabel}</div>
                        </div>
                        <select
                          className={`${adminSelectClassName} min-w-[150px]`}
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
                          className={`${adminInputClassName} min-w-[132px]`}
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
                        <div className="flex justify-end gap-2">
                          <Button
                            className="rounded-[4px]"
                            onClick={() => saveInviteCode(inviteCode.id)}
                            variant="outline"
                          >
                            保存
                          </Button>
                          <AdminDeleteDialog
                            deleting={deletingInviteCodeId === inviteCode.id}
                            description={`确认删除绑定到「${view.roleLabel}」的邀请码？删除后该邀请码不能再用于注册，且不可恢复。`}
                            onDelete={() => deleteInviteCode(inviteCode)}
                            title="删除邀请码"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </AdminCard>
        </div>

        <AdminCard className="space-y-3 p-4" data-admin-access-user-roles>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
                用户角色
              </div>
              <p className="mt-1 text-sm text-[#75665d]">
                每页 10 条，避免长列表把角色和邀请码维护挤出视线。
              </p>
            </div>
            <div className="text-sm text-[#75665d]">
              第 {userRolePagination.page} / {userRolePagination.totalPages} 页
            </div>
          </div>
          <div className="overflow-x-auto md:overflow-visible">
            <div className="min-w-[720px] divide-y divide-[#eaded1] md:min-w-0">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr_minmax(130px,auto)] gap-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
                <span>学员</span>
                <span>手机号</span>
                <span>外部 ID</span>
                <span>当前角色</span>
                <span className="text-right">操作</span>
              </div>
              {users.length === 0 ? (
                <EmptyState text="暂无用户" />
              ) : (
                userRolePagination.rows.map((user) => (
                  <div
                    className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr_minmax(130px,auto)] items-center gap-3 py-3 text-sm"
                    key={user.id}
                  >
                    <span className="font-medium text-[#2b211d]">{user.displayName}</span>
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
                    <div className="flex justify-end gap-2">
                      <Button
                        className="rounded-[4px]"
                        onClick={() => saveUserRole(user)}
                        variant="outline"
                      >
                        保存
                      </Button>
                      <AdminDeleteDialog
                        deleting={deletingUserId === user.id}
                        description={`确认删除用户「${user.displayName}」？该操作会删除该用户的账号，并清理其学习进度、测评记录和阶段考试记录，且不可恢复。`}
                        onDelete={() => deleteUser(user)}
                        title="删除用户"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaded1] pt-3 text-sm text-[#75665d]">
            <span>
              {userRolePagination.total === 0
                ? '共 0 条'
                : `显示 ${userRolePagination.start}-${userRolePagination.end} 条，共 ${userRolePagination.total} 条`}
            </span>
            <div className="flex gap-2">
              <Button
                className="rounded-[4px]"
                disabled={userRolePagination.page <= 1}
                onClick={() => setUserRolePage(userRolePagination.page - 1)}
                variant="outline"
              >
                上一页
              </Button>
              <Button
                className="rounded-[4px]"
                disabled={userRolePagination.page >= userRolePagination.totalPages}
                onClick={() => setUserRolePage(userRolePagination.page + 1)}
                variant="outline"
              >
                下一页
              </Button>
            </div>
          </div>
        </AdminCard>
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-[#75665d]">{text}</div>;
}

function StatusBadge({ status }: { status: 'active' | 'disabled' | 'expired' }) {
  const label = status === 'active' ? '启用中' : status === 'disabled' ? '已停用' : '已过期';
  const tone = status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'neutral';
  return <AdminStatusBadge tone={tone}>{label}</AdminStatusBadge>;
}
