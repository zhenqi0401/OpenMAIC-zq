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

export function maskAdminPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  if (phone.length <= 7) {
    return `${phone.slice(0, 2)}${'*'.repeat(Math.max(1, phone.length - 4))}${phone.slice(-2)}`;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

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
      <AlertDialogContent className="max-w-[420px] rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] p-0 text-[#2b211d] shadow-[0_18px_50px_rgba(43,33,29,0.18)]">
        <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
          <AlertDialogTitle className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-[#75665d]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[#eaded1] px-5 pb-5 pt-3 sm:justify-end">
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
    <>
      <span className="font-medium text-[#2b211d]">{user.displayName}</span>
      <span className="text-[#75665d]">{maskAdminPhone(user.phone)}</span>
      <span className="break-all text-[#75665d]">{user.hostUserId ?? '-'}</span>
    </>
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
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(220px,1.25fr)_auto] gap-3 border-b border-[#eaded1] pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
            <span>用户</span>
            <span>脱敏手机号</span>
            <span>外部 ID</span>
            <span>当前角色</span>
            <span className="text-right">危险操作</span>
          </div>
          <div className="divide-y divide-[#eaded1]">
            {pagination.rows.map((user) => {
              const saving = savingUserId === user.id;
              return (
                <div
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(220px,1.25fr)_auto] items-center gap-3 py-3 text-sm"
                  key={user.id}
                >
                  <UserFacts user={user} />
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
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 xl:hidden" data-admin-access-user-cards>
          {pagination.rows.map((user) => {
            const saving = savingUserId === user.id;
            return (
              <article
                className="grid min-w-0 gap-3 rounded-[4px] border border-[#eaded1] p-3"
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
        <h3 className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
          用户与角色
        </h3>
        <p className="mt-1 text-sm leading-6 text-[#75665d]">
          手机号只显示脱敏值；删除会永久移除账号及其关联学习记录。
        </p>
      </div>
      {content}
      <div className="border-t border-[#eaded1] pt-3">
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
