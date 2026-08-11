'use client';

import { useState, type ReactNode } from 'react';
import { Input, Select } from 'antd';
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
} from '@/components/antd/AntdAlertDialog';
import { Button } from '@/components/antd/AntdButton';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  AdminCard,
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminInputClassName,
  adminLinkDangerButtonClassName,
  adminSecondaryButtonClassName,
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
  disabled = false,
  onConfirm,
  title,
  triggerLabel,
  link = false,
}: {
  busy: boolean;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  onConfirm: () => void;
  title: string;
  triggerLabel: string;
  /** 表格行内使用文字链接样式（红色），替代描边按钮 */
  link?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-busy={busy}
          className={
            link
              ? adminLinkDangerButtonClassName
              : adminDangerOutlineButtonClassName
          }
          disabled={busy || disabled}
          type="button"
          variant={link ? 'link' : 'outline'}
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
  currentUserId,
  disabled,
  onChange,
  onSave,
  roleId,
  roleOptions,
  user,
}: {
  currentUserId: string | null;
  disabled: boolean;
  onChange: (roleId: string) => void;
  onSave: () => void;
  roleId: string;
  roleOptions: readonly RoleOption[];
  user: AdminUser;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextRole = roleOptions.find((role) => role.value === roleId);
  const promoting = !user.role.isAdmin && nextRole?.isAdmin === true;
  const demoting = user.role.isAdmin && nextRole?.isAdmin === false;
  const selfDemotion = demoting && user.id === currentUserId;
  const disabledPromotion = promoting && user.status !== 'active';
  const unchanged = user.role.id === roleId;
  const saveDisabled = disabled || unchanged || selfDemotion || disabledPromotion;

  function requestSave() {
    if (promoting || demoting) setConfirmOpen(true);
    else onSave();
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          aria-label="当前角色"
          className="min-w-0 flex-1"
          disabled={disabled}
          onChange={(value) => onChange(value)}
          value={roleId}
          options={roleOptions.map((role) => ({
            value: role.value,
            label: role.label,
            disabled:
              (user.status !== 'active' && role.isAdmin) ||
              (user.id === currentUserId && !role.isAdmin),
          }))}
        />
        <Button
          aria-busy={disabled}
          className={adminSecondaryButtonClassName}
          disabled={saveDisabled}
          onClick={requestSave}
          type="button"
          variant="outline"
        >
          {disabled ? '保存中…' : '保存'}
        </Button>
      </div>
      {selfDemotion ? (
        <span className="text-xs text-[var(--admin-danger)]">
          不能取消当前登录账号的管理员权限。
        </span>
      ) : disabledPromotion ? (
        <span className="text-xs text-[var(--admin-danger)]">请先恢复账号，再提升为管理员。</span>
      ) : null}
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent
          {...adminThemeAttributes}
          className="max-w-[460px] rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{promoting ? '确认提升为管理员' : '确认取消管理员'}</AlertDialogTitle>
            <AlertDialogDescription>
              {promoting
                ? `用户「${user.displayName}」将获得本租户课程、用户、考试和社区的完整管理权限。`
                : `用户「${user.displayName}」将保留学习账号和本租户数据，但失去全部后台管理权限。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={adminSecondaryButtonClassName}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={promoting ? adminSecondaryButtonClassName : adminDangerButtonClassName}
              onClick={onSave}
            >
              {promoting ? '确认提升' : '确认取消管理员'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <dt className="text-xs text-[var(--admin-muted-foreground)]">元我智脑 ID</dt>
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
  currentUserId,
  deleting,
  onDelete,
  onToggleStatus,
  user,
}: {
  busy: boolean;
  currentUserId: string | null;
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
            label:
              user.status === 'disabled'
                ? '恢复账号'
                : user.id === currentUserId
                  ? '当前账号不可冻结'
                  : '冻结账号',
            disabled: busy || (user.status !== 'disabled' && user.id === currentUserId),
            onSelect: onToggleStatus,
          },
          {
            id: 'delete',
            label: user.role.isAdmin ? '请先取消管理员' : '永久删除',
            destructive: true,
            disabled: user.role.isAdmin,
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
  currentUserId,
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
  currentUserId: string | null;
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
                <th className="pb-2 pr-3">元我智脑 ID</th>
                <th className="pb-2 pr-3">当前角色</th>
                <th className="pb-2 pr-3">账号状态</th>
                <th className="pb-2 pr-3 text-left">操作</th>
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
                        currentUserId={currentUserId}
                        disabled={saving}
                        onChange={(roleId) => onRoleChange(user.id, roleId)}
                        onSave={() => onSaveUserRole(user)}
                        roleId={userRoleDrafts[user.id] ?? user.role.id}
                        roleOptions={roleOptions}
                        user={user}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <AdminStatusChip tone={user.status === 'disabled' ? 'danger' : 'success'}>
                        {user.status === 'disabled' ? '已冻结' : '正常'}
                      </AdminStatusChip>
                    </td>
                    <td className="py-3 text-left">
                      <UserActions
                        busy={changingStatusUserId === user.id}
                        currentUserId={currentUserId}
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
                  currentUserId={currentUserId}
                  disabled={saving}
                  onChange={(roleId) => onRoleChange(user.id, roleId)}
                  onSave={() => onSaveUserRole(user)}
                  roleId={userRoleDrafts[user.id] ?? user.role.id}
                  roleOptions={roleOptions}
                  user={user}
                />
                <div className="flex justify-end">
                  <UserActions
                    busy={changingStatusUserId === user.id}
                    currentUserId={currentUserId}
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
      <AdminFilterBar>
        <Input
          allowClear
          aria-label="搜索用户"
          className={`${adminInputClassName} min-w-[220px] flex-1`}
          onChange={(event) => onFiltersChange({ ...filters, q: event.target.value })}
          placeholder="搜索姓名或手机号"
          value={filters.q}
        />
        <Select
          aria-label="筛选用户角色"
          className="min-w-0"
          onChange={(value) => onFiltersChange({ ...filters, roleId: value })}
          value={filters.roleId}
          options={[
            { value: '', label: '全部角色' },
            ...roleOptions.map((role) => ({ value: role.value, label: role.label })),
          ]}
        />
        <Select
          aria-label="筛选账号状态"
          className="min-w-0"
          onChange={(value) =>
            onFiltersChange({ ...filters, status: value as typeof filters.status })
          }
          value={filters.status}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: '正常' },
            { value: 'disabled', label: '已冻结' },
          ]}
        />
      </AdminFilterBar>
      {content}
      <div className="border-t border-[var(--admin-border-subtle)] pt-3">
        <AdminPagination
          loading={loading}
          onPageChange={onPageChange}
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
        />
      </div>
    </AdminCard>
  );
}
