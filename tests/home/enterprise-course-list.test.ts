import { describe, expect, test, vi } from 'vitest';

import {
  changeHomeCourseCategory,
  changeHomeCourseScope,
  filterHomeCourses,
  loadEnterpriseHomeCatalog,
  loadEnterpriseHomeCourseThumbnails,
  loadLearnerHomeCourses,
  sortHomeCourses,
  type EnterpriseHomeCourse,
} from '@/lib/home/enterprise-course-list';

function course(
  id: string,
  scope: 'platform' | 'tenant',
  overrides: Partial<EnterpriseHomeCourse> = {},
): EnterpriseHomeCourse {
  return {
    id,
    name: id,
    description: '',
    sceneCount: 1,
    createdAt: 1,
    updatedAt: 1,
    source: 'enterprise',
    scope,
    categoryId: scope === 'platform' ? 'category-platform' : 'category-tenant',
    categoryName: scope === 'platform' ? '精品分类' : '企业分类',
    categoryKey: 'management',
    learnerCount: 0,
    ...overrides,
  };
}

describe('learner home server course catalogue', () => {
  test('parses course and category scopes from the learner API response', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/courses');
      return Response.json({
        success: true,
        courses: [
          {
            id: 'course-platform',
            name: '精品领导力',
            description: '平台发布课程',
            categoryId: 'category-platform',
            categoryName: '精品分类',
            scope: 'platform',
            updatedAt: '2026-07-06T06:00:00.000Z',
            createdAt: '2026-07-05T06:00:00.000Z',
            generationComplete: true,
            learnerCount: 12.9,
            sceneCount: 6.8,
          },
          {
            id: 'course-tenant',
            name: '企业销售规范',
            categoryId: 'category-tenant',
            categoryName: '管理知识',
            scope: 'tenant',
            updatedAt: '2026-07-04T06:00:00.000Z',
            createdAt: '2026-07-03T06:00:00.000Z',
            learnerCount: -3,
          },
        ],
        categories: [
          {
            id: 'category-platform',
            name: '精品分类',
            sortOrder: 5,
            scope: 'platform',
            categoryKey: 'management',
            isSystem: true,
          },
          {
            id: 'category-tenant',
            name: '管理知识',
            sortOrder: 10,
            scope: 'tenant',
            categoryKey: 'management',
            isSystem: true,
          },
        ],
      });
    });

    await expect(loadEnterpriseHomeCatalog(fetcher)).resolves.toEqual({
      courses: [
        {
          id: 'course-platform',
          name: '精品领导力',
          description: '平台发布课程',
          categoryId: 'category-platform',
          categoryKey: 'management',
          categoryName: '精品分类',
          sceneCount: 6,
          createdAt: Date.parse('2026-07-05T06:00:00.000Z'),
          updatedAt: Date.parse('2026-07-06T06:00:00.000Z'),
          source: 'enterprise',
          scope: 'platform',
          generationComplete: true,
          learnerCount: 12,
        },
        {
          id: 'course-tenant',
          name: '企业销售规范',
          description: undefined,
          categoryId: 'category-tenant',
          categoryKey: 'management',
          categoryName: '管理知识',
          sceneCount: 0,
          createdAt: Date.parse('2026-07-03T06:00:00.000Z'),
          updatedAt: Date.parse('2026-07-04T06:00:00.000Z'),
          source: 'enterprise',
          scope: 'tenant',
          generationComplete: undefined,
          learnerCount: 0,
        },
      ],
      categories: [
        {
          id: 'category-platform',
          name: '精品分类',
          sortOrder: 5,
          scope: 'platform',
          categoryKey: 'management',
          isSystem: true,
        },
        {
          id: 'category-tenant',
          name: '管理知识',
          sortOrder: 10,
          scope: 'tenant',
          categoryKey: 'management',
          isSystem: true,
        },
      ],
    });
  });

  test('keeps missing legacy scopes tenant-scoped instead of exposing a third learner type', async () => {
    const result = await loadEnterpriseHomeCatalog(async () =>
      Response.json({
        courses: [{ id: 'legacy', name: 'Legacy', categoryId: 'legacy-category' }],
        categories: [{ id: 'legacy-category', name: 'Legacy', sortOrder: 1 }],
      }),
    );

    expect(result.courses[0].scope).toBe('tenant');
    expect(result.categories[0].scope).toBe('tenant');
  });

  test('surfaces learner course API failures so the home page can offer retry', async () => {
    const fetcher = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    await expect(loadEnterpriseHomeCatalog(fetcher)).rejects.toThrow('课程加载失败');
  });

  test('loads the first server course slide as a home thumbnail', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/courses/course-platform');
      return Response.json({
        success: true,
        scenes: [
          { id: 'non-slide', content: { type: 'video' } },
          {
            id: 'scene-1',
            content: { type: 'slide', canvas: { id: 'slide-platform', elements: [] } },
          },
        ],
      });
    });

    await expect(
      loadEnterpriseHomeCourseThumbnails([{ id: 'course-platform' }], fetcher),
    ).resolves.toEqual({
      'course-platform': { id: 'slide-platform', elements: [] },
    });
  });

  test('loads learner courses and thumbnails without calling the IndexedDB loader', async () => {
    const listLocalStages = vi.fn(async () => [
      { id: 'local-history', name: '历史本地课程', sceneCount: 1, createdAt: 1, updatedAt: 9 },
    ]);
    const serverCourses = [course('platform-new', 'platform', { updatedAt: 3 })];
    const loaders = {
      listLocalStages,
      loadEnterpriseCatalog: async () => ({
        courses: serverCourses,
        categories: [
          { id: 'category-platform', name: '精品分类', sortOrder: 1, scope: 'platform' as const },
        ],
      }),
      loadEnterpriseFirstSlides: vi.fn(async () => ({
        'platform-new': {
          id: 'slide-platform',
          viewportSize: 1000,
          viewportRatio: 0.5625,
          theme: {
            backgroundColor: '#fff',
            themeColors: ['#000'],
            fontColor: '#000',
            fontName: 'Inter',
          },
          elements: [],
        },
      })),
    };

    await expect(loadLearnerHomeCourses(loaders)).resolves.toEqual({
      courses: serverCourses,
      categories: [{ id: 'category-platform', name: '精品分类', sortOrder: 1, scope: 'platform' }],
      thumbnails: {
        'platform-new': {
          id: 'slide-platform',
          viewportSize: 1000,
          viewportRatio: 0.5625,
          theme: {
            backgroundColor: '#fff',
            themeColors: ['#000'],
            fontColor: '#000',
            fontName: 'Inter',
          },
          elements: [],
        },
      },
    });
    expect(listLocalStages).not.toHaveBeenCalled();
  });

  test('filters shared fixed keys and tenant-only custom categories across scopes', () => {
    const courses = [
      course('platform-leadership', 'platform', {
        name: '领导力精品课',
        description: '面向管理者',
        categoryId: 'platform-management-id',
        categoryKey: 'management',
      }),
      course('tenant-management', 'tenant', {
        name: '企业管理知识',
        description: '岗位必修',
        categoryId: 'tenant-management-id',
        categoryKey: 'management',
      }),
      course('tenant-sales', 'tenant', {
        name: 'ToB 销售实战',
        description: '客户沟通',
        categoryId: 'tenant-sales-category',
        categoryKey: null,
      }),
    ];

    expect(filterHomeCourses(courses, 'all', '')).toEqual(courses);
    expect(filterHomeCourses(courses, 'platform', '')).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'tenant', '')).toEqual([courses[1], courses[2]]);
    expect(filterHomeCourses(courses, 'all', '', 'management')).toEqual([courses[0], courses[1]]);
    expect(filterHomeCourses(courses, 'platform', '', 'management')).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'tenant', '', 'management')).toEqual([courses[1]]);
    expect(filterHomeCourses(courses, 'tenant', '客户', null, 'tenant-sales-category')).toEqual([
      courses[2],
    ]);
    expect(filterHomeCourses(courses, 'platform', '岗位')).toEqual([]);
  });

  test('sorts latest and popular with latest and stable ID tie breakers', () => {
    const courses = [
      course('course-z', 'tenant', { learnerCount: 10, updatedAt: 20 }),
      course('course-a', 'platform', { learnerCount: 10, updatedAt: 20 }),
      course('course-old-hot', 'tenant', { learnerCount: 30, updatedAt: 1 }),
      course('course-new-cold', 'platform', { learnerCount: 1, updatedAt: 40 }),
    ];

    expect(sortHomeCourses(courses, 'latest').map((item) => item.id)).toEqual([
      'course-new-cold',
      'course-a',
      'course-z',
      'course-old-hot',
    ]);
    expect(sortHomeCourses(courses, 'popular').map((item) => item.id)).toEqual([
      'course-old-hot',
      'course-a',
      'course-z',
      'course-new-cold',
    ]);
  });

  test('keeps scope and enterprise category selection transitions consistent', () => {
    expect(
      changeHomeCourseCategory(
        { scope: 'all', categoryKey: null, categoryId: null },
        { id: 'fixed:management', categoryKey: 'management' },
      ),
    ).toEqual({ scope: 'all', categoryKey: 'management', categoryId: null });
    expect(
      changeHomeCourseScope(
        { scope: 'tenant', categoryKey: 'management', categoryId: null },
        'platform',
      ),
    ).toEqual({ scope: 'platform', categoryKey: 'management', categoryId: null });
    expect(
      changeHomeCourseCategory(
        { scope: 'all', categoryKey: null, categoryId: null },
        { id: 'tenant-custom', categoryKey: null },
      ),
    ).toEqual({ scope: 'tenant', categoryKey: null, categoryId: 'tenant-custom' });
    expect(
      changeHomeCourseScope(
        { scope: 'tenant', categoryKey: null, categoryId: 'tenant-custom' },
        'platform',
      ),
    ).toEqual({ scope: 'platform', categoryKey: null, categoryId: null });
    expect(
      changeHomeCourseCategory(
        { scope: 'tenant', categoryKey: null, categoryId: 'tenant-custom' },
        null,
      ),
    ).toEqual({ scope: 'tenant', categoryKey: null, categoryId: null });
  });
});
