import { describe, expect, test, vi } from 'vitest';

import {
  filterHomeCourses,
  isLocalHomeCourse,
  loadEnterpriseHomeCourses,
  loadEnterpriseHomeCourseThumbnails,
  loadHomeCourses,
  shouldPersistImportedClassroom,
} from '@/lib/home/enterprise-course-list';
import type { SessionIdentity } from '@/lib/auth/types';

describe('CHANGE-01 home enterprise course list', () => {
  test('loads visible courses from PostgreSQL course API for the home page', async () => {
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
              updatedAt: '2026-07-06T06:00:00.000Z',
              createdAt: '2026-07-05T06:00:00.000Z',
              generationComplete: true,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(loadEnterpriseHomeCourses(fetcher)).resolves.toEqual([
      {
        id: 'course-pg-1',
        name: 'Two Factor Theory',
        description: 'Motivation and hygiene factors',
        sceneCount: 0,
        createdAt: Date.parse('2026-07-05T06:00:00.000Z'),
        updatedAt: Date.parse('2026-07-06T06:00:00.000Z'),
        source: 'enterprise',
        generationComplete: true,
      },
    ]);
  });

  test('surfaces learner course API failures so the home page can offer retry', async () => {
    const fetcher = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    await expect(loadEnterpriseHomeCourses(fetcher)).rejects.toThrow('课程加载失败');
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
        generationComplete: true,
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
        loadEnterpriseCourses: async () => enterpriseCourses,
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

    expect(filterHomeCourses(courses, 'enterprise', '')).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'local', '服务')).toEqual([courses[1]]);
    expect(filterHomeCourses(courses, 'all', '岗位')).toEqual([courses[0]]);
    expect(filterHomeCourses(courses, 'all', 'missing')).toEqual([]);
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
      }),
    ).toBe(false);
    expect(shouldPersistImportedClassroom(learner, 'category-1')).toBe(false);
    expect(shouldPersistImportedClassroom(admin, '')).toBe(false);
    expect(shouldPersistImportedClassroom(admin, 'category-1')).toBe(true);
  });
});
