'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AdminCard,
  AdminStatusBadge,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import type { AdminInviteCode, AdminRole, AdminUser } from '@/lib/admin/client';
import { AccessDangerDialog } from './AccessUsersTab';

export interface RoleDraft {
  code: string;
  name: string;
  isAdmin: boolean;
}

export interface RoleUsageCount {
  userCount: number;
  inviteCount: number;
}

export function getRoleUsageCounts(
  roles: readonly AdminRole[],
  users: readonly AdminUser[],
  inviteCodes: readonly AdminInviteCode[],
): Record<string, RoleUsageCount> {
  return Object.fromEntries(
    roles.map((role) => [
      role.id,
      {
        userCount: users.filter((user) => user.role.id === role.id).length,
        inviteCount: inviteCodes.filter((inviteCode) => inviteCode.roleId === role.id).length,
      },
    ]),
  );
}

function RoleForm({
  draft,
  disabled,
  editMode = false,
  onChange,
  protectCode = false,
}: {
  draft: RoleDraft;
  disabled: boolean;
  editMode?: boolean;
  onChange: (draft: RoleDraft) => void;
  protectCode?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5 text-sm text-[var(--admin-muted-foreground)]">
        <span>角色代码</span>
        <Input
          className={adminInputClassName}
          disabled={disabled || protectCode}
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
          placeholder="例如 ops"
          value={draft.code}
        />
      </label>
      <label className="grid gap-1.5 text-sm text-[var(--admin-muted-foreground)]">
        <span>角色名称</span>
        <Input
          className={adminInputClassName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="例如 运营"
          value={draft.name}
        />
      </label>
      {editMode ? (
        <div className="grid gap-1.5 text-sm text-[var(--admin-muted-foreground)]">
          <span>角色类型</span>
          <strong className="font-medium text-[var(--admin-foreground)]">
            {draft.isAdmin ? '管理员角色' : '普通角色'}
          </strong>
          <span className="text-xs">角色类型在创建后不可修改。</span>
        </div>
      ) : (
        <label className="grid gap-1.5 text-sm text-[var(--admin-muted-foreground)]">
          <span className="inline-flex items-center gap-2">
            <input
              checked={draft.isAdmin}
              disabled={disabled}
              onChange={(event) => onChange({ ...draft, isAdmin: event.target.checked })}
              type="checkbox"
            />
            管理员类型
          </span>
          <span className="text-xs leading-5">
            管理员角色拥有本租户课程、用户、考试和社区的完整管理权限。
          </span>
        </label>
      )}
    </div>
  );
}

function RoleDialog({
  busy,
  draft,
  onDraftChange,
  onOpenChange,
  onSave,
  open,
  protectCode,
  title,
}: {
  busy: boolean;
  draft: RoleDraft;
  onDraftChange: (draft: RoleDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  protectCode: boolean;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...adminThemeAttributes}
        className="max-w-[480px] rounded-[var(--admin-radius-dialog)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">{title}</DialogTitle>
          <DialogDescription className="leading-6 text-[var(--admin-muted-foreground)]">
            仅可修改角色代码和名称；角色类型保持创建时的设置。
          </DialogDescription>
        </DialogHeader>
        <RoleForm
          editMode
          disabled={busy}
          draft={draft}
          onChange={onDraftChange}
          protectCode={protectCode}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className={adminSecondaryButtonClassName}
              disabled={busy}
              type="button"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            aria-busy={busy}
            className={adminPrimaryButtonClassName}
            disabled={busy}
            onClick={onSave}
            type="button"
          >
            {busy ? '保存中…' : '保存角色'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSummary({ count, role }: { count: RoleUsageCount; role: AdminRole }) {
  return (
    <>
      <td className="py-3 pr-3">
        <div className="font-medium text-[var(--admin-foreground)]">{role.name}</div>
        <div className="break-all text-xs text-[var(--admin-muted-foreground)]">{role.code}</div>
      </td>
      <td className="py-3 pr-3">
        <AdminStatusBadge tone={role.isAdmin ? 'warning' : 'neutral'}>
          {role.isAdmin ? '管理员角色' : '普通角色'}
        </AdminStatusBadge>
      </td>
      <td className="py-3 pr-3 text-sm tabular-nums text-[var(--admin-muted-foreground)]">
        {count.userCount}
      </td>
      <td className="py-3 pr-3 text-sm tabular-nums text-[var(--admin-muted-foreground)]">
        {count.inviteCount}
      </td>
    </>
  );
}

export function AccessRolesTab({
  creatingRole,
  deletingRoleId,
  inviteCodes,
  loading,
  onCreateRole,
  onDeleteRole,
  onSaveRole,
  roles,
  savingRoleId,
  users,
}: {
  creatingRole: boolean;
  deletingRoleId: string | null;
  inviteCodes: readonly AdminInviteCode[];
  loading: boolean;
  onCreateRole: (draft: RoleDraft) => Promise<boolean>;
  onDeleteRole: (role: AdminRole) => void;
  onSaveRole: (roleId: string, draft: RoleDraft) => Promise<boolean>;
  roles: readonly AdminRole[];
  savingRoleId: string | null;
  users: readonly AdminUser[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState<RoleDraft>({ code: '', name: '', isAdmin: false });
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editDraft, setEditDraft] = useState<RoleDraft>({ code: '', name: '', isAdmin: false });
  const usageCounts = useMemo(
    () => getRoleUsageCounts(roles, users, inviteCodes),
    [inviteCodes, roles, users],
  );

  function openEdit(role: AdminRole) {
    setEditingRole(role);
    setEditDraft({ code: role.code, name: role.name, isAdmin: role.isAdmin });
  }

  async function submitCreate() {
    if (await onCreateRole(newRole)) {
      setNewRole({ code: '', name: '', isAdmin: false });
      setCreateOpen(false);
    }
  }

  async function submitEdit() {
    if (editingRole && (await onSaveRole(editingRole.id, editDraft))) {
      setEditingRole(null);
    }
  }

  return (
    <AdminCard
      aria-label="角色工作区"
      className="min-w-0 space-y-4 p-4"
      data-admin-access-workspace="roles"
      role="tabpanel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-normal leading-tight tracking-[-0.016em] text-[var(--admin-foreground)]">
            角色与权限
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted-foreground)]">
            列表保持只读；编辑时再打开表单，用户数和邀请码数来自当前已加载数据。
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger asChild>
            <Button className={adminPrimaryButtonClassName} type="button">
              创建角色
            </Button>
          </DialogTrigger>
          <DialogContent
            {...adminThemeAttributes}
            className="max-w-[480px] rounded-[var(--admin-radius-dialog)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-normal">创建角色</DialogTitle>
              <DialogDescription className="leading-6 text-[var(--admin-muted-foreground)]">
                创建普通或管理员角色；至少保留一个管理员角色等约束由服务端继续保护。
              </DialogDescription>
            </DialogHeader>
            <RoleForm disabled={creatingRole} draft={newRole} onChange={setNewRole} />
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  className={adminSecondaryButtonClassName}
                  disabled={creatingRole}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
              </DialogClose>
              <Button
                aria-busy={creatingRole}
                className={adminPrimaryButtonClassName}
                disabled={creatingRole}
                onClick={() => void submitCreate()}
                type="button"
              >
                {creatingRole ? '创建中…' : '确认创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && roles.length === 0 ? (
        <AdminEmptyState compact description="正在读取角色和引用数量。" title="正在加载角色" />
      ) : roles.length === 0 ? (
        <AdminEmptyState compact title="暂无角色" />
      ) : (
        <>
          <div className="hidden lg:block" data-admin-access-role-table>
            <table className="w-full table-auto border-collapse text-left">
              <thead className="border-b border-[var(--admin-border-subtle)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted-foreground)]">
                <tr>
                  <th className="pb-2 pr-3">角色</th>
                  <th className="pb-2 pr-3">类型</th>
                  <th className="pb-2 pr-3">用户数</th>
                  <th className="pb-2 pr-3">邀请码数</th>
                  <th className="pb-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border-subtle)]">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <RoleSummary count={usageCounts[role.id]} role={role} />
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          className={adminSecondaryButtonClassName}
                          disabled={savingRoleId === role.id}
                          onClick={() => openEdit(role)}
                          type="button"
                          variant="outline"
                        >
                          编辑
                        </Button>
                        <AccessDangerDialog
                          busy={deletingRoleId === role.id}
                          confirmLabel="确认删除"
                          description={`确认删除角色「${role.name}（${role.code}）」？若已有用户、邀请码或阶段考试策略引用该角色，服务端会拒绝删除。`}
                          disabled={role.code === 'admin'}
                          onConfirm={() => onDeleteRole(role)}
                          title="删除角色"
                          triggerLabel={role.code === 'admin' ? '默认角色不可删除' : '删除'}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden" data-admin-access-role-cards>
            {roles.map((role) => (
              <article
                className="grid min-w-0 gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
                key={role.id}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--admin-foreground)]">{role.name}</div>
                    <div className="break-all text-xs text-[var(--admin-muted-foreground)]">
                      {role.code}
                    </div>
                  </div>
                  <AdminStatusBadge tone={role.isAdmin ? 'warning' : 'neutral'}>
                    {role.isAdmin ? '管理员角色' : '普通角色'}
                  </AdminStatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-[var(--admin-muted-foreground)]">当前用户数</dt>
                    <dd className="mt-1 tabular-nums">{usageCounts[role.id].userCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--admin-muted-foreground)]">当前邀请码数</dt>
                    <dd className="mt-1 tabular-nums">{usageCounts[role.id].inviteCount}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    className={adminSecondaryButtonClassName}
                    disabled={savingRoleId === role.id}
                    onClick={() => openEdit(role)}
                    type="button"
                    variant="outline"
                  >
                    编辑
                  </Button>
                  <AccessDangerDialog
                    busy={deletingRoleId === role.id}
                    confirmLabel="确认删除"
                    description={`确认删除角色「${role.name}（${role.code}）」？若已有用户、邀请码或阶段考试策略引用该角色，服务端会拒绝删除。`}
                    disabled={role.code === 'admin'}
                    onConfirm={() => onDeleteRole(role)}
                    title="删除角色"
                    triggerLabel={role.code === 'admin' ? '默认角色不可删除' : '删除'}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <RoleDialog
        busy={Boolean(editingRole && savingRoleId === editingRole.id)}
        draft={editDraft}
        onDraftChange={setEditDraft}
        onOpenChange={(open) => {
          if (!open) setEditingRole(null);
        }}
        onSave={() => void submitEdit()}
        open={editingRole !== null}
        protectCode={editingRole?.code === 'admin'}
        title="编辑角色"
      />
    </AdminCard>
  );
}
