'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input, Segmented, Select } from 'antd';
import {
  adminInputClassName,
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

const SEARCH_DEBOUNCE_MS = 400;

export function CourseFilters({
  categories,
  filters,
  onChange,
  onClear,
  onStatusChange,
}: {
  categories: readonly CategoryOption[];
  filters: CourseAdminFilters;
  onChange: (filters: CourseAdminFilters) => void;
  onClear: () => void;
  onStatusChange: (status: CourseAdminStatusFilter) => void;
}) {
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const isFirstRender = useRef(true);

  // 输入立即反映在搜索框，查询提交做 debounce，避免每次击键触发服务端请求。
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      onChange({ ...filters, query: queryDraft });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 query 草稿变化
  }, [queryDraft]);

  useEffect(() => {
    setQueryDraft(filters.query);
  }, [filters.query]);

  return (
    <div className="border-b border-[var(--admin-border-subtle)]" data-course-filters>
      <div
        aria-label="课程状态快捷筛选"
        className="flex flex-wrap gap-1 px-3 pt-3"
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
          allowClear
          aria-label="搜索课程"
          className={adminInputClassName}
          onChange={(event) => setQueryDraft(event.target.value)}
          placeholder="搜索课程、描述或分类"
          value={queryDraft}
        />
        <Select
          aria-label="课程分类"
          className="w-full"
          onChange={(value) => onChange({ ...filters, categoryId: value })}
          value={filters.categoryId}
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
              ...filters,
              visibilityMode: value as CourseVisibilityMode | 'any',
            })
          }
          value={filters.visibilityMode}
          options={[
            { value: 'any', label: '全部可见范围' },
            { value: 'all', label: '全体可见' },
            { value: 'roles', label: '按角色可见' },
          ]}
        />
        <div className="flex gap-2">
          <Button
            className={adminSecondaryButtonClassName}
            onClick={onClear}
            htmlType="button"
          >
            清除筛选
          </Button>
        </div>
      </div>
    </div>
  );
}
