import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene, Stage } from '@/lib/types/stage';
import {
  createSerialCourseSaveCoordinator,
  flushBeforeCourseExit,
  persistCourseEdit,
  type CourseEditSnapshot,
  type CourseSaveStatus,
} from '@/lib/authoring/course-edit-persistence';

function snapshot(stagePatch: Record<string, unknown> = {}): CourseEditSnapshot {
  return {
    stage: {
      id: 'stage-1',
      name: 'Course',
      createdAt: 1,
      updatedAt: 1,
      ...stagePatch,
    } as Stage,
    scenes: [
      {
        id: 'scene-1',
        stageId: 'stage-1',
        type: 'slide',
        title: 'Edited scene',
        order: 1,
        content: { type: 'slide', canvas: { elements: [] } },
        actions: [],
      } as unknown as Scene,
    ],
    outlines: [],
    generationComplete: true,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('course edit storage routing', () => {
  it('writes server-backed courses through the PostgreSQL content API', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ success: true, content: { courseId: 'course-1' } }),
    );
    const saveLocal = vi.fn(async () => true);

    await expect(
      persistCourseEdit({
        snapshot: snapshot({ serverCourseId: 'course-1' }),
        fetcher,
        saveLocal,
      }),
    ).resolves.toBe('database');

    expect(saveLocal).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/admin/courses/course-1/content');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      generationStatus: 'ready',
      generationComplete: true,
      scenes: [{ id: 'scene-1', title: 'Edited scene' }],
      outlines: [],
    });
  });

  it('keeps local courses in IndexedDB', async () => {
    const fetcher = vi.fn();
    const saveLocal = vi.fn(async () => true);

    await expect(persistCourseEdit({ snapshot: snapshot(), fetcher, saveLocal })).resolves.toBe(
      'indexeddb',
    );

    expect(saveLocal).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('course edit exit flush', () => {
  it('leaves only after a successful flush', async () => {
    const leave = vi.fn();
    await expect(flushBeforeCourseExit(async () => true, leave)).resolves.toBe(true);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('blocks Pro-mode exit or home navigation when saving fails', async () => {
    const leave = vi.fn();
    await expect(flushBeforeCourseExit(async () => false, leave)).resolves.toBe(false);
    expect(leave).not.toHaveBeenCalled();
  });
});

describe('serial course save coordinator', () => {
  it('automatically saves 1000ms after the latest edit', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async () => undefined);
    const coordinator = createSerialCourseSaveCoordinator({ persist, delayMs: 1_000 });

    coordinator.markDirty();
    await vi.advanceTimersByTimeAsync(999);
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(coordinator.getStatus()).toBe('saved');
  });

  it('serializes requests and drains a newer revision after the active request', async () => {
    const resolvers: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const persist = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          resolvers.push(() => {
            active -= 1;
            resolve();
          });
        }),
    );
    const coordinator = createSerialCourseSaveCoordinator({ persist });

    coordinator.markDirty();
    const firstFlush = coordinator.flush();
    coordinator.markDirty();
    const secondFlush = coordinator.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(secondFlush).toBe(firstFlush);
    expect(coordinator.getStatus()).toBe('saving');
    resolvers.shift()?.();
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(maxActive).toBe(1);

    resolvers.shift()?.();
    await expect(firstFlush).resolves.toBe(true);
    await expect(secondFlush).resolves.toBe(true);
    expect(coordinator.hasUnsavedChanges()).toBe(false);
  });

  it('keeps a failed revision dirty and permits an explicit retry', async () => {
    const statuses: CourseSaveStatus[] = [];
    const onError = vi.fn();
    const persist = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const coordinator = createSerialCourseSaveCoordinator({
      persist,
      onStatusChange: (status) => statuses.push(status),
      onError,
    });

    coordinator.markDirty();
    await expect(coordinator.flush()).resolves.toBe(false);
    expect(coordinator.getStatus()).toBe('error');
    expect(coordinator.hasUnsavedChanges()).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);

    await expect(coordinator.flush()).resolves.toBe(true);
    expect(coordinator.getStatus()).toBe('saved');
    expect(statuses).toEqual(['dirty', 'saving', 'error', 'saving', 'saved']);
  });
});
