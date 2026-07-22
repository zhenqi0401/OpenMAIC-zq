'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AdminStatusBadge,
  adminInputClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';

interface CategoryOption {
  id: string;
  name: string;
}

export function CategoryDialog({
  categories,
  creating,
  onCreate,
}: {
  categories: readonly CategoryOption[];
  creating: boolean;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [categoryName, setCategoryName] = useState('');

  async function submit() {
    const name = categoryName.trim();
    if (!name) return;
    if (await onCreate(name)) setCategoryName('');
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="rounded-[var(--admin-radius-control)] bg-[var(--admin-action-primary)] text-[var(--admin-surface)]"
          type="button"
        >
          分类管理
        </Button>
      </DialogTrigger>
      <DialogContent
        {...adminThemeAttributes}
        className="max-w-[520px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">分类管理</DialogTitle>
          <DialogDescription>
            当前阶段支持查看和创建分类；重命名与排序将在后续阶段处理。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex gap-2">
            <Input
              aria-label="分类名称"
              className={adminInputClassName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="输入新分类名称"
              value={categoryName}
            />
            <Button
              aria-busy={creating}
              className="rounded-[var(--admin-radius-control)] bg-[var(--admin-action-primary)] text-[var(--admin-surface)]"
              disabled={creating || !categoryName.trim()}
              onClick={submit}
              type="button"
            >
              {creating ? '创建中…' : '创建分类'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-subtle)] p-3">
            {categories.length > 0 ? (
              categories.map((category) => (
                <AdminStatusBadge key={category.id}>{category.name}</AdminStatusBadge>
              ))
            ) : (
              <span className="text-sm text-[var(--admin-muted-foreground)]">暂无分类</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button className={adminSecondaryButtonClassName} type="button" variant="outline">
              关闭
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
