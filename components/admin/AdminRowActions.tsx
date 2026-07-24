'use client';

import { Fragment, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';

export interface AdminRowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
}

export interface AdminRowActionsProps {
  actions: readonly AdminRowAction[];
  primaryAction?: ReactNode;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  menuModal?: boolean;
}

export function partitionAdminRowActions(actions: readonly AdminRowAction[]) {
  return {
    standard: actions.filter((action) => !action.destructive),
    destructive: actions.filter((action) => action.destructive),
  };
}

function RowActionItem({ action }: { action: AdminRowAction }) {
  const disabledLabel =
    action.disabled && action.disabledReason
      ? `${action.label}（不可用：${action.disabledReason}）`
      : action.label;

  return (
    <DropdownMenuItem
      aria-label={disabledLabel}
      disabled={action.disabled}
      onSelect={() => action.onSelect?.()}
      title={action.disabledReason}
      variant={action.destructive ? 'destructive' : 'default'}
    >
      {action.icon}
      <span className="min-w-0 flex-1">{action.label}</span>
      {action.disabled && action.disabledReason ? (
        <span className="max-w-36 truncate text-[11px] opacity-70">{action.disabledReason}</span>
      ) : null}
    </DropdownMenuItem>
  );
}

/**
 * The menu deliberately exposes no confirmation API. Destructive callbacks
 * should only open the owning module's AdminDeleteDialog (or equivalent
 * confirmation surface); they must not perform deletion directly here.
 */
export function AdminRowActions({
  actions,
  primaryAction,
  triggerLabel = '更多',
  triggerAriaLabel = '更多操作',
  menuModal = false,
}: AdminRowActionsProps) {
  const { standard, destructive } = partitionAdminRowActions(actions);

  if (!primaryAction && actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" data-admin-row-actions>
      {primaryAction}
      {actions.length > 0 ? (
        <DropdownMenu modal={menuModal}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={triggerAriaLabel}
              className={adminSecondaryButtonClassName}
              type="button"
              variant="outline"
            >
              <MoreHorizontal aria-hidden="true" />
              {triggerLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            {...adminThemeAttributes}
            align="end"
            aria-label={triggerAriaLabel}
            className="min-w-48 border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
          >
            {standard.map((action, index) => (
              <Fragment key={action.id}>
                {action.separatorBefore && index > 0 ? (
                  <DropdownMenuSeparator className="bg-[var(--admin-border-subtle)]" />
                ) : null}
                <RowActionItem action={action} />
              </Fragment>
            ))}
            {destructive.length > 0 && standard.length > 0 ? (
              <DropdownMenuSeparator className="bg-[var(--admin-border-subtle)]" />
            ) : null}
            {destructive.map((action) => (
              <RowActionItem action={action} key={action.id} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
