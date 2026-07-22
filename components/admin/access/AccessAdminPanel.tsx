'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { AdminPage, AdminSectionHeader } from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { Button } from '@/components/ui/button';
import { adminErrorMessage, adminToast } from '@/lib/admin/toast';
import {
  buildRoleOptions,
  createAdminClient,
  createUserRoleDrafts,
  type AdminInviteCode,
  type AdminRole,
  type AdminUser,
} from '@/lib/admin/client';
import { AccessInvitesTab, type InviteDraft } from './AccessInvitesTab';
import { AccessRolesTab, type RoleDraft } from './AccessRolesTab';
import { AccessUsersTab } from './AccessUsersTab';

export type AccessSection = 'users' | 'roles' | 'invites';

const accessTabs = [
  { value: 'users', label: '用户' },
  { value: 'roles', label: '角色' },
  { value: 'invites', label: '邀请码' },
] as const;

type AccessAdminClient = Pick<
  ReturnType<typeof createAdminClient>,
  'listRoles' | 'listInviteCodes' | 'listUsers'
>;

export function resolveAccessSection(value: string | null | undefined): AccessSection {
  return value === 'roles' || value === 'invites' ? value : 'users';
}

export function buildAccessSectionUrl(search: string, section: AccessSection): string {
  const params = new URLSearchParams(search);
  params.set('module', 'access');
  params.set('section', section);
  return `/admin?${params.toString()}`;
}

export async function loadAccessAdminData(client: AccessAdminClient) {
  const [roles, inviteCodes, users] = await Promise.all([
    client.listRoles(),
    client.listInviteCodes(),
    client.listUsers(),
  ]);

  return { roles, inviteCodes, users };
}

function normalizeExpiresAt(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function notifyAdminError(error: unknown, fallback: string) {
  adminToast.error(adminErrorMessage(error, fallback));
}

export function AccessAdminPanel({
  initialSection = 'users',
}: {
  initialSection?: AccessSection;
} = {}) {
  const client = useMemo(() => createAdminClient(), []);
  const [section, setSection] = useState<AccessSection>(initialSection);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatingRole, setCreatingRole] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [savingInviteCodeId, setSavingInviteCodeId] = useState<string | null>(null);
  const [deletingInviteCodeId, setDeletingInviteCodeId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userRolePage, setUserRolePage] = useState(1);

  const roleOptions = useMemo(() => buildRoleOptions(roles), [roles]);

  const loadAll = useCallback(
    async (notify = false) => {
      setLoading(true);
      try {
        const data = await loadAccessAdminData(client);
        setRoles(data.roles);
        setInviteCodes(data.inviteCodes);
        setUsers(data.users);
        setUserRoleDrafts(createUserRoleDrafts(data.users));
        if (notify) adminToast.success('用户管理数据已刷新');
      } catch (loadError) {
        notifyAdminError(loadError, '后台数据加载失败');
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    function syncSectionFromUrl() {
      setSection(resolveAccessSection(new URLSearchParams(window.location.search).get('section')));
    }

    syncSectionFromUrl();
    window.addEventListener('popstate', syncSectionFromUrl);
    return () => window.removeEventListener('popstate', syncSectionFromUrl);
  }, []);

  function changeSection(nextSection: AccessSection) {
    setSection(nextSection);
    setUserRolePage(1);
    if (typeof window !== 'undefined') {
      window.history.pushState(
        null,
        '',
        buildAccessSectionUrl(window.location.search, nextSection),
      );
    }
  }

  async function createRole(draft: RoleDraft): Promise<boolean> {
    if (!draft.code.trim() || !draft.name.trim()) {
      adminToast.error('角色标识和名称必填');
      return false;
    }
    setCreatingRole(true);
    try {
      await client.createRole({
        code: draft.code.trim(),
        name: draft.name.trim(),
        isAdmin: draft.isAdmin,
      });
      adminToast.success('角色已创建');
      await loadAll();
      return true;
    } catch (saveError) {
      notifyAdminError(saveError, '角色创建失败');
      return false;
    } finally {
      setCreatingRole(false);
    }
  }

  async function saveRole(roleId: string, draft: RoleDraft): Promise<boolean> {
    if (!draft.code.trim() || !draft.name.trim()) {
      adminToast.error('角色标识和名称必填');
      return false;
    }
    setSavingRoleId(roleId);
    try {
      await client.updateRole(roleId, {
        code: draft.code.trim(),
        name: draft.name.trim(),
        isAdmin: draft.isAdmin,
      });
      adminToast.success('角色已保存');
      await loadAll();
      return true;
    } catch (saveError) {
      notifyAdminError(saveError, '角色保存失败');
      return false;
    } finally {
      setSavingRoleId(null);
    }
  }

  async function deleteRole(role: AdminRole) {
    setDeletingRoleId(role.id);
    try {
      await client.deleteRole(role.id);
      adminToast.success('角色已删除');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '角色删除失败');
    } finally {
      setDeletingRoleId(null);
    }
  }

  async function createInviteCode(draft: InviteDraft): Promise<boolean> {
    setCreatingInvite(true);
    try {
      await client.createInviteCode({
        code: draft.code,
        roleId: draft.roleId,
        enabled: draft.enabled,
        expiresAt: normalizeExpiresAt(draft.expiresAt),
      });
      adminToast.success('邀请码已创建。请妥善保存明文，列表不会再次展示。');
      await loadAll();
      return true;
    } catch (saveError) {
      notifyAdminError(saveError, '邀请码创建失败');
      return false;
    } finally {
      setCreatingInvite(false);
    }
  }

  async function saveInviteCode(
    inviteCodeId: string,
    draft: Omit<InviteDraft, 'code'>,
  ): Promise<boolean> {
    setSavingInviteCodeId(inviteCodeId);
    try {
      await client.updateInviteCode(inviteCodeId, {
        roleId: draft.roleId,
        enabled: draft.enabled,
        expiresAt: normalizeExpiresAt(draft.expiresAt),
      });
      adminToast.success('邀请码已保存');
      await loadAll();
      return true;
    } catch (saveError) {
      notifyAdminError(saveError, '邀请码保存失败');
      return false;
    } finally {
      setSavingInviteCodeId(null);
    }
  }

  async function deleteInviteCode(inviteCode: AdminInviteCode) {
    setDeletingInviteCodeId(inviteCode.id);
    try {
      await client.deleteInviteCode(inviteCode.id);
      adminToast.success('邀请码已撤销');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '邀请码撤销失败');
    } finally {
      setDeletingInviteCodeId(null);
    }
  }

  async function saveUserRole(user: AdminUser) {
    const roleId = userRoleDrafts[user.id];
    if (!roleId) return;
    setSavingUserId(user.id);
    try {
      await client.updateUserRole(user.id, roleId);
      adminToast.success('用户角色已更新');
      await loadAll();
    } catch (saveError) {
      // Deliberately keep the selected draft so the administrator can retry.
      notifyAdminError(saveError, '用户角色更新失败');
    } finally {
      setSavingUserId(null);
    }
  }

  async function deleteUser(user: AdminUser) {
    setDeletingUserId(user.id);
    try {
      await client.deleteUser(user.id);
      adminToast.success('用户已永久删除');
      await loadAll();
    } catch (deleteError) {
      notifyAdminError(deleteError, '用户删除失败');
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <AdminPage
      className="w-[calc(100vw-1.5rem)] space-y-4 sm:w-[calc(100vw-2rem)] lg:w-auto"
      id="admin-access"
    >
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={
              <Button
                aria-busy={loading}
                className="rounded-[var(--admin-radius-control)] border-[var(--admin-border)]"
                disabled={loading}
                onClick={() => void loadAll(true)}
                variant="outline"
              >
                {loading ? '刷新中…' : '刷新'}
              </Button>
            }
          />
        }
        description="集中管理用户资料、角色分配和邀请码，所有变更继续遵循现有权限规则。"
        eyebrow="User management"
        icon={<Shield className="size-4" />}
        title="用户管理"
      />

      <AdminTabs
        ariaLabel="用户管理工作区"
        items={accessTabs.map((tab) => ({
          ...tab,
          count:
            tab.value === 'users'
              ? users.length
              : tab.value === 'roles'
                ? roles.length
                : inviteCodes.length,
        }))}
        onValueChange={changeSection}
        value={section}
      />

      <div className="min-w-0" data-admin-access-layout>
        {section === 'users' ? (
          <AccessUsersTab
            deletingUserId={deletingUserId}
            loading={loading}
            onDeleteUser={(user) => void deleteUser(user)}
            onPageChange={setUserRolePage}
            onRoleChange={(userId, roleId) =>
              setUserRoleDrafts((drafts) => ({ ...drafts, [userId]: roleId }))
            }
            onSaveUserRole={(user) => void saveUserRole(user)}
            page={userRolePage}
            roleOptions={roleOptions}
            savingUserId={savingUserId}
            userRoleDrafts={userRoleDrafts}
            users={users}
          />
        ) : null}
        {section === 'roles' ? (
          <AccessRolesTab
            creatingRole={creatingRole}
            deletingRoleId={deletingRoleId}
            inviteCodes={inviteCodes}
            loading={loading}
            onCreateRole={createRole}
            onDeleteRole={(role) => void deleteRole(role)}
            onSaveRole={saveRole}
            roles={roles}
            savingRoleId={savingRoleId}
            users={users}
          />
        ) : null}
        {section === 'invites' ? (
          <AccessInvitesTab
            creatingInvite={creatingInvite}
            deletingInviteCodeId={deletingInviteCodeId}
            inviteCodes={inviteCodes}
            loading={loading}
            onCreateInvite={createInviteCode}
            onDeleteInvite={(inviteCode) => void deleteInviteCode(inviteCode)}
            onSaveInvite={saveInviteCode}
            roleOptions={roleOptions}
            roles={roles}
            savingInviteCodeId={savingInviteCodeId}
          />
        ) : null}
      </div>
    </AdminPage>
  );
}
