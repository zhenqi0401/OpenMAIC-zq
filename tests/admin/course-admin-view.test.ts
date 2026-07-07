import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CourseDeleteDialog,
  CourseAdminPanel,
  DEFAULT_COURSE_ADMIN_FILTERS,
  courseDeleteConfirmationMessage,
  courseGenerationStatusLabel,
  filterAdminCourses,
  shouldApplyCourseAdminFilters,
} from '@/components/admin/courses/CourseAdminPanel';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

const baseCourse: EnterpriseCourse = {
  id: 'course-1',
  name: '销售入门',
  description: '销售新人课程',
  categoryId: 'category-sales',
  categoryName: '销售',
  status: 'published',
  visibilityMode: 'roles',
  visibleRoleIds: ['role-sales'],
  assessmentQuestions: [],
  publishedAt: new Date('2026-07-01T00:00:00.000Z'),
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-07-02T00:00:00.000Z'),
};

describe('filterAdminCourses', () => {
  it('filters courses by status, category, visibility, and keyword', () => {
    const courses: EnterpriseCourse[] = [
      baseCourse,
      {
        ...baseCourse,
        id: 'course-2',
        name: '服务复盘',
        categoryId: 'category-service',
        categoryName: '服务',
        status: 'draft',
        visibilityMode: 'all',
      },
    ];

    expect(
      filterAdminCourses(courses, {
        status: 'published',
        categoryId: 'category-sales',
        visibilityMode: 'roles',
        query: '新人',
      }).map((course) => course.id),
    ).toEqual(['course-1']);
  });

  it('labels incomplete generated drafts for admin visibility', () => {
    expect(
      courseGenerationStatusLabel({
        ...baseCourse,
        status: 'draft',
        generationStatus: 'generating',
        generationComplete: false,
      }),
    ).toBe('生成中');

    expect(
      courseGenerationStatusLabel({
        ...baseCourse,
        status: 'draft',
        generationStatus: 'draft',
        generationComplete: false,
      }),
    ).toBe('内容未完成');

    expect(
      courseGenerationStatusLabel({
        ...baseCourse,
        status: 'published',
        generationStatus: 'ready',
        generationComplete: true,
      }),
    ).toBeNull();
  });

  it('keeps filter edits staged until the admin clicks the filter button', () => {
    expect(shouldApplyCourseAdminFilters(DEFAULT_COURSE_ADMIN_FILTERS)).toBe(false);
    expect(
      shouldApplyCourseAdminFilters({
        ...DEFAULT_COURSE_ADMIN_FILTERS,
        status: 'draft',
      }),
    ).toBe(true);
  });

  it('warns admins that course deletion removes PostgreSQL-backed related data', () => {
    expect(courseDeleteConfirmationMessage(baseCourse)).toBe(
      '确认删除课程「销售入门」？该操作会同时删除这门课程在数据库中的内容、学习进度和测评记录，且不可恢复。',
    );
  });

  it('renders course deletion as an alert dialog instead of a browser confirm', () => {
    const markup = renderToStaticMarkup(
      createElement(CourseDeleteDialog, {
        course: baseCourse,
        deleting: false,
        defaultOpen: true,
        onDelete: () => {},
      }),
    );

    expect(markup).toContain('data-slot="alert-dialog-trigger"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('删除');
  });

  it('renders the streamlined course layout with text buttons', () => {
    const markup = renderToStaticMarkup(createElement(CourseAdminPanel));

    expect(markup).toContain('课程分类');
    expect(markup).toContain('新建课程草稿');
    expect(markup).toContain('发布结构');
    expect(markup).toContain('创建草稿');
    expect(markup).not.toContain('data-size="icon"');
  });
});
