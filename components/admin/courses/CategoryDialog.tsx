'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/antd/AntdButton';
import { Input } from 'antd';
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
import {
  adminPrimaryButtonClassName,
  adminInputClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import { AdminDangerConfirmDialog } from '@/components/admin/AdminOverlay';

interface CategoryOption {
  id: string;
  name: string;
  sortOrder?: number;
  scope?: 'platform' | 'tenant';
  managementMode?: 'editable' | 'read_only';
  categoryKey?: string | null;
  isSystem?: boolean;
}

export function CategoryDialog({
  categories,
  busyId,
  creating,
  onCreate,
  onDelete,
  onRename,
  onReorder,
}: {
  categories: readonly CategoryOption[];
  busyId: string | null;
  creating: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onReorder: (ids: string[]) => Promise<boolean>;
}) {
  const [categoryName, setCategoryName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const editableCategories = categories.filter(
    (category) => category.managementMode !== 'read_only',
  );

  function reorder(categoryId: string, direction: -1 | 1) {
    const ids = editableCategories.map((item) => item.id);
    const index = ids.indexOf(categoryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void onReorder(ids);
  }

  async function submit() {
    const name = categoryName.trim();
    if (!name) return;
    if (await onCreate(name)) setCategoryName('');
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={adminPrimaryButtonClassName} type="button">
          分类管理
        </Button>
      </DialogTrigger>
      <DialogContent
        {...adminThemeAttributes}
        className="max-w-[520px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">分类管理</DialogTitle>
          <DialogDescription>创建、重命名、调整顺序或删除未被课程使用的空分类。</DialogDescription>
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
              className={adminPrimaryButtonClassName}
              disabled={creating || !categoryName.trim()}
              onClick={submit}
              type="button"
            >
              {creating ? '创建中…' : '创建分类'}
            </Button>
          </div>
          <div className="grid gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-subtle)] p-3">
            {categories.length > 0 ? (
              categories.map((category) => (
                <div className="flex min-w-0 items-center gap-2" key={category.id}>
                  <Input
                    aria-label={`${category.name}分类名称`}
                    className={`${adminInputClassName} min-w-0 flex-1`}
                    disabled={category.managementMode === 'read_only' || category.isSystem}
                    onChange={(event) =>
                      setNames((current) => ({ ...current, [category.id]: event.target.value }))
                    }
                    value={names[category.id] ?? category.name}
                  />
                  <Button
                    disabled={
                      busyId === category.id ||
                      category.managementMode === 'read_only' ||
                      category.isSystem
                    }
                    onClick={() =>
                      void onRename(category.id, (names[category.id] ?? category.name).trim())
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    保存
                  </Button>
                  <Button
                    aria-label="上移分类"
                    disabled={
                      category.managementMode === 'read_only' ||
                      editableCategories.findIndex((item) => item.id === category.id) === 0 ||
                      busyId === 'reorder'
                    }
                    onClick={() => reorder(category.id, -1)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    aria-label="下移分类"
                    disabled={
                      category.managementMode === 'read_only' ||
                      editableCategories.findIndex((item) => item.id === category.id) ===
                        editableCategories.length - 1 ||
                      busyId === 'reorder'
                    }
                    onClick={() => reorder(category.id, 1)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <AdminDangerConfirmDialog
                    busy={busyId === category.id}
                    confirmLabel="删除分类"
                    description={`确认删除分类「${category.name}」？仅空分类可以删除。`}
                    onConfirm={() => void onDelete(category.id)}
                    title="删除分类"
                    trigger={
                      <Button
                        aria-label={`删除分类${category.name}`}
                        disabled={category.managementMode === 'read_only' || category.isSystem}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
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
