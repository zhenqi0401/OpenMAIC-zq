import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
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

export const adminSecondaryButtonClassName =
  'min-h-[var(--admin-control-height)] rounded-[var(--admin-radius-control)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-none hover:border-[var(--admin-border-interactive)] hover:bg-[var(--admin-surface-selected)] focus-visible:border-[var(--admin-focus-ring)] focus-visible:ring-[var(--admin-focus-ring)]/25';

export const adminPrimaryButtonClassName =
  'min-h-[var(--admin-control-height)] rounded-[var(--admin-radius-control)] bg-[var(--admin-action-primary)] text-white shadow-none hover:bg-[var(--admin-action-primary-hover)] active:bg-[var(--admin-action-primary-active)] focus-visible:ring-[var(--admin-focus-ring)]/30';

export const adminIconButtonClassName =
  'size-[var(--admin-control-height)] rounded-[var(--admin-radius-control)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-none hover:bg-[var(--admin-surface-selected)] focus-visible:ring-[var(--admin-focus-ring)]/25';

export const adminDangerOutlineButtonClassName =
  'rounded-[var(--admin-radius-control)] border-[var(--admin-danger)]/70 bg-[var(--admin-surface)] text-[var(--admin-danger-strong)] shadow-none hover:border-[var(--admin-danger)] hover:bg-[var(--admin-danger-background)] focus-visible:border-[var(--admin-danger)] focus-visible:ring-[var(--admin-danger)]/25';

export const adminDangerButtonClassName =
  'rounded-[var(--admin-radius-control)] bg-[var(--admin-danger)] text-white hover:bg-[var(--admin-danger-strong)] focus-visible:border-[var(--admin-danger)] focus-visible:ring-[var(--admin-danger)]/25';

export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

/** Stable page-level spacing and width contract for every admin module. */
export function AdminPage({ children, className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('min-w-0 scroll-mt-4 space-y-6', className)} data-admin-page {...props}>
      {children}
    </section>
  );
}

export interface AdminSectionHeaderProps {
  icon?: ReactNode;
  eyebrow?: string;
  breadcrumb?: AdminBreadcrumbItem[];
  title: string;
  description?: string;
  action?: ReactNode;
}

export function AdminSectionHeader({
  icon,
  eyebrow,
  breadcrumb,
  title,
  description,
  action,
}: AdminSectionHeaderProps) {
  const hasBreadcrumb = breadcrumb && breadcrumb.length > 0;
  const hasContext = icon || eyebrow || hasBreadcrumb;

  return (
    <div
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
      data-admin-section-header
    >
      <div className="grid max-w-[760px] gap-1">
        {hasContext ? (
          <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.04em] text-[var(--admin-muted-foreground)]">
            {icon ? (
              <span aria-hidden="true" className="text-[var(--admin-link)]">
                {icon}
              </span>
            ) : null}
            {hasBreadcrumb ? (
              <nav aria-label="面包屑">
                <ol className="flex flex-wrap items-center gap-1.5">
                  {breadcrumb.map((item, index) => {
                    const current = index === breadcrumb.length - 1;
                    return (
                      <li className="flex items-center gap-1.5" key={`${item.label}-${index}`}>
                        {item.href ? (
                          <a
                            className="rounded-[2px] transition-colors hover:text-[var(--admin-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
                            href={item.href}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <span aria-current={current ? 'page' : undefined}>{item.label}</span>
                        )}
                        {!current ? <ChevronRight aria-hidden="true" className="size-3" /> : null}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : null}
            {eyebrow ? <span className="uppercase tracking-[0.08em]">{eyebrow}</span> : null}
          </div>
        ) : null}
        <h2
          className="text-xl font-semibold leading-7 tracking-[-0.01em] text-[var(--admin-heading)] sm:text-2xl sm:leading-8"
          data-admin-section-title
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-[72ch] text-sm leading-5 text-[var(--admin-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div
          aria-label="页面操作"
          className="flex flex-wrap justify-start gap-2 md:justify-end"
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
        'rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-[var(--admin-shadow-card)]',
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
    <div
      className={cn(
        'rounded-[var(--admin-radius-control)] border px-3 py-2 text-sm',
        toneClassName,
        className,
      )}
      role={role ?? (tone === 'error' ? 'alert' : undefined)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const className =
    tone === 'success'
      ? 'border-[var(--admin-success)] bg-[var(--admin-success-background)] text-[var(--admin-success-strong)]'
      : tone === 'warning'
        ? 'border-[var(--admin-warning)] bg-[var(--admin-warning-background)] text-[var(--admin-warning-strong)]'
        : tone === 'danger'
          ? 'border-[var(--admin-danger)] bg-[var(--admin-danger-background)] text-[var(--admin-danger-strong)]'
          : 'border-[var(--admin-border)] bg-[var(--admin-selection-background)] text-[var(--admin-muted-foreground)]';

  return (
    <span
      className={cn(
        'inline-flex h-7 w-fit items-center rounded-[var(--admin-radius-control)] border px-2 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
