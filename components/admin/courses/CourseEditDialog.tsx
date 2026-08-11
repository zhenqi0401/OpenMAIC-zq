'use client';

import { useState } from 'react';
import { Input, Select } from 'antd';
import { Button } from '@/components/antd/AntdButton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/antd/AntdDialog';
import {
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

interface CategoryOption {
  id: string;
  name: string;
  scope?: 'platform' | 'tenant';
  categoryKey?: string | null;
}

export function CourseEditDialog({
  course,
  categories,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  course: EnterpriseCourse | null;
  categories: readonly CategoryOption[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: { name: string; categoryId: string }) => void;
}) {
  if (!course) return null;
  return (
    <CourseEditDialogContent
      categories={categories}
      course={course}
      key={course.id}
      onOpenChange={onOpenChange}
      onSave={onSave}
      open={open}
      saving={saving}
    />
  );
}

function CourseEditDialogContent({
  course,
  categories,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  course: EnterpriseCourse;
  categories: readonly CategoryOption[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: { name: string; categoryId: string }) => void;
}) {
  const [name, setName] = useState(course.name);
  const [categoryId, setCategoryId] = useState(course.categoryId);
  const valid = name.trim().length > 0 && categoryId.length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...adminThemeAttributes}
        className="max-w-[520px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">修改课程信息</DialogTitle>
          <DialogDescription>修改课程名称和所属分类。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            课程名称
            <Input
              aria-label="课程名称"
              className="!h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus:border-[var(--admin-selection-border)]"
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            课程分类
            <Select
              aria-label="课程分类"
              className="w-full"
              disabled={saving}
              onChange={(value) => setCategoryId(value)}
              value={categoryId}
              options={categories.map((category) => ({
                value: category.id,
                label: `${category.name}${category.scope === 'platform' ? '（平台固定分类）' : ''}`,
              }))}
            />
          </label>
          {course.scope === 'platform' ? (
            <p className="text-sm text-[var(--admin-warning)]">平台精品课程只读，不能修改。</p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button className={adminSecondaryButtonClassName} disabled={saving} variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button
            aria-busy={saving}
            className={adminPrimaryButtonClassName}
            disabled={saving || !valid || course.scope === 'platform'}
            onClick={() => onSave({ name: name.trim(), categoryId })}
          >
            {saving ? '保存中…' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
