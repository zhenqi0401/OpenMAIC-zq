'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  adminInputClassName,
  adminSecondaryButtonClassName,
  adminSelectClassName,
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
    <div className="border-b border-[#eaded1]" data-course-filters>
      <div
        aria-label="课程状态快捷筛选"
        className="flex flex-wrap gap-1 border-b border-[#eaded1] px-3 pt-3"
        role="group"
      >
        {statusOptions.map((option) => {
          const active = filters.status === option.value;
          return (
            <Button
              aria-pressed={active}
              className={`rounded-b-none border-b-2 px-3 ${
                active
                  ? 'border-[#c96f54] bg-[#f1e2d0] text-[#2b211d]'
                  : 'border-transparent text-[#75665d]'
              }`}
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              type="button"
              variant="ghost"
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      <div className="grid gap-2 p-3 lg:grid-cols-[minmax(200px,1fr)_150px_150px_auto]">
        <Input
          aria-label="搜索课程"
          className={adminInputClassName}
          onChange={(event) => onChange({ ...draft, query: event.target.value })}
          placeholder="搜索课程、描述或分类"
          value={draft.query}
        />
        <select
          aria-label="课程分类"
          className={adminSelectClassName}
          onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}
          value={draft.categoryId}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="课程可见范围"
          className={adminSelectClassName}
          onChange={(event) =>
            onChange({
              ...draft,
              visibilityMode: event.target.value as CourseVisibilityMode | 'any',
            })
          }
          value={draft.visibilityMode}
        >
          <option value="any">全部可见范围</option>
          <option value="all">全体可见</option>
          <option value="roles">按角色可见</option>
        </select>
        <div className="flex gap-2">
          <Button
            className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
            onClick={onApply}
            type="button"
          >
            筛选
          </Button>
          <Button
            className={adminSecondaryButtonClassName}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            清除筛选
          </Button>
        </div>
      </div>
    </div>
  );
}
