import type { ComponentProps, ReactNode } from 'react';
import { Alert, Tag } from 'antd';
import { cn } from '@/lib/utils';
export { adminThemeStyle } from '@/components/admin/admin-theme';

/**
 * Keep the admin workbench on the Yuanwo dual-blue interaction palette without changing
 * the application-wide shadcn theme. Components rendered inside AdminShell
 * can continue to use semantic utilities such as `bg-primary` and
 * `focus-visible:ring-ring`.
 */
export const adminSelectClassName =
  'h-[var(--admin-control-height)] rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-foreground)] outline-none transition-colors focus-visible:border-[var(--admin-focus-ring)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/25 disabled:cursor-not-allowed disabled:opacity-60';

export const adminInputClassName =
  'rounded-[var(--admin-radius-control)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] placeholder:text-[var(--admin-disabled-foreground)] focus-visible:border-[var(--admin-focus-ring)] focus-visible:ring-[var(--admin-focus-ring)]/25';

export const adminSecondaryButtonClassName = '';
export const adminPrimaryButtonClassName = '';
export const adminIconButtonClassName = '';
export const adminDangerOutlineButtonClassName = '';
export const adminDangerButtonClassName = '';
/** 表格行内操作的文字链接按钮：去按钮内边距与固定高度，颜色/边框交给 antd link 语义。 */
export const adminLinkButtonClassName = 'h-auto !p-0';
/** 表格行内危险操作的文字链接按钮：配合 Button 的 danger 语义使用。 */
export const adminLinkDangerButtonClassName = 'h-auto !p-0';

/** Stable page-level spacing and width contract for every admin module. */
export function AdminPage({ children, className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('min-w-0 scroll-mt-4 space-y-6', className)}
      data-admin-page
      data-admin-pro-page-container
      {...props}
    >
      {children}
    </section>
  );
}

export interface AdminSectionHeaderProps {
  title: string;
  action?: ReactNode;
}

/**
 * 后台一级页面头部：只保留一行中文标题与页面级操作。
 * 英文 eyebrow、宽泛说明与常驻刷新已从公共组件中移除。
 */
export function AdminSectionHeader({ title, action }: AdminSectionHeaderProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
      data-admin-section-header
    >
      <h2
        className="text-xl font-semibold leading-7 tracking-[-0.01em] text-[var(--admin-heading)] sm:text-2xl sm:leading-8"
        data-admin-section-title
      >
        {title}
      </h2>
      {action ? (
        <div
          aria-label="页面操作"
          className="flex flex-wrap items-center justify-start gap-2 md:justify-end"
          data-admin-header-actions
          role="group"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

/** Preferred name for new pages; retained alias keeps existing modules stable. */
export const AdminPageHeader = AdminSectionHeader;

export function AdminCard({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[var(--admin-radius-card)] border border-transparent bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-[var(--admin-shadow-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminNotice({
  children,
  tone = 'neutral',
  className,
  role,
  ...props
}: ComponentProps<'div'> & {
  tone?: 'neutral' | 'error' | 'success';
}) {
  const toneClassName =
    tone === 'error'
      ? 'border-[var(--admin-danger)] bg-[var(--admin-danger-background)] text-[var(--admin-danger-strong)]'
      : tone === 'success'
        ? 'border-[var(--admin-success)] bg-[var(--admin-success-background)] text-[var(--admin-success-strong)]'
        : 'border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-muted-foreground)]';

  return (
    <div {...props} role={role ?? (tone === 'error' ? 'alert' : undefined)}>
      <Alert
        className={cn('rounded-[var(--admin-radius-control)] text-sm', toneClassName, className)}
        title={children}
        type={tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'info'}
      />
    </div>
  );
}

const adminStatusToneClassName: Record<NonNullable<AdminStatusBadgeProps['tone']>, string> = {
  neutral: '!border-[var(--admin-border)] !bg-[var(--admin-surface-subtle)] !text-[var(--admin-foreground)]',
  success:
    '!border-[var(--admin-success)]/30 !bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] !text-[var(--admin-success-strong)]',
  warning:
    '!border-[var(--admin-warning)]/40 !bg-[var(--admin-warning-background)] !text-[var(--admin-warning-strong)]',
  danger:
    '!border-[var(--admin-danger)]/40 !bg-[var(--admin-danger-background)] !text-[var(--admin-danger-strong)]',
};

export interface AdminStatusBadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function AdminStatusBadge({ children, tone = 'neutral' }: AdminStatusBadgeProps) {
  const color = tone === 'danger' ? 'error' : tone === 'neutral' ? 'default' : tone;
  return (
    <Tag color={color} className={cn('!font-medium', adminStatusToneClassName[tone])}>
      {children}
    </Tag>
  );
}
