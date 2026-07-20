import type { Scene, Stage } from '@/lib/types/stage';
import type { SceneOutline } from '@/lib/types/generation';
import { replaceGeneratedCourseDraftContent, type CourseDraftFetcher } from './course-draft';

export type CourseSaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface CourseEditSnapshot {
  stage: Stage;
  scenes: Scene[];
  outlines: SceneOutline[];
  generationComplete: boolean;
}

export interface PersistCourseEditInput {
  snapshot: CourseEditSnapshot;
  enterpriseCourseId?: string | null;
  fetcher?: CourseDraftFetcher;
  saveLocal: () => Promise<boolean>;
}

export type CourseEditStorageTarget = 'database' | 'indexeddb';

/** Run an editor exit/navigation only after all dirty revisions are durable. */
export async function flushBeforeCourseExit(
  flush: (() => Promise<boolean>) | undefined,
  exit: () => void,
): Promise<boolean> {
  if (flush && !(await flush())) return false;
  exit();
  return true;
}

function serverCourseIdFromStage(stage: Stage): string | null {
  const value = (stage as unknown as Record<string, unknown>).serverCourseId;
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Persist one immutable editor snapshot to its canonical storage target.
 * Enterprise courses replace their PostgreSQL content through the admin API;
 * local courses keep the existing IndexedDB contract.
 */
export async function persistCourseEdit({
  snapshot,
  enterpriseCourseId,
  fetcher = (url, init) => fetch(url, init),
  saveLocal,
}: PersistCourseEditInput): Promise<CourseEditStorageTarget> {
  const courseId = serverCourseIdFromStage(snapshot.stage) ?? enterpriseCourseId?.trim() ?? null;
  if (courseId) {
    await replaceGeneratedCourseDraftContent(fetcher, courseId, {
      stage: snapshot.stage,
      scenes: snapshot.scenes,
      outlines: snapshot.outlines,
      generationStatus: snapshot.generationComplete ? 'ready' : 'generating',
      generationComplete: snapshot.generationComplete,
    });
    return 'database';
  }

  if (!(await saveLocal())) {
    throw new Error('Saving local course content failed');
  }
  return 'indexeddb';
}

interface SerialCourseSaveCoordinatorOptions {
  persist: () => Promise<unknown>;
  delayMs?: number;
  onStatusChange?: (status: CourseSaveStatus) => void;
  onSaved?: () => void;
  onError?: (error: unknown) => void;
}

export interface SerialCourseSaveCoordinator {
  markDirty: () => void;
  flush: () => Promise<boolean>;
  getStatus: () => CourseSaveStatus;
  hasUnsavedChanges: () => boolean;
  configure: (
    options: Pick<SerialCourseSaveCoordinatorOptions, 'persist' | 'onSaved' | 'onError'>,
  ) => void;
  dispose: () => void;
}

/**
 * Revision-aware, strictly serial save queue.
 *
 * A save captures the latest revision immediately before `persist` starts. If
 * more edits land while that request is in flight, the same drain loop takes a
 * fresh snapshot through `persist` and sends one follow-up request only after
 * the previous request settles. Concurrent `flush` callers share that drain.
 */
export function createSerialCourseSaveCoordinator({
  persist,
  delayMs = 1_000,
  onStatusChange,
  onSaved,
  onError,
}: SerialCourseSaveCoordinatorOptions): SerialCourseSaveCoordinator {
  let revision = 0;
  let savedRevision = 0;
  let status: CourseSaveStatus = 'saved';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;
  let disposed = false;
  let currentPersist = persist;
  let currentOnSaved = onSaved;
  let currentOnError = onError;

  const setStatus = (next: CourseSaveStatus) => {
    status = next;
    onStatusChange?.(next);
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const drain = async (): Promise<boolean> => {
    while (savedRevision < revision) {
      const targetRevision = revision;
      setStatus('saving');
      try {
        await currentPersist();
      } catch (error) {
        setStatus('error');
        currentOnError?.(error);
        return false;
      }
      savedRevision = targetRevision;
    }

    setStatus('saved');
    currentOnSaved?.();
    return true;
  };

  const flush = (): Promise<boolean> => {
    clearTimer();
    if (disposed) return Promise.resolve(false);
    if (inFlight) return inFlight;
    if (savedRevision >= revision) return Promise.resolve(true);

    const run = drain();
    inFlight = run;
    void run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  };

  return {
    markDirty: () => {
      if (disposed) return;
      revision += 1;
      // The active drain will observe the newer revision and send the latest
      // snapshot next. Keep the UI in its saving state and do not create a
      // second timer/request while that drain owns the queue.
      if (inFlight) {
        setStatus('saving');
        clearTimer();
        return;
      }
      setStatus('dirty');
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, delayMs);
    },
    flush,
    getStatus: () => status,
    hasUnsavedChanges: () => savedRevision < revision,
    configure: (options) => {
      currentPersist = options.persist;
      currentOnSaved = options.onSaved;
      currentOnError = options.onError;
    },
    dispose: () => {
      disposed = true;
      clearTimer();
    },
  };
}
