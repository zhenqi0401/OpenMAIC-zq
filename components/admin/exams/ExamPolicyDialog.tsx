'use client';

import type { ReactNode } from 'react';
import {
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import { ScopePicker } from '@/components/admin/exams/ScopePicker';
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
import { Input } from '@/components/ui/input';
import type { ExamCategory, ExamPolicyDraft } from '@/lib/admin/exam-policy-presentation';
import type { AuthRole } from '@/lib/auth/service';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export function ExamPolicyDialog({
  mode,
  open,
  draft,
  roles,
  categories,
  courses,
  candidateQuestionCount,
  saving,
  onDraftChange,
  onOpenChange,
  onSave,
  onCategoryToggle,
  onClearCourses,
  onCourseToggle,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  draft: ExamPolicyDraft;
  roles: readonly AuthRole[];
  categories: readonly ExamCategory[];
  courses: readonly EnterpriseCourse[];
  candidateQuestionCount: number;
  saving: boolean;
  onDraftChange: (patch: Partial<ExamPolicyDraft>) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onCategoryToggle: (categoryId: string) => void;
  onClearCourses: () => void;
  onCourseToggle: (courseId: string) => void;
}) {
  const valid =
    draft.title.trim().length > 0 && draft.targetRoleId.length > 0 && draft.categoryIds.length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...adminThemeAttributes}
        className="max-h-[90vh] max-w-[760px] overflow-y-auto rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">
            {mode === 'create' ? '新建考核' : '编辑考核'}
          </DialogTitle>
          <DialogDescription>
            创建和编辑只调整现有策略配置；保存后再从列表执行发布或下架。
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-4">
          <h3 className="font-medium">基础设置</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field className="sm:col-span-2" label="考核名称">
              <Input
                aria-label="考核名称"
                className={adminInputClassName}
                onChange={(event) => onDraftChange({ title: event.target.value })}
                placeholder="例如：销售入职阶段考核"
                value={draft.title}
              />
            </Field>
            <Field className="sm:col-span-2" label="目标角色">
              <select
                aria-label="目标角色"
                className={adminSelectClassName}
                onChange={(event) => onDraftChange({ targetRoleId: event.target.value })}
                value={draft.targetRoleId}
              >
                <option value="">请选择角色</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="题量">
              <NumberInput
                ariaLabel="题量"
                min={1}
                onChange={(questionCount) => onDraftChange({ questionCount })}
                value={draft.questionCount}
              />
            </Field>
            <Field label="通过线">
              <NumberInput
                ariaLabel="通过线"
                max={100}
                min={0}
                onChange={(passThreshold) => onDraftChange({ passThreshold })}
                value={draft.passThreshold}
              />
            </Field>
            <Field label="限时">
              <Input
                aria-label="限时"
                className={adminInputClassName}
                min={1}
                onChange={(event) => onDraftChange({ timeLimitMinutes: event.target.value })}
                placeholder="分钟"
                type="number"
                value={draft.timeLimitMinutes}
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">题源范围</h3>
            <span className="text-xs tabular-nums text-[var(--admin-muted-foreground)]">
              当前范围可提供 {candidateQuestionCount} 道候选题
            </span>
          </div>
          <ScopePicker
            categories={categories}
            categoryIds={draft.categoryIds}
            courseIds={draft.courseIds}
            courses={courses}
            onCategoryToggle={onCategoryToggle}
            onClearCourses={onClearCourses}
            onCourseToggle={onCourseToggle}
          />
        </section>

        <DialogFooter>
          <DialogClose asChild>
            <Button className={adminSecondaryButtonClassName} disabled={saving} variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button
            aria-busy={saving}
            className={adminPrimaryButtonClassName}
            disabled={saving || !valid}
            onClick={onSave}
            type="button"
          >
            {saving ? '保存中…' : mode === 'create' ? '保存草稿' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaLabel: string;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      className={adminInputClassName}
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      type="number"
      value={value}
    />
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-label={label} className={`grid gap-1.5 ${className}`} role="group">
      <span className="text-xs font-medium text-[var(--admin-muted-foreground)]">{label}</span>
      {children}
    </div>
  );
}
