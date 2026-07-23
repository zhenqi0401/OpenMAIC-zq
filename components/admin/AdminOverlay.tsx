'use client';

import type { ComponentProps, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  adminDangerButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { cn } from '@/lib/utils';

interface AdminOverlayProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}

export function AdminDialog({
  trigger,
  title,
  description,
  children,
  contentClassName,
}: AdminOverlayProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        {...adminThemeAttributes}
        className={cn(
          'max-h-[min(720px,calc(100dvh-32px))] max-w-2xl overflow-y-auto rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-[var(--admin-shadow-popover)]',
          contentClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-7">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-5 text-[var(--admin-muted-foreground)]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function AdminDrawer({
  trigger,
  title,
  description,
  children,
  contentClassName,
}: AdminOverlayProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        {...adminThemeAttributes}
        className={cn(
          'inset-y-0 left-auto right-0 top-0 h-[100dvh] max-h-none w-[min(92vw,560px)] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-l-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-[var(--admin-shadow-popover)] data-open:slide-in-from-right data-closed:slide-out-to-right',
          contentClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-7">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-5 text-[var(--admin-muted-foreground)]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        {...adminThemeAttributes}
        className="rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)] shadow-[var(--admin-shadow-popover)]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold leading-7">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-5 text-[var(--admin-muted-foreground)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={adminSecondaryButtonClassName} disabled={busy}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              aria-busy={busy}
              className={adminDangerButtonClassName}
              disabled={busy}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {busy ? '处理中…' : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type AdminDialogContentProps = ComponentProps<typeof DialogContent>;
