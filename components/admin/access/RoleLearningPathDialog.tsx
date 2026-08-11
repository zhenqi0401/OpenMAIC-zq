'use client';
import { useEffect, useState } from 'react';
import { Select } from 'antd';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/antd/AntdDialog';
import { Button } from '@/components/antd/AntdButton';
import {
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import type { AuthRole } from '@/lib/auth/service';

export function RoleLearningPathDialog({
  role,
  onOpenChange,
}: {
  role: AuthRole | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [available, setAvailable] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!role) return;
    Promise.all([
      fetch(`/api/admin/roles/${role.id}/learning-path`),
      fetch('/api/admin/courses?pageSize=100'),
    ]).then(async ([pathResponse, coursesResponse]) => {
      const path = (await pathResponse.json()) as { courses?: Array<{ courseId: string }> };
      const catalog = (await coursesResponse.json()) as {
        courses?: Array<{
          id: string;
          name: string;
          status: string;
          generationComplete?: boolean;
          assessmentQuestions?: unknown[];
        }>;
      };
      const pathCourses = path.courses ?? [];
      setSelected(pathCourses.map((item) => item.courseId));
      setAvailable(
        (catalog.courses ?? []).filter(
          (course) =>
            course.status === 'published' &&
            course.generationComplete &&
            (course.assessmentQuestions?.length ?? 0) > 0,
        ),
      );
    });
  }, [role]);
  async function save() {
    if (!role) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${role.id}/learning-path`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: selected }),
      });
      if (!response.ok) throw new Error('学习路径保存失败');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(role)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>配置学习路径 · {role?.name}</DialogTitle>
          <DialogDescription>课程顺序用于展示和学习建议，不会锁定选修课。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {(selected.length ? selected : ['']).map((id, index) => {
            return (
              <div className="flex items-center gap-2" key={`${id}-${index}`}>
                <span className="w-6 text-sm">{index + 1}.</span>
                <Select
                  className="min-h-10 flex-1"
                  value={id}
                  onChange={(nextValue) =>
                    setSelected((current) =>
                      current.map((currentValue, cursor) =>
                        cursor === index ? nextValue : currentValue,
                      ),
                    )
                  }
                  options={[
                    { value: '', label: '选择课程' },
                    ...available.map((course) => ({ value: course.id, label: course.name })),
                  ]}
                />
                <Button
                  className={adminSecondaryButtonClassName}
                  onClick={() =>
                    setSelected((current) => current.filter((_value, cursor) => cursor !== index))
                  }
                  type="button"
                  variant="outline"
                >
                  移除
                </Button>
              </div>
            );
          })}
          <Button
            className={adminSecondaryButtonClassName}
            onClick={() => setSelected((current) => [...current, ''])}
            type="button"
            variant="outline"
          >
            加入课程
          </Button>
          <Button
            className={adminPrimaryButtonClassName}
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? '保存中…' : '保存学���路径'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
