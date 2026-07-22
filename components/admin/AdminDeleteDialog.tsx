'use client';

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
import { Button } from '@/components/ui/button';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import {
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';

export function AdminDeleteDialog({
  title,
  description,
  deleting,
  defaultOpen,
  onDelete,
}: {
  title: string;
  description: string;
  deleting: boolean;
  defaultOpen?: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>
        <Button
          aria-busy={deleting}
          className={adminDangerOutlineButtonClassName}
          disabled={deleting}
          title="删除"
          variant="outline"
        >
          {deleting ? '删除中…' : '删除'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        {...adminThemeAttributes}
        className="max-w-[420px] rounded-[var(--admin-radius-dialog)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-foreground)] shadow-[var(--admin-shadow-popover)]"
      >
        <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
          <AlertDialogTitle className="text-xl font-normal leading-tight tracking-[-0.016em] text-[var(--admin-foreground)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-[var(--admin-muted-foreground)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[var(--admin-border-subtle)] px-5 pb-5 pt-3 sm:justify-end">
          <AlertDialogCancel className={adminSecondaryButtonClassName} disabled={deleting}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={deleting}
            className={adminDangerButtonClassName}
            disabled={deleting}
            onClick={onDelete}
            variant="destructive"
          >
            {deleting ? '删除中…' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
