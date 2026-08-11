import type { ReactNode } from 'react';
import { Empty } from 'antd';
import { CircleAlert, Inbox, SearchX, ShieldAlert } from 'lucide-react';
import { AdminCard, AdminNotice } from '@/components/admin/AdminSurface';
import { cn } from '@/lib/utils';

export type AdminEmptyStateKind = 'empty' | 'filtered' | 'error' | 'forbidden';

export interface AdminEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  kind?: AdminEmptyStateKind;
}

const stateIcons = {
  empty: Inbox,
  filtered: SearchX,
  error: CircleAlert,
  forbidden: ShieldAlert,
} as const;

function StateContent({
  title,
  description,
  action,
  compact,
  kind,
}: Required<Pick<AdminEmptyStateProps, 'title' | 'compact' | 'kind'>> &
  Pick<AdminEmptyStateProps, 'description' | 'action'>) {
  const Icon = stateIcons[kind];

  return (
    <Empty
      className={cn(compact ? 'p-4' : 'p-8')}
      image={
        <span
          aria-hidden="true"
          className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-[var(--admin-selection-background)] text-[var(--admin-link)]"
        >
          <Icon className="size-5" />
        </span>
      }
      styles={{ image: { height: 40 } }}
      description={
        <span className="grid max-w-[52ch] gap-1">
          <strong className="text-sm font-semibold text-[var(--admin-foreground)]">{title}</strong>
          {description ? (
            <span className="text-sm leading-6 text-[var(--admin-muted-foreground)]">
              {description}
            </span>
          ) : null}
        </span>
      }
    >
      {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
    </Empty>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  compact = false,
  kind = 'empty',
}: AdminEmptyStateProps) {
  const content = (
    <StateContent
      action={action}
      compact={compact}
      description={description}
      kind={kind}
      title={title}
    />
  );

  // A load failure is announced as an error notice, not mislabeled as an
  // empty result. The shared facade still lets list modules render it in the
  // same reserved state area and attach a retry action.
  if (kind === 'error') {
    return (
      <AdminNotice data-admin-state="error" role="alert" tone="error">
        {content}
      </AdminNotice>
    );
  }

  return (
    <AdminCard data-admin-state={kind} role="status">
      {content}
    </AdminCard>
  );
}
