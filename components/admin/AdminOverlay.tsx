'use client';

import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import { Drawer, Modal, Popconfirm } from 'antd';

import { adminThemeAttributes } from '@/components/admin/admin-theme';
import { cn } from '@/lib/utils';

interface AdminOverlayProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}

function withClick(trigger: ReactNode, onClick: () => void): ReactNode {
  if (isValidElement(trigger)) {
    const element = trigger as ReactElement<{
      onClick?: (event: MouseEvent<HTMLElement>) => void;
    }>;
    return cloneElement(element, {
      onClick: (event) => {
        element.props.onClick?.(event);
        onClick();
      },
    });
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {trigger}
    </span>
  );
}

export function AdminDialog({
  trigger,
  title,
  description,
  children,
  contentClassName,
}: AdminOverlayProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {withClick(trigger, () => setOpen(true))}
      <Modal
        {...adminThemeAttributes}
        centered
        destroyOnHidden
        footer={null}
        open={open}
        title={title}
        width={720}
        className={cn('max-h-[calc(100dvh-32px)]', contentClassName)}
        onCancel={() => setOpen(false)}
      >
        {description ? (
          <p className="mb-4 text-sm text-[var(--admin-muted-foreground)]">{description}</p>
        ) : null}
        {children}
      </Modal>
    </>
  );
}

export function AdminDrawer({
  trigger,
  title,
  description,
  children,
  contentClassName,
}: AdminOverlayProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {withClick(trigger, () => setOpen(true))}
      <Drawer
        {...adminThemeAttributes}
        destroyOnHidden
        open={open}
        title={title}
        className={contentClassName}
        onClose={() => setOpen(false)}
      >
        {description ? (
          <p className="mb-4 text-sm text-[var(--admin-muted-foreground)]">{description}</p>
        ) : null}
        {children}
      </Drawer>
    </>
  );
}

export function AdminDangerConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = '确认操作',
  busy = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={busy ? '处理中…' : confirmLabel}
      cancelText="取消"
      okButtonProps={{ danger: true, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      onConfirm={onConfirm}
    >
      {trigger}
    </Popconfirm>
  );
}

export type AdminDialogContentProps = ComponentProps<typeof Modal>;
