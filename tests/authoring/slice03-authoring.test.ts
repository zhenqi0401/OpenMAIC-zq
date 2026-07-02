import { describe, expect, test } from 'vitest';

import {
  buildGeneratedCourseDraft,
  persistGeneratedCourseDraft,
  replaceGeneratedCourseDraftContent,
  shouldShowAssessmentMismatchWarning,
} from '@/lib/authoring/course-draft';
import { canManageCourses, shouldAllowProModeEntry } from '@/lib/authoring/course-permissions';
import { shouldPauseForOutlineConfirmation } from '@/lib/authoring/outline-confirmation';

describe('Slice-03 authoring helpers', () => {
  test('requires explicit outline confirmation before full course generation', () => {
    expect(
      shouldPauseForOutlineConfirmation({
        reviewOutlineEnabled: false,
        userOpenedReviewEarly: false,
      }),
    ).toBe(true);
  });

  test('allows Pro Mode only for administrators on editable scenes', () => {
    expect(
      shouldAllowProModeEntry({
        isSceneEditable: true,
        identity: { isAdmin: true },
      }),
    ).toBe(true);

    expect(
      shouldAllowProModeEntry({
        isSceneEditable: true,
        identity: { isAdmin: false },
      }),
    ).toBe(false);

    expect(
      shouldAllowProModeEntry({
        isSceneEditable: false,
        identity: { isAdmin: true },
      }),
    ).toBe(false);
  });

  test('normalizes course management permission from session responses', () => {
    expect(canManageCourses({ authenticated: true, identity: { isAdmin: true } })).toBe(true);
    expect(canManageCourses({ authenticated: true, identity: { isAdmin: false } })).toBe(false);
    expect(canManageCourses({ authenticated: false })).toBe(false);
    expect(canManageCourses(null)).toBe(false);
  });

  test('builds a server course draft from generated stage content and requires category', () => {
    expect(() =>
      buildGeneratedCourseDraft({
        stage: { id: 'stage-1', name: 'Sales Enablement', description: 'Train sales reps' },
        categoryId: '',
        scenes: [],
        outlines: [],
      }),
    ).toThrow('categoryId is required');

    expect(
      buildGeneratedCourseDraft({
        stage: { id: 'stage-1', name: 'Sales Enablement', description: 'Train sales reps' },
        categoryId: 'cat-sales',
        scenes: [{ id: 'scene-1', type: 'slide', title: 'Intro' }],
        outlines: [{ id: 'outline-1', title: 'Intro' }],
      }),
    ).toEqual({
      course: {
        name: 'Sales Enablement',
        description: 'Train sales reps',
        categoryId: 'cat-sales',
      },
      content: {
        scenes: [{ id: 'scene-1', type: 'slide', title: 'Intro' }],
        outlines: [{ id: 'outline-1', title: 'Intro' }],
      },
    });
  });

  test('warns when saved course content may no longer match existing assessment questions', () => {
    expect(shouldShowAssessmentMismatchWarning([{ id: 'q1' }])).toBe(true);
    expect(shouldShowAssessmentMismatchWarning([])).toBe(false);
    expect(shouldShowAssessmentMismatchWarning(undefined)).toBe(false);
  });

  test('persists a generated course as draft content through admin course APIs', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === '/api/admin/courses') {
        return Response.json({ success: true, course: { id: 'course-1', status: 'draft' } });
      }
      if (url === '/api/admin/courses/course-1/content') {
        return Response.json({ success: true, content: { courseId: 'course-1' } });
      }
      return Response.json({ success: false, error: 'Unexpected URL' }, { status: 404 });
    };

    await expect(
      persistGeneratedCourseDraft(fetcher, {
        stage: { id: 'stage-1', name: 'Sales Enablement', description: 'Train sales reps' },
        categoryId: 'cat-sales',
        scenes: [{ id: 'scene-1' }],
        outlines: [{ id: 'outline-1' }],
      }),
    ).resolves.toMatchObject({
      course: { id: 'course-1', status: 'draft' },
      content: { courseId: 'course-1' },
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      url: '/api/admin/courses',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    });
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      name: 'Sales Enablement',
      description: 'Train sales reps',
      categoryId: 'cat-sales',
    });
    expect(calls[1]).toMatchObject({
      url: '/api/admin/courses/course-1/content',
      init: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
    });
    expect(JSON.parse(calls[1].init?.body as string)).toEqual({
      scenes: [{ id: 'scene-1' }],
      outlines: [{ id: 'outline-1' }],
    });
  });

  test('replaces generated draft content without recreating the course', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json({ success: true, content: { courseId: 'course-1' } });
    };

    await replaceGeneratedCourseDraftContent(fetcher, 'course-1', {
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }],
      outlines: [{ id: 'outline-1' }, { id: 'outline-2' }],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/admin/courses/course-1/content');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      scenes: [{ id: 'scene-1' }, { id: 'scene-2' }],
      outlines: [{ id: 'outline-1' }, { id: 'outline-2' }],
    });
  });
});
