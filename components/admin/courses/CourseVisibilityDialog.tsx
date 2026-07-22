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
import { adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import type { CourseVisibilityMode, EnterpriseCourse } from '@/lib/storage/enterprise-service';
import type { AuthRole } from '@/lib/auth/service';

export interface CourseVisibilityDraft {
  visibilityMode: CourseVisibilityMode;
  visibleRoleIds: string[];
}

export function CourseVisibilityDialog({
  course,
  open,
  roles,
  saving,
  onOpenChange,
  onSave,
}: {
  course: EnterpriseCourse | null;
  open: boolean;
  roles: readonly AuthRole[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: CourseVisibilityDraft) => void;
}) {
  if (!course) return null;

  return (
    <CourseVisibilityDialogContent
      course={course}
      key={course.id}
      onOpenChange={onOpenChange}
      onSave={onSave}
      open={open}
      roles={roles}
      saving={saving}
    />
  );
}

function CourseVisibilityDialogContent({
  course,
  open,
  roles,
  saving,
  onOpenChange,
  onSave,
}: {
  course: EnterpriseCourse;
  open: boolean;
  roles: readonly AuthRole[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: CourseVisibilityDraft) => void;
}) {
  const [draft, setDraft] = useState<CourseVisibilityDraft>({
    visibilityMode: course.visibilityMode,
    visibleRoleIds: [...course.visibleRoleIds],
  });

  function setMode(visibilityMode: CourseVisibilityMode) {
    setDraft((current) => ({
      visibilityMode,
      visibleRoleIds: visibilityMode === 'all' ? [] : current.visibleRoleIds,
    }));
  }

  function toggleRole(roleId: string) {
    setDraft((current) => ({
      visibilityMode: 'roles',
      visibleRoleIds: current.visibleRoleIds.includes(roleId)
        ? current.visibleRoleIds.filter((id) => id !== roleId)
        : [...current.visibleRoleIds, roleId],
    }));
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...adminThemeAttributes}
        className="max-w-[520px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">修改可见范围</DialogTitle>
          <DialogDescription>{`设置「${course.name}」对哪些学员角色可见。`}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="flex items-start gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] p-3">
            <input
              checked={draft.visibilityMode === 'all'}
              name="visibility-mode"
              onChange={() => setMode('all')}
              type="radio"
            />
            <span>
              <strong className="block font-medium">全体可见</strong>
              <span className="text-xs text-[var(--admin-muted-foreground)]">
                所有可以进入学习端的用户都能看到。
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] p-3">
            <input
              checked={draft.visibilityMode === 'roles'}
              name="visibility-mode"
              onChange={() => setMode('roles')}
              type="radio"
            />
            <span>
              <strong className="block font-medium">按角色可见</strong>
              <span className="text-xs text-[var(--admin-muted-foreground)]">
                仅勾选的学员角色可以看到。
              </span>
            </span>
          </label>
          {draft.visibilityMode === 'roles' ? (
            <fieldset className="grid gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-subtle)] p-3 sm:grid-cols-2">
              <legend className="sr-only">可见角色</legend>
              {roles.length === 0 ? (
                <p className="text-sm text-[var(--admin-muted-foreground)]">暂无可选学员角色</p>
              ) : (
                roles.map((role) => (
                  <label className="flex items-center gap-2 text-sm" key={role.id}>
                    <input
                      checked={draft.visibleRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      type="checkbox"
                    />
                    {role.name}
                  </label>
                ))
              )}
            </fieldset>
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
            className="rounded-[var(--admin-radius-control)] bg-[var(--admin-action-primary)] text-[var(--admin-surface)]"
            disabled={
              saving || (draft.visibilityMode === 'roles' && draft.visibleRoleIds.length === 0)
            }
            onClick={() => onSave(draft)}
            type="button"
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
