'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  AdminCard,
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminInputClassName,
  adminSecondaryButtonClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminRowActions } from '@/components/admin/AdminRowActions';
import { AdminFilterBar, AdminStatusChip } from '@/components/admin/AdminPatterns';
import type { AdminPagination as Pagination, AdminUser, RoleOption } from '@/lib/admin/client';

export function AccessDangerDialog({
  busy,
  confirmLabel,
  description,
  onConfirm,
  title,
  triggerLabel,
}: {
  busy: boolean;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  title: string;
  triggerLabel: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-busy={busy}
          className={adminDangerOutlineButtonClassName}
          disabled={busy}
          type="button"
          variant="outline"
        >
          {busy ? '处理中…' : triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        {...adminThemeAttributes}
        className="max-w-[420px] rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-foreground)] shadow-[var(--admin-shadow-popover)]"
      >
        <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
          <AlertDialogTitle className="text-xl font-normal leading-tight tracking-[-0.016em] text-[var(--admin-foreground)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-[var(--admin-muted-foreground)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[var(--admin-border-subtle)] px-5 pb-5 pt-3 sm:justify-end">
          <AlertDialogCancel className={adminSecondaryButtonClassName} disabled={busy}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={busy}
            className={adminDangerButtonClassName}
            disabled={busy}
            onClick={onConfirm}
            variant="destructive"
          >
            {busy ? '处理中…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserRoleEditor({
  disabled,
  onChange,
  onSave,
  roleId,
  roleOptions,
}: {
  disabled: boolean;
  onChange: (roleId: string) => void;
  onSave: () => void;
  roleId: string;
  roleOptions: readonly RoleOption[];
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        aria-label="当前角色"
        className={`${adminSelectClassName} min-w-0 flex-1`}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={roleId}
      >
        {roleOptions.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
      <Button
        aria-busy={disabled}
        className={adminSecondaryButtonClassName}
        disabled={disabled}
        onClick={onSave}
        type="button"
        variant="outline"
      >
        {disabled ? '保存中…' : '保存'}
      </Button>
    </div>
  );
}

function UserFacts({ user }: { user: AdminUser }) {
  return (
    <dl className="grid gap-2">
      <div>
        <dt className="text-xs text-[var(--admin-muted-foreground)]">用户</dt>
        <dd className="mt-1 font-medium text-[var(--admin-foreground)]">{user.displayName}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--admin-muted-foreground)]">手机号</dt>
        <dd className="mt-1 text-[var(--admin-muted-foreground)]">{user.phone ?? '-'}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--admin-muted-foreground)]">外部用户 ID</dt>
        <dd className="mt-1 break-all text-[var(--admin-muted-foreground)]">
          {user.hostUserId ?? '-'}
        </dd>
      </div>
    </dl>
  );
}

function UserDeleteAction({
  busy,
  onDelete,
  onOpenChange,
  open,
  user,
}: {
  busy: boolean;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AdminUser;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent
        {...adminThemeAttributes}
        className="max-w-[420px] rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>永久删除用户</AlertDialogTitle>
          <AlertDialogDescription>{`确认永久删除用户「${user.displayName}」？该操作会删除账号，并清理其学习进度、测评记录和阶段考试记录，且不可恢复。`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={adminSecondaryButtonClassName} disabled={busy}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className={adminDangerButtonClassName}
            disabled={busy}
            onClick={onDelete}
            variant="destructive"
          >
            {busy ? '处理中…' : '确认永久删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserActions({
  busy,
  deleting,
  onDelete,
  onToggleStatus,
  user,
}: {
  busy: boolean;
  deleting: boolean;
  onDelete: () => void;
  onToggleStatus: () => void;
  user: AdminUser;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <AdminRowActions
        actions={[
          {
            id: 'status',
            label: user.status === 'disabled' ? '恢复账号' : '冻结账号',
            disabled: busy,
            onSelect: onToggleStatus,
          },
          {
            id: 'delete',
            label: '永久删除',
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]}
        triggerAriaLabel={`${user.displayName}的账号操作`}
      />
      <UserDeleteAction
        busy={deleting}
        onDelete={onDelete}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        user={user}
      />
    </>
  );
}

export function AccessUsersTab({
  changingStatusUserId,
  deletingUserId,
  filters,
  loading,
  onDeleteUser,
  onFiltersChange,
  onPageChange,
  onRoleChange,
  onSaveUserRole,
  onToggleStatus,
  pagination,
  roleOptions,
  savingUserId,
  userRoleDrafts,
  users,
}: {
  changingStatusUserId: string | null;
  deletingUserId: string | null;
  filters: { q: string; roleId: string; status: 'all' | 'active' | 'disabled' };
  loading: boolean;
  onDeleteUser: (user: AdminUser) => void;
  onFiltersChange: (filters: {
    q: string;
    roleId: string;
    status: 'all' | 'active' | 'disabled';
  }) => void;
  onPageChange: (page: number) => void;
  onRoleChange: (userId: string, roleId: string) => void;
  onSaveUserRole: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  pagination: Pagination;
  roleOptions: readonly RoleOption[];
  savingUserId: string | null;
  userRoleDrafts: Record<string, string>;
  users: readonly AdminUser[];
}) {
  let content: ReactNode;
  if (loading && users.length === 0) {
    content = (
      <AdminEmptyState compact description="正在读取用户和角色信息。" title="正在加载用户" />
    );
  } else if (users.length === 0) {
    content = <AdminEmptyState compact title="暂无用户" />;
  } else {
    content = (
      <>
        <div className="hidden md:block" data-admin-access-user-table>
          <table className="w-full table-auto border-collapse text-left text-sm">
            <thead className="border-b border-[var(--admin-border-subtle)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted-foreground)]">
              <tr>
                <th className="pb-2 pr-3">用户</th>
                <th className="pb-2 pr-3">手机号</th>
                <th className="pb-2 pr-3">外部用户 ID</th>
                <th className="pb-2 pr-3">当前角色</th>
                <th className="pb-2 pr-3">账号状态</th>
                <th className="pb-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border-subtle)]">
              {users.map((user) => {
                const saving = savingUserId === user.id;
                return (
                  <tr key={user.id}>
                    <td className="py-3 pr-3 font-medium text-[var(--admin-foreground)]">
                      {user.displayName}
                    </td>
                    <td className="py-3 pr-3 text-[var(--admin-muted-foreground)]">
                      {user.phone ?? '-'}
                    </td>
                    <td className="max-w-52 break-all py-3 pr-3 text-[var(--admin-muted-foreground)]">
                      {user.hostUserId ?? '-'}
                    </td>
                    <td className="py-3 pr-3">
                      <UserRoleEditor
                        disabled={saving}
                        onChange={(roleId) => onRoleChange(user.id, roleId)}
                        onSave={() => onSaveUserRole(user)}
                        roleId={userRoleDrafts[user.id] ?? user.role.id}
                        roleOptions={roleOptions}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <AdminStatusChip tone={user.status === 'disabled' ? 'danger' : 'success'}>
                        {user.status === 'disabled' ? '已冻结' : '正常'}
                      </AdminStatusChip>
                    </td>
                    <td className="py-3 text-right">
                      <UserActions
                        busy={changingStatusUserId === user.id}
                        deleting={deletingUserId === user.id}
                        onDelete={() => onDeleteUser(user)}
                        onToggleStatus={() => onToggleStatus(user)}
                        user={user}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden" data-admin-access-user-cards>
          {users.map((user) => {
            const saving = savingUserId === user.id;
            return (
              <article
                className="grid min-w-0 gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
                key={user.id}
              >
                <div className="grid min-w-0 gap-1 text-sm">
                  <UserFacts user={user} />
                </div>
                <AdminStatusChip tone={user.status === 'disabled' ? 'danger' : 'success'}>
                  {user.status === 'disabled' ? '已冻结' : '正常'}
                </AdminStatusChip>
                <UserRoleEditor
                  disabled={saving}
                  onChange={(roleId) => onRoleChange(user.id, roleId)}
                  onSave={() => onSaveUserRole(user)}
                  roleId={userRoleDrafts[user.id] ?? user.role.id}
                  roleOptions={roleOptions}
                />
                <div className="flex justify-end">
                  <UserActions
                    busy={changingStatusUserId === user.id}
                    deleting={deletingUserId === user.id}
                    onDelete={() => onDeleteUser(user)}
                    onToggleStatus={() => onToggleStatus(user)}
                    user={user}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <AdminCard
      aria-label="用户工作区"
      className="min-w-0 space-y-4 p-4"
      data-admin-access-workspace="users"
      role="tabpanel"
    >
      <div>
        <h3 className="text-xl font-normal leading-tight tracking-[-0.016em] text-[var(--admin-foreground)]">
          用户与角色
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--admin-muted-foreground)]">
          查看用户基本信息并调整所属角色；删除用户会同时移除其关联学习记录。
        </p>
      </div>
      <AdminFilterBar className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)]">
        <Input
          aria-label="搜索用户"
          className={`${adminInputClassName} min-w-[220px] flex-1`}
          onChange={(event) => onFiltersChange({ ...filters, q: event.target.value })}
          placeholder="搜索名称、手机号或 Host User ID"
          value={filters.q}
        />
        <select
          aria-label="筛选用户角色"
          className={adminSelectClassName}
          onChange={(event) => onFiltersChange({ ...filters, roleId: event.target.value })}
          value={filters.roleId}
        >
          <option value="">全部角色</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <select
          aria-label="筛选账号状态"
          className={adminSelectClassName}
          onChange={(event) =>
            onFiltersChange({ ...filters, status: event.target.value as typeof filters.status })
          }
          value={filters.status}
        >
          <option value="all">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已冻结</option>
        </select>
      </AdminFilterBar>
      {content}
      <div className="border-t border-[var(--admin-border-subtle)] pt-3">
        <AdminPagination
          end={Math.min(pagination.page * pagination.pageSize, pagination.total)}
          loading={loading}
          onPageChange={onPageChange}
          page={pagination.page}
          start={pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
          total={pagination.total}
          totalPages={pagination.totalPages}
        />
      </div>
    </AdminCard>
  );
}
