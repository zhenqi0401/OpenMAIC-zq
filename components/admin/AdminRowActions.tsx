'use client';

import type { ReactNode } from 'react';
import { Dropdown, type MenuProps } from 'antd';

import { Button } from '@/components/antd/AntdButton';
import { adminLinkButtonClassName } from '@/components/admin/AdminSurface';

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

function toMenuItem(action: AdminRowAction): NonNullable<MenuProps['items']>[number] {
  const disabledLabel =
    action.disabled && action.disabledReason
      ? `${action.label}（不可用：${action.disabledReason}）`
      : action.label;
  return {
    key: action.id,
    danger: action.destructive,
    disabled: action.disabled,
    icon: action.icon,
    label: (
      <span
        aria-label={disabledLabel}
        className="flex min-w-0 items-center gap-2"
        title={action.disabledReason}
      >
        <span className="min-w-0 flex-1">{action.label}</span>
        {action.disabled && action.disabledReason ? (
          <span className="max-w-36 truncate text-xs opacity-70">{action.disabledReason}</span>
        ) : null}
      </span>
    ),
  };
}

/** Destructive callbacks open their owning module's confirmation surface. */
export function AdminRowActions({
  actions,
  primaryAction,
  triggerLabel = '更多',
  triggerAriaLabel = '更多操作',
}: AdminRowActionsProps) {
  const { standard, destructive } = partitionAdminRowActions(actions);
  if (!primaryAction && actions.length === 0) return null;

  const items: MenuProps['items'] = [];
  standard.forEach((action, index) => {
    if (action.separatorBefore && index > 0) items.push({ type: 'divider' });
    items.push(toMenuItem(action));
  });
  if (destructive.length > 0 && standard.length > 0) items.push({ type: 'divider' });
  destructive.forEach((action) => items.push(toMenuItem(action)));

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" data-admin-row-actions>
      {primaryAction}
      {actions.length > 0 ? (
        <Dropdown
          menu={{
            'aria-label': triggerAriaLabel,
            items,
            onClick: ({ key }) => actions.find((action) => action.id === key)?.onSelect?.(),
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            aria-haspopup="menu"
            aria-label={triggerAriaLabel}
            className={adminLinkButtonClassName}
            type="button"
            variant="link"
          >
            {triggerLabel}
          </Button>
        </Dropdown>
      ) : null}
    </div>
  );
}
