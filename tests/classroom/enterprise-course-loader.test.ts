import { describe, expect, test, vi } from 'vitest';

import { loadEnterpriseClassroom } from '@/lib/classroom/enterprise-course-loader';

describe('CHANGE-01 enterprise classroom loader', () => {
  test('loads PostgreSQL course detail and hydrates audio URLs into speech actions', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/courses/course-pg-1');
      return new Response(
        JSON.stringify({
          success: true,
          course: {
            id: 'course-pg-1',
            name: 'Two Factor Theory',
            description: 'Motivation and hygiene factors',
            generationComplete: true,
          },
          stage: { id: 'course-pg-1', name: 'Two Factor Theory' },
          scenes: [
            {
              id: 'scene-1',
              outlineId: 'outline-1',
              stageId: 'course-pg-1',
              order: 1,
              title: 'Intro',
              type: 'slide',
              content: { type: 'slide', slide: { elements: [] } },
              actions: [{ id: 'a1', type: 'speech', text: 'hello', audioId: 'tts-1' }],
            },
          ],
          outlines: [{ id: 'outline-1', order: 1, title: 'Intro' }],
          audioManifest: [
            {
              audioId: 'tts-1',
              url: '/api/courses/course-pg-1/audio/tts-1',
              mimeType: 'audio/mpeg',
              sizeBytes: 10,
            },
          ],
          mediaManifest: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(loadEnterpriseClassroom('course-pg-1', fetcher)).resolves.toMatchObject({
      stage: { id: 'course-pg-1', name: 'Two Factor Theory' },
      currentSceneId: 'scene-1',
      outlines: [{ id: 'outline-1' }],
      generationComplete: true,
      scenes: [
        {
          id: 'scene-1',
          outlineId: 'outline-1',
          actions: [
            {
              audioId: 'tts-1',
              audioUrl: '/api/courses/course-pg-1/audio/tts-1',
            },
          ],
        },
      ],
    });
  });

  test('returns null when the course API does not have a visible enterprise course', async () => {
    const fetcher = vi.fn(async () => new Response('missing', { status: 404 }));

    await expect(loadEnterpriseClassroom('missing-course', fetcher)).resolves.toBeNull();
  });

  test('falls back to admin content API so generated drafts open by PostgreSQL course id', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/courses/course-draft-1') {
        return new Response('draft is not learner-visible', { status: 404 });
      }
      if (url === '/api/admin/courses/course-draft-1/content') {
        return new Response(
          JSON.stringify({
            success: true,
            content: {
              course: {
                id: 'course-draft-1',
                name: 'Generated Draft',
                status: 'draft',
                generationComplete: false,
              },
              stage: { id: 'stage-generated', name: 'Generated Draft' },
              scenes: [{ id: 'scene-1', title: 'Draft scene', type: 'slide', order: 1 }],
              outlines: [{ id: 'outline-1', title: 'Draft scene', order: 1 }],
              audioManifest: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('unexpected', { status: 500 });
    });

    await expect(loadEnterpriseClassroom('course-draft-1', fetcher)).resolves.toMatchObject({
      stage: { id: 'stage-generated', name: 'Generated Draft' },
      scenes: [{ id: 'scene-1', stageId: 'stage-generated' }],
      generationComplete: false,
    });
    expect(fetcher).toHaveBeenCalledWith('/api/courses/course-draft-1');
    expect(fetcher).toHaveBeenCalledWith('/api/admin/courses/course-draft-1/content');
  });
});
