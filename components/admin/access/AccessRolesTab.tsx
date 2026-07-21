'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onChange,
}: {
  draft: RoleDraft;
  disabled: boolean;
  onChange: (draft: RoleDraft) => void;
}) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5 text-sm text-[#75665d]">
        <span>角色代码</span>
        <Input
          className={adminInputClassName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
          placeholder="例如 ops"
          value={draft.code}
        />
      </label>
      <label className="grid gap-1.5 text-sm text-[#75665d]">
        <span>角色名称</span>
        <Input
          className={adminInputClassName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="例如 运营"
          value={draft.name}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-[#75665d]">
        <input
          checked={draft.isAdmin}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, isAdmin: event.target.checked })}
          type="checkbox"
        />
        管理员角色
      </label>
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
  title,
}: {
  busy: boolean;
  draft: RoleDraft;
  onDraftChange: (draft: RoleDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[480px] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">{title}</DialogTitle>
          <DialogDescription className="leading-6 text-[#75665d]">
            角色代码、名称和管理员权限会提交到现有角色 API。系统保护仍由服务端执行。
          </DialogDescription>
        </DialogHeader>
        <RoleForm disabled={busy} draft={draft} onChange={onDraftChange} />
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
            className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
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
      <div className="min-w-0">
        <div className="font-medium text-[#2b211d]">{role.name}</div>
        <div className="break-all text-xs text-[#75665d]">{role.code}</div>
      </div>
      <AdminStatusBadge tone={role.isAdmin ? 'warning' : 'neutral'}>
        {role.isAdmin ? '管理员角色' : '普通角色'}
      </AdminStatusBadge>
      <span className="text-sm tabular-nums text-[#75665d]">{count.userCount}</span>
      <span className="text-sm tabular-nums text-[#75665d]">{count.inviteCount}</span>
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
          <h3 className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            角色与权限
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#75665d]">
            列表保持只读；编辑时再打开表单，用户数和邀请码数来自当前已加载数据。
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" type="button">
              创建角色
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[480px] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]">
            <DialogHeader>
              <DialogTitle className="text-xl font-normal">创建角色</DialogTitle>
              <DialogDescription className="leading-6 text-[#75665d]">
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
                className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
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
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.8fr)_minmax(80px,0.5fr)_minmax(90px,0.5fr)_auto] gap-3 border-b border-[#eaded1] pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
              <span>角色</span>
              <span>类型</span>
              <span>用户数</span>
              <span>邀请码数</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-[#eaded1]">
              {roles.map((role) => (
                <div
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.8fr)_minmax(80px,0.5fr)_minmax(90px,0.5fr)_auto] items-center gap-3 py-3"
                  key={role.id}
                >
                  <RoleSummary count={usageCounts[role.id]} role={role} />
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
                      description={`确认删除角色「${role.name}（${role.code}）」？至少需要保留一个管理员角色；若已有用户、邀请码或阶段考试策略引用该角色，服务端会拒绝删除。`}
                      onConfirm={() => onDeleteRole(role)}
                      title="删除角色"
                      triggerLabel="删除"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:hidden" data-admin-access-role-cards>
            {roles.map((role) => (
              <article
                className="grid min-w-0 gap-3 rounded-[4px] border border-[#eaded1] p-3"
                key={role.id}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[#2b211d]">{role.name}</div>
                    <div className="break-all text-xs text-[#75665d]">{role.code}</div>
                  </div>
                  <AdminStatusBadge tone={role.isAdmin ? 'warning' : 'neutral'}>
                    {role.isAdmin ? '管理员角色' : '普通角色'}
                  </AdminStatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-[#75665d]">当前用户数</dt>
                    <dd className="mt-1 tabular-nums">{usageCounts[role.id].userCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#75665d]">当前邀请码数</dt>
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
                    description={`确认删除角色「${role.name}（${role.code}）」？至少需要保留一个管理员角色；若已有用户、邀请码或阶段考试策略引用该角色，服务端会拒绝删除。`}
                    onConfirm={() => onDeleteRole(role)}
                    title="删除角色"
                    triggerLabel="删除"
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
        title="编辑角色"
      />
    </AdminCard>
  );
}
