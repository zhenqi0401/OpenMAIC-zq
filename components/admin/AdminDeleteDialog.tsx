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
          className="rounded-[4px] border-[#c96f54] text-[#9b4d39] hover:bg-[#fff2ea]"
          disabled={deleting}
          title="删除"
          variant="outline"
        >
          {deleting ? '删除中' : '删除'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[420px] rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] p-0 text-[#2b211d] shadow-[0_18px_50px_rgba(43,33,29,0.18)]">
        <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
          <AlertDialogTitle className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-[#75665d]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[#eaded1] px-5 pb-5 pt-3 sm:justify-end">
          <AlertDialogCancel className="rounded-[4px] border-[#d8c8b9]" disabled={deleting}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-[4px] bg-[#c96f54] text-[#fffaf2] hover:bg-[#b9624a]"
            disabled={deleting}
            onClick={onDelete}
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
