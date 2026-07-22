'use client';

import type { ReactNode } from 'react';
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
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  AdminCard,
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminSecondaryButtonClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import type { AdminUser, RoleOption } from '@/lib/admin/client';
import { paginateAdminRows } from '@/lib/admin/pagination';

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
  user,
}: {
  busy: boolean;
  onDelete: () => void;
  user: AdminUser;
}) {
  return (
    <AccessDangerDialog
      busy={busy}
      confirmLabel="确认永久删除"
      description={`确认永久删除用户「${user.displayName}」？该操作会删除账号，并清理其学习进度、测评记录和阶段考试记录，且不可恢复。`}
      onConfirm={onDelete}
      title="永久删除用户"
      triggerLabel="永久删除用户"
    />
  );
}

export function AccessUsersTab({
  deletingUserId,
  loading,
  onDeleteUser,
  onPageChange,
  onRoleChange,
  onSaveUserRole,
  page,
  roleOptions,
  savingUserId,
  userRoleDrafts,
  users,
}: {
  deletingUserId: string | null;
  loading: boolean;
  onDeleteUser: (user: AdminUser) => void;
  onPageChange: (page: number) => void;
  onRoleChange: (userId: string, roleId: string) => void;
  onSaveUserRole: (user: AdminUser) => void;
  page: number;
  roleOptions: readonly RoleOption[];
  savingUserId: string | null;
  userRoleDrafts: Record<string, string>;
  users: readonly AdminUser[];
}) {
  const pagination = paginateAdminRows(users, page);

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
        <div className="hidden xl:block" data-admin-access-user-table>
          <table className="w-full table-auto border-collapse text-left text-sm">
            <thead className="border-b border-[var(--admin-border-subtle)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted-foreground)]">
              <tr>
                <th className="pb-2 pr-3">用户</th>
                <th className="pb-2 pr-3">手机号</th>
                <th className="pb-2 pr-3">外部用户 ID</th>
                <th className="pb-2 pr-3">当前角色</th>
                <th className="pb-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border-subtle)]">
              {pagination.rows.map((user) => {
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
                    <td className="py-3 text-right">
                      <UserDeleteAction
                        busy={deletingUserId === user.id}
                        onDelete={() => onDeleteUser(user)}
                        user={user}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 xl:hidden" data-admin-access-user-cards>
          {pagination.rows.map((user) => {
            const saving = savingUserId === user.id;
            return (
              <article
                className="grid min-w-0 gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
                key={user.id}
              >
                <div className="grid min-w-0 gap-1 text-sm">
                  <UserFacts user={user} />
                </div>
                <UserRoleEditor
                  disabled={saving}
                  onChange={(roleId) => onRoleChange(user.id, roleId)}
                  onSave={() => onSaveUserRole(user)}
                  roleId={userRoleDrafts[user.id] ?? user.role.id}
                  roleOptions={roleOptions}
                />
                <div className="flex justify-end">
                  <UserDeleteAction
                    busy={deletingUserId === user.id}
                    onDelete={() => onDeleteUser(user)}
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
      {content}
      <div className="border-t border-[var(--admin-border-subtle)] pt-3">
        <AdminPagination
          end={pagination.end}
          loading={loading}
          onPageChange={onPageChange}
          page={pagination.page}
          start={pagination.start}
          total={pagination.total}
          totalPages={pagination.totalPages}
        />
      </div>
    </AdminCard>
  );
}
