import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CourseDeleteDialog,
  CourseAdminPanel,
  CourseListEmptyState,
  DEFAULT_COURSE_ADMIN_FILTERS,
  courseDeleteConfirmationMessage,
  courseGenerationStatusLabel,
  filterAdminCourses,
  shouldApplyCourseAdminFilters,
} from '@/components/admin/courses/CourseAdminPanel';
import { CourseTable } from '@/components/admin/courses/CourseTable';
import {
  buildCourseVisibilityRequest,
  getCourseContentStatus,
  getCourseStatusAction,
} from '@/lib/admin/course-presentation';
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
  learnerCount: 18,
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

  it('derives useful content states without treating every assessed course as a warning', () => {
    expect(getCourseContentStatus(baseCourse)).toEqual({
      label: '缺少课后测评',
      tone: 'warning',
    });
    expect(
      getCourseContentStatus({
        ...baseCourse,
        assessmentQuestions: [{ id: 'question-1' }],
        generationComplete: true,
      }),
    ).toEqual({ label: '已有测评题', tone: 'neutral' });
  });

  it('supports the status shortcuts including the derived review queue', () => {
    const readyDraft = {
      ...baseCourse,
      id: 'course-ready',
      status: 'draft' as const,
      generationComplete: true,
      assessmentQuestions: [{ id: 'question-1' }],
    };
    expect(
      filterAdminCourses([baseCourse, readyDraft], {
        ...DEFAULT_COURSE_ADMIN_FILTERS,
        status: 'review',
      }).map((course) => course.id),
    ).toEqual(['course-1']);
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

  it('keeps the existing visibility API path and request body', () => {
    expect(buildCourseVisibilityRequest('course-1', 'roles', ['role-sales'])).toEqual({
      url: '/api/admin/courses/course-1/visibility',
      init: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibilityMode: 'roles',
          visibleRoleIds: ['role-sales'],
        }),
      },
    });
    expect(
      JSON.parse(buildCourseVisibilityRequest('course-1', 'all', ['role-sales']).init.body),
    ).toEqual({
      visibilityMode: 'all',
      visibleRoleIds: [],
    });
  });

  it('shows learner count, update time, readable visibility, and only one exposed row action', () => {
    const markup = renderToStaticMarkup(
      createElement(CourseTable, {
        courses: [baseCourse],
        roleNames: new Map([['role-sales', '销售学员']]),
        statusChangingCourseId: null,
        onChangeStatus: () => {},
        onDelete: () => {},
        onEditVisibility: () => {},
      }),
    );

    expect(markup).toContain('销售入门');
    expect(markup).toContain('销售学员');
    expect(markup).toContain('>18<');
    expect(markup).toContain('2026-07-02');
    expect(markup).toContain('修改可见范围');
    expect(markup).toContain('更多');
    expect(markup).not.toContain('课程完成率');
    expect(markup.match(/修改可见范围/g)).toHaveLength(1);
    expect(markup).not.toContain('继续生成');
  });

  it('offers a continue-generation entry for every incomplete enterprise course', () => {
    const markup = renderToStaticMarkup(
      createElement(CourseTable, {
        courses: [{ ...baseCourse, generationStatus: 'generating', generationComplete: false }],
        roleNames: new Map(),
        statusChangingCourseId: null,
        onChangeStatus: () => {},
        onDelete: () => {},
        onEditVisibility: () => {},
      }),
    );

    expect(markup).toContain('继续生成');
    expect(markup).toContain('/classroom/course-1');
  });

  it('exposes publish or archive in the more menu according to course status', () => {
    expect(getCourseStatusAction({ status: 'draft' })).toEqual({
      action: 'publish',
      label: '发布',
    });
    expect(getCourseStatusAction({ status: 'published' })).toEqual({
      action: 'archive',
      label: '下架',
    });
    expect(getCourseStatusAction({ status: 'archived' })).toEqual({
      action: 'publish',
      label: '重新发布',
    });
  });

  it('renders category management and a distinct no-course empty state without the old sidebar', () => {
    const markup = renderToStaticMarkup(createElement(CourseAdminPanel));

    // 页面标题下不再出现第二个“课程列表”标题（审计 P0）
    expect(markup).not.toContain('>课程列表<');
    expect(markup).not.toContain('新建课程草稿');
    expect(markup).toContain('课程管理');
    expect(markup).toContain('分类管理');
    expect(markup).not.toContain('新建分类');
    expect(markup).not.toContain('发布结构');
    expect(markup).not.toContain('创建草稿');
    expect(markup).toContain('暂无课程');
    expect(markup).toContain('课程可从首页生成或在课程管理中导入');
    expect(markup).toContain('返回首页生成或导入课程');
    expect(markup).toContain('清除筛选');
    // 单页时只保留“共 N 条”，不渲染翻页按钮
    expect(markup).toContain('共 0 条');
    expect(markup).not.toContain('data-size="icon"');
    expect(markup).not.toContain('课程完成率');
    expect(markup).not.toContain('<aside');
    const categoryActionPosition = markup.indexOf('data-course-category-action');
    const filtersPosition = markup.indexOf('data-course-filters');
    expect(categoryActionPosition).toBeGreaterThan(-1);
    expect(filtersPosition).toBeGreaterThan(categoryActionPosition);
  });

  it('distinguishes an empty catalog from a filter with no matches', () => {
    const emptyMarkup = renderToStaticMarkup(
      createElement(CourseListEmptyState, { hasCourses: false, onClear: () => {} }),
    );
    const filteredMarkup = renderToStaticMarkup(
      createElement(CourseListEmptyState, { hasCourses: true, onClear: () => {} }),
    );

    expect(emptyMarkup).toContain('暂无课程');
    expect(emptyMarkup).toContain('返回首页生成或导入课程');
    expect(emptyMarkup).not.toContain('没有符合当前筛选条件的课程');
    expect(filteredMarkup).toContain('没有符合当前筛选条件的课程');
    expect(filteredMarkup).toContain('清除筛选');
    expect(filteredMarkup).not.toContain('返回首页创建课程');
  });
});
