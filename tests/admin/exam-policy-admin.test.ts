import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ExamPolicyActions,
  ExamPolicyAdminPanel,
} from '@/components/admin/exams/ExamPolicyAdminPanel';
import {
  changeExamCategoryScope,
  examCourseScopeLabel,
  filterExamScopeCourses,
  toggleExamCourseSelection,
} from '@/lib/admin/exam-policy-scope';
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
    assessmentQuestions: [],
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
    assessmentQuestions: [],
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

describe('exam policy course scope', () => {
  it('shows only published courses inside the selected categories', () => {
    expect(filterExamScopeCourses(courses, ['category-sales']).map((course) => course.id)).toEqual([
      'course-sales',
    ]);
  });

  it('uses an empty course list to mean every course in the selected categories', () => {
    expect(examCourseScopeLabel([])).toBe('使用所选分类下全部课程');
    expect(examCourseScopeLabel(['course-sales', 'course-service'])).toBe('已选 2 门');
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
  it('renders visible field and table headings instead of placeholder-only inputs', () => {
    const markup = renderToStaticMarkup(createElement(ExamPolicyAdminPanel));

    for (const heading of [
      '考核名称',
      '目标角色',
      '题量',
      '通过线',
      '限时',
      '题源范围',
      '候选题',
      '状态',
      '操作',
    ]) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain('搜索并选择课程');
  });

  it.each([
    ['draft', ['保存', '发布', '删除']],
    ['published', ['保存', '下架']],
    ['archived', ['保存', '重新发布']],
  ] as const)('renders the complete %s action set', (status, labels) => {
    const markup = renderToStaticMarkup(
      createElement(ExamPolicyActions, {
        policy: {
          id: `policy-${status}`,
          title: '销售阶段考核',
          targetRoleId: 'role-sales',
          categoryIds: ['category-sales'],
          courseIds: [],
          questionCount: 20,
          passThreshold: 80,
          timeLimitMinutes: 45,
          candidateQuestionCount: 30,
          status,
        },
        deleting: false,
        onArchive: () => {},
        onDelete: () => {},
        onPublish: () => {},
        onSave: () => {},
      }),
    );

    for (const label of labels) expect(markup).toContain(label);
    if (status !== 'draft') expect(markup).not.toContain('确认删除');
  });
});
