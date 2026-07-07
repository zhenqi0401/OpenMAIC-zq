import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const adminSelectClassName =
  'h-10 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-3 text-sm text-[#2b211d] outline-none transition-colors focus-visible:border-[#c96f54] focus-visible:ring-2 focus-visible:ring-[#c96f54]/25 disabled:cursor-not-allowed disabled:opacity-60';

export const adminInputClassName =
  'rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d] placeholder:text-[#9b897d] focus-visible:border-[#c96f54] focus-visible:ring-[#c96f54]/25';

interface AdminSectionHeaderProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function AdminSectionHeader({
  icon,
  eyebrow,
  title,
  description,
  action,
}: AdminSectionHeaderProps) {
  return (
    <div className="grid gap-4 border-b border-[#d8c8b9] pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="grid max-w-[760px] gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
          <span className="text-[#9b5b47]">{icon}</span>
          {eyebrow}
        </p>
        <h2 className="text-[clamp(28px,3.2vw,46px)] font-normal leading-[1.08] tracking-[-0.016em] text-[#2b211d]">
          {title}
        </h2>
        <p className="max-w-[64ch] text-sm leading-6 text-[#75665d]">{description}</p>
      </div>
      {action ? <div className="flex flex-wrap justify-start gap-2 md:justify-end">{action}</div> : null}
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
}: {
  children: ReactNode;
  tone?: 'neutral' | 'error' | 'success';
}) {
  const className =
    tone === 'error'
      ? 'border-[#b5534b] bg-[#b5534b]/10 text-[#8f342f]'
      : tone === 'success'
        ? 'border-[#4f7a5b] bg-[#4f7a5b]/10 text-[#3f6148]'
        : 'border-[#d8c8b9] bg-[#fffaf2] text-[#75665d]';

  return <div className={cn('rounded-[4px] border px-3 py-2 text-sm', className)}>{children}</div>;
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
