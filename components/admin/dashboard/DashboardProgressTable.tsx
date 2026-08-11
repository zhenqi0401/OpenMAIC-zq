'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input, Select } from 'antd';
import {
  AdminCard,
  adminInputClassName,
  adminPrimaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { Button } from '@/components/antd/AntdButton';
import { buildRoleOptions, type AdminRole } from '@/lib/admin/client';
import type { EnterpriseProgressDetail } from '@/lib/storage/enterprise-service';
import { paginateAdminRows } from '@/lib/admin/pagination';
import { getDashboardLastActivity, getDashboardRoleName } from '@/lib/admin/presentation';
import { formatAdminDateTime } from '@/lib/admin/date-time';

export interface DashboardFilters {
  userId: string;
  roleId: string;
  courseId: string;
}

interface DashboardProgressTableProps {
  progress: EnterpriseProgressDetail[];
  emptyText: string;
  dashboardFilters: DashboardFilters;
  roles: readonly AdminRole[];
  onFilterChange: Dispatch<SetStateAction<DashboardFilters>>;
  onPageChange: (page: number) => void;
  onReset: () => void;
  onSubmit: () => void;
  page: number;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-[var(--admin-muted-foreground)]">{text}</div>
  );
}

export function DashboardProgressTable({
  progress,
  emptyText,
  dashboardFilters,
  roles,
  onFilterChange,
  onPageChange,
  onReset,
  onSubmit,
  page,
}: DashboardProgressTableProps) {
  const pagination = paginateAdminRows(progress, page);
  const roleOptions = buildRoleOptions(roles);
  const hasFilters = Object.values(dashboardFilters).some((value) => value.trim().length > 0);

  return (
    <AdminCard className="overflow-hidden" data-admin-dashboard-progress-panel="true">
      <div className="border-b border-[var(--admin-border)] px-4 py-4">
        <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[var(--admin-foreground)]">
          学习记录
        </div>
        <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
          按用户 ID、角色或课程筛选学员列表，再查看每门课程的学习明细。
        </p>
      </div>
      <div className="grid gap-2 border-b border-[var(--admin-border-subtle)] p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-[var(--admin-foreground)]">
          <span>用户 ID</span>
          <Input
            className={adminInputClassName}
            placeholder="按用户 ID 筛选"
            value={dashboardFilters.userId}
            onChange={(event) =>
              onFilterChange((filters) => ({ ...filters, userId: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-[var(--admin-foreground)]">
          <span>角色</span>
          <Select
            className="w-full"
            value={dashboardFilters.roleId}
            onChange={(value) => onFilterChange((filters) => ({ ...filters, roleId: value }))}
            options={[
              { value: '', label: '全部角色' },
              ...roleOptions.map((role) => ({ value: role.value, label: role.label })),
            ]}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-[var(--admin-foreground)]">
          <span>课程 ID</span>
          <Input
            className={adminInputClassName}
            placeholder="按课程 ID 筛选"
            value={dashboardFilters.courseId}
            onChange={(event) =>
              onFilterChange((filters) => ({ ...filters, courseId: event.target.value }))
            }
          />
        </label>
        <div className="flex gap-2">
          <Button className={adminPrimaryButtonClassName} onClick={onSubmit}>
            应用筛选
          </Button>
          {hasFilters ? (
            <Button
              className="rounded-[var(--admin-radius-control)]"
              onClick={onReset}
              variant="outline"
            >
              重置
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto md:overflow-visible">
        <div className="min-w-[920px] md:min-w-0">
          <div className="grid grid-cols-[1fr_0.8fr_1fr_0.7fr_1fr_1fr] gap-3 border-b border-[var(--admin-border)] px-4 py-3 text-xs font-semibold uppercase text-[var(--admin-muted-foreground)]">
            <span>学员</span>
            <span>角色</span>
            <span>课程</span>
            <span>学习状态</span>
            <span>开始时间</span>
            <span>最近活动</span>
          </div>
          {pagination.total === 0 ? (
            <EmptyState text={emptyText} />
          ) : (
            pagination.rows.map((row) => (
              <div
                className="grid grid-cols-[1fr_0.8fr_1fr_0.7fr_1fr_1fr] gap-3 border-b border-[var(--admin-border-subtle)] px-4 py-3 text-sm last:border-b-0"
                key={`${row.userId}-${row.courseId}`}
              >
                <span className="font-medium text-[var(--admin-foreground)]">
                  {row.displayName}
                </span>
                <span className="text-[var(--admin-muted-foreground)]">
                  {getDashboardRoleName(row.roleId, row.roleCode, roles)}
                </span>
                <span className="text-[var(--admin-muted-foreground)]">{row.courseName}</span>
                <span className="text-[var(--admin-muted-foreground)]">
                  {row.completed ? '已完成' : '学习中'}
                </span>
                <span className="text-[var(--admin-muted-foreground)]">
                  {formatAdminDateTime(row.startedAt)}
                </span>
                <span className="text-[var(--admin-muted-foreground)]">
                  {formatAdminDateTime(getDashboardLastActivity(row))}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border-subtle)] px-4 py-3 text-sm text-[var(--admin-muted-foreground)]">
        <span>
          {pagination.total === 0
            ? '显示 0 条，共 0 条'
            : `显示 ${pagination.start}-${pagination.end} 条，共 ${pagination.total} 条`}
        </span>
        <div className="flex items-center gap-3">
          <span>
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              className="rounded-[var(--admin-radius-control)]"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              variant="outline"
            >
              上一页
            </Button>
            <Button
              className="rounded-[var(--admin-radius-control)]"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              variant="outline"
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}
