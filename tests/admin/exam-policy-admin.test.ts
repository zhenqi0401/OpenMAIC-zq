import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';
import { ExamPolicyTable } from '@/components/admin/exams/ExamPolicyTable';
import { ExamReadinessSummary } from '@/components/admin/exams/ExamReadinessSummary';
import { ScopePicker } from '@/components/admin/exams/ScopePicker';
import {
  changeExamCategoryScope,
  examCourseScopeLabel,
  filterExamScopeCourses,
  toggleExamCourseSelection,
} from '@/lib/admin/exam-policy-scope';
import {
  countDraftCandidateQuestions,
  createEmptyPolicyDraft,
  getExamReadiness,
  getPolicyMenuLabels,
  toPolicyDraft,
} from '@/lib/admin/exam-policy-presentation';
import type { AdminExamPolicy } from '@/lib/admin/client';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

const courses: EnterpriseCourse[] = [
  {
    id: 'course-sales',
    name: '销售入门',
    description: null,
    categoryId: 'category-sales',
    categoryName: '销售',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [{ id: 'q1' }, { id: 'q2' }] as EnterpriseCourse['assessmentQuestions'],
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-06-30T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  },
  {
    id: 'course-draft',
    name: '销售草稿',
    description: null,
    categoryId: 'category-sales',
    categoryName: '销售',
    status: 'draft',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [{ id: 'draft-q' }] as EnterpriseCourse['assessmentQuestions'],
    publishedAt: null,
    createdAt: new Date('2026-06-30T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  },
  {
    id: 'course-service',
    name: '服务规范',
    description: null,
    categoryId: 'category-service',
    categoryName: '服务',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-06-30T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  },
];

const policy: AdminExamPolicy = {
  id: 'policy-draft',
  title: '销售阶段考核',
  targetRoleId: 'role-sales',
  categoryIds: ['category-sales'],
  courseIds: [],
  questionCount: 20,
  passThreshold: 80,
  timeLimitMinutes: 45,
  candidateQuestionCount: 12,
  status: 'draft',
};

describe('exam policy course scope', () => {
  it('shows only published courses inside the selected categories', () => {
    expect(filterExamScopeCourses(courses, ['category-sales']).map((course) => course.id)).toEqual([
      'course-sales',
    ]);
  });

  it('uses an empty course list to mean every course in the selected categories', () => {
    expect(examCourseScopeLabel([])).toBe('使用所选分类下全部课程');
    expect(examCourseScopeLabel(['course-sales', 'course-service'])).toBe('已选 2 门');
    expect(
      countDraftCandidateQuestions(courses, {
        ...createEmptyPolicyDraft(),
        categoryIds: ['category-sales'],
        courseIds: [],
      }),
    ).toBe(2);
  });

  it('shows the course scope selection once and keeps the empty-selection explanation distinct', () => {
    const markup = renderToStaticMarkup(
      createElement(ScopePicker, {
        categories: [{ id: 'category-sales', name: '销售', sortOrder: 1 }],
        categoryIds: ['category-sales'],
        courses: [courses[0]],
        courseIds: [],
        onCategoryToggle: () => {},
        onClearCourses: () => {},
        onCourseToggle: () => {},
      }),
    );
    expect(markup.match(/使用所选分类下全部课程/g)).toHaveLength(1);
    expect(markup).toContain('空选择表示使用所选分类下全部已发布课程');
  });

  it('supports multi-select and resets concrete courses when categories change', () => {
    expect(toggleExamCourseSelection(['course-sales'], 'course-service')).toEqual([
      'course-sales',
      'course-service',
    ]);
    expect(toggleExamCourseSelection(['course-sales'], 'course-sales')).toEqual([]);
    expect(
      changeExamCategoryScope(['category-sales'], ['course-sales'], 'category-service'),
    ).toEqual({
      categoryIds: ['category-sales', 'category-service'],
      courseIds: [],
    });
  });
});

describe('ExamPolicyAdminPanel', () => {
  it('makes the list the default view and keeps the create form inside a dialog', () => {
    const markup = renderToStaticMarkup(createElement(ExamPolicyAdminPanel));
    expect(markup).toContain('新建考核');
    expect(markup).toContain('考核策略列表');
    expect(markup).toContain('题库准备摘要');
    expect(markup).toContain('搜索考核名称或目标角色');
    expect(markup).toContain('data-exam-policy-list="true"');
    expect(markup).toContain('data-exam-policy-filters="true"');
    expect(markup).not.toContain('基础设置');

    const source = readFileSync('components/admin/exams/ExamPolicyAdminPanel.tsx', 'utf8');
    expect(source).toContain('onClick={openCreateDialog}');
    expect(source).toContain('setDialogDraft(toPolicyDraft(policy))');
    expect(source.indexOf('data-exam-policy-list')).toBeLessThan(
      source.indexOf('data-exam-policy-filters'),
    );
    expect(source).toContain('toast.success(message, { style: successToastStyle })');
    expect(source).toContain('toast.error(error instanceof Error ? error.message : fallback');
  });

  it('loads every editable field from the selected policy', () => {
    expect(toPolicyDraft(policy)).toEqual({
      title: '销售阶段考核',
      targetRoleId: 'role-sales',
      categoryIds: ['category-sales'],
      courseIds: [],
      questionCount: 20,
      passThreshold: 80,
      timeLimitMinutes: '45',
    });
  });

  it('shows the three real course readiness counts without a made-up question total', () => {
    const readiness = getExamReadiness(courses);
    expect(readiness).toEqual({
      publishedCourseCount: 2,
      readyCourseCount: 1,
      missingQuestionCourseCount: 1,
    });
    const markup = renderToStaticMarkup(createElement(ExamReadinessSummary, { readiness }));
    expect(markup).toContain('已发布课程 2');
    expect(markup).toContain('有课后题 1');
    expect(markup).toContain('缺少课后题 1');
    expect(markup).not.toContain('总题库');
  });

  it('renders a read-only list with coverage and candidate health instead of editable inputs', () => {
    const markup = renderToStaticMarkup(
      createElement(ExamPolicyTable, {
        policies: [policy],
        roleNames: new Map([['role-sales', '销售学员']]),
        categoryNames: new Map([['category-sales', '销售']]),
        deletingPolicyId: null,
        onEdit: () => {},
        onPublish: () => {},
        onArchive: () => {},
        onDelete: () => {},
        onView: () => {},
      }),
    );
    for (const heading of [
      '考核名称',
      '目标角色',
      '覆盖范围',
      '题量',
      '候选题数',
      '通过线',
      '限时',
      '状态',
      '操作',
    ]) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain('编辑');
    expect(markup).not.toContain('题量充足');
    expect(markup).not.toContain('候选题不足');
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('参与人数');
    expect(markup).not.toContain('通过率');
  });

  it.each([
    ['draft', ['发布', '删除']],
    ['published', ['下架']],
    ['archived', ['重新发布']],
  ] as const)('exposes only the allowed %s menu actions', (status, labels) => {
    expect(getPolicyMenuLabels(status)).toEqual(labels);
  });
});
