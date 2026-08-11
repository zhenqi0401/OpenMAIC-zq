'use client';

import type { ComponentProps } from 'react';

import { Button } from '@/components/antd/AntdButton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/antd/AntdDialog';

export const AlertDialog = Dialog;
export function AlertDialogTrigger(props: ComponentProps<typeof DialogTrigger>) {
  return (
    <DialogTrigger
      aria-haspopup="dialog"
      data-slot="alert-dialog-trigger"
      {...props}
    />
  );
}
export const AlertDialogContent = DialogContent;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogTitle = DialogTitle;

export function AlertDialogCancel(props: ComponentProps<typeof Button>) {
  return (
    <DialogClose asChild>
      <Button type="button" variant="outline" {...props} />
    </DialogClose>
  );
}

export function AlertDialogAction(props: ComponentProps<typeof Button>) {
  return (
    <DialogClose asChild>
      <Button type="button" {...props} />
    </DialogClose>
  );
}
