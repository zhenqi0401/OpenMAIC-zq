import { describe, expect, test, vi } from 'vitest';

import {
  loadEnterpriseHomeCourses,
  loadEnterpriseHomeCourseThumbnails,
  loadHomeCourses,
} from '@/lib/home/enterprise-course-list';

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

  test('returns an empty list when the learner course API is unavailable', async () => {
    const fetcher = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    await expect(loadEnterpriseHomeCourses(fetcher)).resolves.toEqual([]);
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
      courses: [localCourses[0], enterpriseCourses[0]],
      thumbnails: {
        'local-1': thumbnail,
        'course-pg-1': { id: 'slide-pg-1', elements: [] },
      },
    });
  });
});
