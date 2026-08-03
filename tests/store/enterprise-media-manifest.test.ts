import { beforeEach, describe, expect, test } from 'vitest';

import { useMediaGenerationStore } from '@/lib/store/media-generation';

describe('enterprise media manifest restoration', () => {
  beforeEach(() => {
    useMediaGenerationStore.setState({ tasks: {} });
  });

  test('restores authenticated image/video tasks and replaces tasks when the enterprise course changes', () => {
    useMediaGenerationStore.getState().restoreFromManifest('course-a', [
      {
        mediaId: 'gen_img_1',
        type: 'image',
        url: '/api/courses/course-a/media/gen_img_1',
      },
      {
        mediaId: 'gen_vid_1',
        type: 'video',
        url: '/api/courses/course-a/media/gen_vid_1',
        posterUrl: '/api/courses/course-a/media/gen_vid_1?poster=1',
      },
    ]);
    expect(useMediaGenerationStore.getState().tasks).toMatchObject({
      gen_img_1: {
        status: 'done',
        stageId: 'course-a',
        objectUrl: '/api/courses/course-a/media/gen_img_1',
      },
      gen_vid_1: {
        stageId: 'course-a',
        poster: '/api/courses/course-a/media/gen_vid_1?poster=1',
      },
    });

    useMediaGenerationStore.getState().restoreFromManifest('course-b', [
      {
        mediaId: 'gen_img_1',
        type: 'image',
        url: '/api/courses/course-b/media/gen_img_1',
      },
    ]);
    expect(useMediaGenerationStore.getState().tasks).toEqual({
      gen_img_1: expect.objectContaining({
        stageId: 'course-b',
        objectUrl: '/api/courses/course-b/media/gen_img_1',
      }),
    });
  });
});
