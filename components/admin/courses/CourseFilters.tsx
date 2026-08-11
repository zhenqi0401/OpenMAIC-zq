'use client';

import { Button, Input, Segmented, Select } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import {
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import type { CourseVisibilityMode } from '@/lib/storage/enterprise-service';
import type { CourseAdminFilters, CourseAdminStatusFilter } from '@/lib/admin/course-presentation';

interface CategoryOption {
  id: string;
  name: string;
}

const statusOptions: Array<{ value: CourseAdminStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已归档' },
  { value: 'review', label: '待复核' },
];

export function CourseFilters({
  categories,
  draft,
  filters,
  onApply,
  onChange,
  onClear,
  onStatusChange,
}: {
  categories: readonly CategoryOption[];
  draft: CourseAdminFilters;
  filters: CourseAdminFilters;
  onApply: () => void;
  onChange: (filters: CourseAdminFilters) => void;
  onClear: () => void;
  onStatusChange: (status: CourseAdminStatusFilter) => void;
}) {
  return (
    <ProForm
      component="div"
      submitter={false}
      className="border-b border-[var(--admin-border-subtle)]"
      data-course-filters
    >
      <div
        aria-label="课程状态快捷筛选"
        className="flex flex-wrap gap-1 border-b border-[var(--admin-border-subtle)] px-3 pt-3"
        role="group"
      >
        <Segmented
          aria-label="课程状态快捷筛选"
          options={statusOptions}
          value={filters.status}
          onChange={(value) => onStatusChange(value as CourseAdminStatusFilter)}
        />
      </div>
      <div className="grid gap-2 p-3 lg:grid-cols-[minmax(200px,1fr)_150px_150px_auto]">
        <Input
          aria-label="搜索课程"
          className={adminInputClassName}
          onChange={(event) => onChange({ ...draft, query: event.target.value })}
          placeholder="搜索课程、描述或分类"
          value={draft.query}
        />
        <Select
          aria-label="课程分类"
          className="w-full"
          onChange={(value) => onChange({ ...draft, categoryId: value })}
          value={draft.categoryId}
          options={[
            { value: '', label: '全部分类' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Select
          aria-label="课程可见范围"
          className="w-full"
          onChange={(value) =>
            onChange({
              ...draft,
              visibilityMode: value as CourseVisibilityMode | 'any',
            })
          }
          value={draft.visibilityMode}
          options={[
            { value: 'any', label: '全部可见范围' },
            { value: 'all', label: '全体可见' },
            { value: 'roles', label: '按角色可见' },
          ]}
        />
        <div className="flex gap-2">
          <Button
            type="primary"
            className={adminPrimaryButtonClassName}
            onClick={onApply}
            htmlType="button"
          >
            筛选
          </Button>
          <Button className={adminSecondaryButtonClassName} onClick={onClear} htmlType="button">
            清除筛选
          </Button>
        </div>
      </div>
    </ProForm>
  );
}
