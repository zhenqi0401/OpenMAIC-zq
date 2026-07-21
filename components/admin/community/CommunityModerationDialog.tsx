'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminNotice,
  adminSecondaryButtonClassName,
  adminThemeStyle,
} from '@/components/admin/AdminSurface';
import {
  COMMUNITY_REASON_PRESETS,
  type AdminCommunityItem,
  type CommunityModerationAction,
  communityActionLabel,
  communityItemSummary,
  composeModerationReason,
  moderationRequiresReason,
} from '@/lib/admin/community-presentation';

export function CommunityModerationDialog({
  action,
  error,
  item,
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  action: CommunityModerationAction | null;
  error: string | null;
  item: AdminCommunityItem | null;
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}) {
  const [preset, setPreset] = useState('');
  const [detail, setDetail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!item || !action) return null;

  const actionLabel = communityActionLabel(action);
  const reasonRequired = moderationRequiresReason(action);

  function submit() {
    const reason = composeModerationReason(preset, detail);
    if (reasonRequired && !reason) {
      setValidationError('请选择原因，或填写补充说明。');
      return;
    }
    setValidationError(null);
    onSubmit(reason);
  }

  return (
    <Dialog onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)} open={open}>
      <DialogContent
        className="max-w-[540px] rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]"
        style={adminThemeStyle}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">确认{actionLabel}</DialogTitle>
          <DialogDescription>
            即将{actionLabel}以下社区内容。处理结果会进入现有操作审计记录。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-[4px] border border-[#d8c8b9] bg-[#f7eee3] p-3">
            <span className="text-xs text-[#75665d]">内容摘要</span>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6">
              {communityItemSummary(item)}
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              管理原因{reasonRequired ? <span className="text-red-700">（必填）</span> : '（可选）'}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMMUNITY_REASON_PRESETS.map((reason) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] border border-[#d8c8b9] px-3 py-2 text-sm"
                  key={reason}
                >
                  <input
                    checked={preset === reason}
                    disabled={submitting}
                    name="community-moderation-reason"
                    onChange={() => {
                      setPreset(reason);
                      setValidationError(null);
                    }}
                    type="radio"
                  />
                  {reason}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm font-medium">
            补充说明
            <Textarea
              aria-label="补充说明"
              className="min-h-24 rounded-[4px] border-[#d8c8b9] bg-[#fffdf8]"
              disabled={submitting}
              onChange={(event) => {
                setDetail(event.target.value);
                setValidationError(null);
              }}
              placeholder={
                preset === '其他' ? '选择“其他”时，请在这里说明具体原因' : '可补充具体情况'
              }
              value={detail}
            />
          </label>

          {validationError ? <AdminNotice tone="error">{validationError}</AdminNotice> : null}
          {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              className={adminSecondaryButtonClassName}
              disabled={submitting}
              type="button"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            aria-busy={submitting}
            className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? '处理中…' : `确认${actionLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
