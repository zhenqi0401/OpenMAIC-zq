import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Keep the admin workbench on one warm interaction palette without changing
 * the application-wide shadcn theme. Components rendered inside AdminShell
 * can continue to use semantic utilities such as `bg-primary` and
 * `focus-visible:ring-ring`.
 */
export const adminThemeStyle = {
  '--background': '#fffaf2',
  '--foreground': '#2b211d',
  '--primary': '#c96f54',
  '--primary-foreground': '#fffaf2',
  '--secondary': '#f1e2d0',
  '--secondary-foreground': '#2b211d',
  '--muted': '#f1e2d0',
  '--muted-foreground': '#75665d',
  '--accent': '#f1e2d0',
  '--accent-foreground': '#2b211d',
  '--popover': '#fffaf2',
  '--popover-foreground': '#2b211d',
  '--border': '#d8c8b9',
  '--ring': '#c96f54',
  '--destructive': '#b5534b',
} as CSSProperties;

export const adminSelectClassName =
  'h-10 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-3 text-sm text-[#2b211d] outline-none transition-colors focus-visible:border-[#c96f54] focus-visible:ring-2 focus-visible:ring-[#c96f54]/25 disabled:cursor-not-allowed disabled:opacity-60';

export const adminInputClassName =
  'rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d] placeholder:text-[#9b897d] focus-visible:border-[#c96f54] focus-visible:ring-[#c96f54]/25';

export const adminSecondaryButtonClassName =
  'rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d] shadow-none hover:border-[#c96f54]/70 hover:bg-[#f1e2d0] focus-visible:border-[#c96f54] focus-visible:ring-[#c96f54]/25';

export const adminDangerOutlineButtonClassName =
  'rounded-[4px] border-[#b5534b]/70 bg-[#fffaf2] text-[#8f342f] shadow-none hover:border-[#b5534b] hover:bg-[#b5534b]/10 focus-visible:border-[#b5534b] focus-visible:ring-[#b5534b]/25';

export const adminDangerButtonClassName =
  'rounded-[4px] bg-[#b5534b] text-[#fffaf2] hover:bg-[#9f463f] focus-visible:border-[#b5534b] focus-visible:ring-[#b5534b]/25';

export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
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
      className="grid gap-4 border-b border-[#d8c8b9] pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
      data-admin-section-header
    >
      <div className="grid max-w-[760px] gap-2">
        {hasContext ? (
          <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.04em] text-[#75665d]">
            {icon ? (
              <span aria-hidden="true" className="text-[#9b5b47]">
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
                            className="rounded-[2px] transition-colors hover:text-[#9b5b47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c96f54]/30"
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
          className="text-[28px] font-normal leading-[1.08] tracking-[-0.016em] text-[#2b211d] sm:text-[32px] lg:text-[36px]"
          data-admin-section-title
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-[64ch] text-sm leading-6 text-[#75665d]">{description}</p>
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

export function AdminCard({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d] shadow-[0_1px_0_rgba(43,33,29,0.04)]',
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
      ? 'border-[#b5534b] bg-[#b5534b]/10 text-[#8f342f]'
      : tone === 'success'
        ? 'border-[#4f7a5b] bg-[#4f7a5b]/10 text-[#3f6148]'
        : 'border-[#d8c8b9] bg-[#fffaf2] text-[#75665d]';

  return (
    <div
      className={cn('rounded-[4px] border px-3 py-2 text-sm', toneClassName, className)}
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
      ? 'border-[#4f7a5b] bg-[#4f7a5b]/10 text-[#3f6148]'
      : tone === 'warning'
        ? 'border-[#a66f2e] bg-[#a66f2e]/10 text-[#7c4c19]'
        : tone === 'danger'
          ? 'border-[#b5534b] bg-[#b5534b]/10 text-[#8f342f]'
          : 'border-[#d8c8b9] bg-[#f1e2d0] text-[#75665d]';

  return (
    <span
      className={cn(
        'inline-flex h-7 w-fit items-center rounded-[4px] border px-2 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
