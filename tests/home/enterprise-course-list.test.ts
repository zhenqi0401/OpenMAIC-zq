import { describe, expect, test, vi } from 'vitest';

import {
  changeHomeCourseCategory,
  changeHomeCourseSource,
  filterHomeCourses,
  isLocalHomeCourse,
  loadEnterpriseHomeCatalog,
  loadEnterpriseHomeCourseThumbnails,
  loadHomeCourses,
  sortHomeCourses,
  shouldPersistImportedClassroom,
} from '@/lib/home/enterprise-course-list';
import type { SessionIdentity } from '@/lib/auth/types';

describe('CHANGE-01 home enterprise course list', () => {
  test('loads visible courses and all categories from one learner API request', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/courses');
      return new Response(
        JSON.stringify({
          success: true,
          courses: [
            {
              id: 'course-pg-1',
              name: 'Two Factor Theory',
              description: 'Motivation and hygiene factors',
              categoryId: 'cat-handbook',
              categoryName: '员工手册',
              updatedAt: '2026-07-06T06:00:00.000Z',
              createdAt: '2026-07-05T06:00:00.000Z',
              generationComplete: true,
              learnerCount: 12,
            },
          ],
          categories: [
            { id: 'cat-handbook', name: '员工手册', sortOrder: 10 },
            { id: 'cat-empty', name: '新员工入职', sortOrder: 30 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(loadEnterpriseHomeCatalog(fetcher)).resolves.toEqual({
      courses: [
        {
          id: 'course-pg-1',
          name: 'Two Factor Theory',
          description: 'Motivation and hygiene factors',
          categoryId: 'cat-handbook',
          categoryName: '员工手册',
          sceneCount: 0,
          createdAt: Date.parse('2026-07-05T06:00:00.000Z'),
          updatedAt: Date.parse('2026-07-06T06:00:00.000Z'),
          source: 'enterprise',
          generationComplete: true,
          learnerCount: 12,
        },
      ],
      categories: [
        { id: 'cat-handbook', name: '员工手册', sortOrder: 10 },
        { id: 'cat-empty', name: '新员工入职', sortOrder: 30 },
      ],
    });
  });

  test('surfaces learner course API failures so the home page can offer retry', async () => {
    const fetcher = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    await expect(loadEnterpriseHomeCatalog(fetcher)).rejects.toThrow('课程加载失败');
  });

  test('loads the first PostgreSQL course slide as a home thumbnail', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/courses/course-pg-1');
      return new Response(
        JSON.stringify({
          success: true,
          scenes: [
            {
              id: 'scene-1',
              content: {
                type: 'slide',
                canvas: { id: 'slide-pg-1', elements: [] },
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(
      loadEnterpriseHomeCourseThumbnails([{ id: 'course-pg-1' }], fetcher),
    ).resolves.toEqual({
      'course-pg-1': { id: 'slide-pg-1', elements: [] },
    });
  });

  test('keeps browser IndexedDB courses and thumbnails on the home page', async () => {
    const localCourses = [
      {
        id: 'local-1',
        name: 'Imported ZIP',
        sceneCount: 2,
        createdAt: 1,
        updatedAt: 3,
      },
    ];
    const enterpriseCourses = [
      {
        id: 'course-pg-1',
        name: 'Server Course',
        sceneCount: 0,
        createdAt: 2,
        updatedAt: 2,
        source: 'enterprise' as const,
        categoryId: 'cat-handbook',
        categoryName: '员工手册',
        generationComplete: true,
        learnerCount: 4,
      },
    ];
    const thumbnail = {
      id: 'slide-1',
      elements: [],
      viewportSize: 1000,
      viewportRatio: 0.5625,
    };

    await expect(
      loadHomeCourses({
        listLocalStages: async () => localCourses,
        loadEnterpriseCatalog: async () => ({
          courses: enterpriseCourses,
          categories: [{ id: 'cat-empty', name: '新员工入职', sortOrder: 30 }],
        }),
        loadEnterpriseFirstSlides: async (courses) => {
          expect(courses).toEqual(enterpriseCourses);
          return { 'course-pg-1': { id: 'slide-pg-1', elements: [] } };
        },
        getFirstSlides: async (stageIds) => {
          expect(stageIds).toEqual(['local-1']);
          return { 'local-1': thumbnail };
        },
      }),
    ).resolves.toEqual({
      courses: [{ ...localCourses[0], source: 'local' }, enterpriseCourses[0]],
      categories: [{ id: 'cat-empty', name: '新员工入职', sortOrder: 30 }],
      thumbnails: {
        'local-1': thumbnail,
        'course-pg-1': { id: 'slide-pg-1', elements: [] },
      },
    });
  });

  test('filters the unified course view by source and search query', () => {
    const courses = [
      {
        id: 'enterprise-1',
        name: '门店安全规范',
        description: '岗位必修',
        sceneCount: 8,
        createdAt: 1,
        updatedAt: 3,
        source: 'enterprise' as const,
        categoryId: 'cat-rules',
        categoryName: '公司规范规章制度',
        learnerCount: 8,
      },
      {
        id: 'local-1',
        name: '本地服务话术',
        description: '个人导入',
        sceneCount: 4,
        createdAt: 1,
        updatedAt: 2,
        source: 'local' as const,
      },
    ];

    expect(filterHomeCourses(courses, 'enterprise', '', 'cat-rules')).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'enterprise', '', 'cat-empty')).toEqual([]);
    expect(filterHomeCourses(courses, 'local', '服务', null)).toEqual([courses[1]]);
    expect(filterHomeCourses(courses, 'all', '岗位', null)).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'all', 'missing', null)).toEqual([]);
  });

  test('sorts latest across sources and keeps local courses out of popularity ranking', () => {
    const courses = [
      {
        id: 'local-new',
        name: 'Local',
        sceneCount: 1,
        createdAt: 1,
        updatedAt: 40,
        source: 'local' as const,
      },
      {
        id: 'enterprise-low',
        name: 'Low',
        sceneCount: 1,
        createdAt: 1,
        updatedAt: 30,
        source: 'enterprise' as const,
        categoryId: 'cat-1',
        categoryName: null,
        learnerCount: 2,
      },
      {
        id: 'enterprise-hot',
        name: 'Hot',
        sceneCount: 1,
        createdAt: 1,
        updatedAt: 10,
        source: 'enterprise' as const,
        categoryId: 'cat-1',
        categoryName: null,
        learnerCount: 20,
      },
    ];

    expect(sortHomeCourses(courses, 'latest').map((course) => course.id)).toEqual([
      'local-new',
      'enterprise-low',
      'enterprise-hot',
    ]);
    expect(sortHomeCourses(courses, 'popular').map((course) => course.id)).toEqual([
      'enterprise-hot',
      'enterprise-low',
      'local-new',
    ]);
  });

  test('keeps source and category selection transitions consistent', () => {
    expect(changeHomeCourseCategory({ source: 'all', categoryId: null }, 'cat-rules')).toEqual({
      source: 'enterprise',
      categoryId: 'cat-rules',
    });
    expect(
      changeHomeCourseCategory({ source: 'enterprise', categoryId: 'cat-rules' }, null),
    ).toEqual({
      source: 'enterprise',
      categoryId: null,
    });
    expect(
      changeHomeCourseSource({ source: 'enterprise', categoryId: 'cat-rules' }, 'all'),
    ).toEqual({
      source: 'all',
      categoryId: null,
    });
    expect(
      changeHomeCourseSource({ source: 'enterprise', categoryId: 'cat-rules' }, 'local'),
    ).toEqual({
      source: 'local',
      categoryId: null,
    });
  });

  test('allows management and enterprise persistence only for their intended sources', () => {
    const learner: SessionIdentity = {
      userId: 'learner-1',
      roleId: 'role-learner',
      roleCode: 'learner',
      isAdmin: false,
      authSource: 'password',
    };
    const admin: SessionIdentity = { ...learner, userId: 'admin-1', isAdmin: true };

    expect(
      isLocalHomeCourse({
        id: 'local-1',
        name: 'Local',
        sceneCount: 1,
        createdAt: 1,
        updatedAt: 1,
        source: 'local',
      }),
    ).toBe(true);
    expect(
      isLocalHomeCourse({
        id: 'enterprise-1',
        name: 'Enterprise',
        sceneCount: 1,
        createdAt: 1,
        updatedAt: 1,
        source: 'enterprise',
        categoryId: 'cat-1',
        categoryName: null,
        learnerCount: 0,
      }),
    ).toBe(false);
    expect(shouldPersistImportedClassroom(learner, 'category-1')).toBe(false);
    expect(shouldPersistImportedClassroom(admin, '')).toBe(false);
    expect(shouldPersistImportedClassroom(admin, 'category-1')).toBe(true);
  });
});
