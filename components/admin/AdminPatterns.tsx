import type { ComponentProps, ReactNode } from 'react';
import { Skeleton, Spin, Statistic } from 'antd';
import { SearchX, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminCard, AdminStatusBadge } from '@/components/admin/AdminSurface';

export function AdminMetricCard({
  label,
  value,
  detail,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <AdminCard className={cn('grid min-h-36 gap-4 p-6', className)} data-admin-metric-card>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium leading-5 text-[var(--admin-muted-foreground)]">
          {label}
        </span>
        {icon ? (
          <span className="grid size-9 place-items-center rounded-full bg-[var(--admin-selection-background)] text-[var(--admin-interactive-accent)]">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Statistic
          value={typeof value === 'string' || typeof value === 'number' ? value : undefined}
          formatter={() => value}
          valueStyle={{ color: 'var(--admin-heading)', fontSize: 28, fontWeight: 600 }}
        />
        {trend}
      </div>
      {detail ? (
        <div className="text-xs leading-4 text-[var(--admin-muted-foreground)]">{detail}</div>
      ) : null}
    </AdminCard>
  );
}

export function AdminFilterBar({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-3 border-b border-[var(--admin-border-subtle)] bg-[var(--admin-surface-subtle)] p-4',
        className,
      )}
      data-admin-filter-bar
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminDataTable({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('min-w-0 overflow-x-auto', className)} data-admin-data-table {...props}>
      {children}
    </div>
  );
}

export function AdminEntityCard({ children, className, ...props }: ComponentProps<'article'>) {
  return (
    <article
      className={cn(
        'rounded-[var(--admin-radius-card)] border border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-card)] transition-colors hover:border-[var(--admin-border)]',
        className,
      )}
      data-admin-entity-card
      {...props}
    >
      {children}
    </article>
  );
}

export const AdminStatusChip = AdminStatusBadge;

export function AdminLoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-44 place-items-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] p-6 text-sm text-[var(--admin-muted-foreground)]"
      data-admin-state="loading"
    >
      <Spin size="large" tip={label} />
    </div>
  );
}

export function AdminSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-label="内容加载中"
      className="grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] p-6"
      data-admin-state="skeleton"
      role="status"
    >
      <Skeleton active paragraph={{ rows }} title={false} />
    </div>
  );
}

export function AdminNoPermissionState() {
  return (
    <div
      className="grid min-h-44 place-items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center"
      data-admin-state="forbidden"
      role="alert"
    >
      <ShieldAlert aria-hidden="true" className="size-6 text-[var(--admin-danger)]" />
      <div>
        <h3 className="text-lg font-semibold leading-6">无权访问此内容</h3>
        <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
          请联系管理员确认角色权限。
        </p>
      </div>
    </div>
  );
}

export function AdminFilteredEmptyState() {
  return (
    <div
      className="grid min-h-44 place-items-center gap-3 rounded-[var(--admin-radius-card)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center"
      data-admin-state="filtered"
    >
      <SearchX aria-hidden="true" className="size-6 text-[var(--admin-muted-foreground)]" />
      <div>
        <h3 className="text-lg font-semibold leading-6">没有符合条件的结果</h3>
        <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
          调整搜索词或筛选条件后重试。
        </p>
      </div>
    </div>
  );
}
