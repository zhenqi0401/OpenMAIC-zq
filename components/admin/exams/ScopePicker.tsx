'use client';

import { Button } from '@/components/antd/AntdButton';
import { Checkbox, Select } from 'antd';
import { examCourseScopeLabel } from '@/lib/admin/exam-policy-scope';
import type { ExamCategory } from '@/lib/admin/exam-policy-presentation';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export function ScopePicker({
  categories,
  categoryIds,
  courses,
  courseIds,
  onCategoryToggle,
  onClearCourses,
  onCourseToggle,
}: {
  categories: readonly ExamCategory[];
  categoryIds: readonly string[];
  courses: readonly EnterpriseCourse[];
  courseIds: readonly string[];
  onCategoryToggle: (categoryId: string) => void;
  onClearCourses: () => void;
  onCourseToggle: (courseId: string) => void;
}) {
  const emptyText =
    categoryIds.length === 0 ? '请先选择课程分类' : '所选分类下暂无可选的已发布课程';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--admin-muted-foreground)]">
          课程分类
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <span className="text-sm text-[var(--admin-muted-foreground)]">暂无课程分类</span>
          ) : (
            categories.map((category) => (
              <label
                className="inline-flex items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1.5 text-xs"
                key={category.id}
              >
                <Checkbox
                  checked={categoryIds.includes(category.id)}
                  onChange={() => onCategoryToggle(category.id)}
                />
                {category.name}
              </label>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--admin-muted-foreground)]">
          课程范围
        </div>
        <div className="grid gap-2">
          <Select
            aria-label="搜索并选择课程"
            className="w-full min-w-[230px]"
            disabled={categoryIds.length === 0}
            mode="multiple"
            maxTagCount="responsive"
            notFoundContent={emptyText}
            options={courses.map((course) => ({ value: course.id, label: course.name }))}
            placeholder={examCourseScopeLabel([...courseIds])}
            showSearch
            optionFilterProp="label"
            value={[...courseIds]}
            onChange={(nextCourseIds) => {
              if (nextCourseIds.length === 0) {
                onClearCourses();
                return;
              }
              const next = new Set(nextCourseIds);
              courseIds.forEach((courseId) => {
                if (!next.has(courseId)) onCourseToggle(courseId);
              });
              nextCourseIds.forEach((courseId) => {
                if (!courseIds.includes(courseId)) onCourseToggle(courseId);
              });
            }}
          />
          <Button
            className="w-fit rounded-[var(--admin-radius-control)]"
            disabled={courseIds.length === 0}
            onClick={onClearCourses}
            type="button"
            variant="outline"
          >
            恢复全部课程
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--admin-muted-foreground)]">
          空选择表示使用所选分类下全部已发布课程。
        </p>
      </div>
    </div>
  );
}
