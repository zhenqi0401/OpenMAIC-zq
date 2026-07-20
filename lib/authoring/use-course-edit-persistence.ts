'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { createLogger } from '@/lib/logger';
import {
  createSerialCourseSaveCoordinator,
  persistCourseEdit,
  type CourseEditSnapshot,
  type CourseSaveStatus,
} from './course-edit-persistence';

const SAVE_TOAST_ID = 'course-edit-save';
const log = createLogger('CourseEditPersistence');

export interface CourseEditPersistence {
  status: CourseSaveStatus;
  saveNow: () => Promise<boolean>;
  flush: () => Promise<boolean>;
}

export function useCourseEditPersistence({
  courseKey,
  enterpriseCourseId,
}: {
  courseKey: string;
  enterpriseCourseId?: string | null;
}): CourseEditPersistence {
  const { t } = useI18n();
  const [statusState, setStatusState] = useState<{
    courseKey: string;
    status: CourseSaveStatus;
  }>({ courseKey, status: 'saved' });
  const status = statusState.courseKey === courseKey ? statusState.status : 'saved';
  const coordinatorRef = useRef<ReturnType<typeof createSerialCourseSaveCoordinator> | null>(null);
  const saveSuccessMessage = t('edit.saveSuccess');
  const saveFailedMessage = t('edit.saveFailed');

  const persistLatest = useCallback(async () => {
    const state = useStageStore.getState();
    if (!state.stage) throw new Error('Cannot save course without a stage');

    // The coordinator invokes this immediately before each serialized request,
    // so every iteration gets a stable snapshot of the newest revision.
    const snapshot: CourseEditSnapshot = {
      stage: structuredClone(state.stage),
      scenes: structuredClone(state.scenes),
      outlines: structuredClone(state.outlines),
      generationComplete: state.generationComplete,
    };
    return persistCourseEdit({
      snapshot,
      // Freshly generated enterprise drafts can still be the in-memory stage
      // without `serverCourseId`; their classroom URL is the created course ID.
      // Requiring the fallback to match this page also prevents stale
      // generationParams from routing an unrelated local course to PostgreSQL.
      enterpriseCourseId: enterpriseCourseId === courseKey ? enterpriseCourseId : null,
      saveLocal: () => useStageStore.getState().saveToStorage(),
    });
  }, [courseKey, enterpriseCourseId]);

  useEffect(() => {
    const coordinator = createSerialCourseSaveCoordinator({
      delayMs: 1_000,
      // Configured with the latest course target and translated messages by
      // the effect below. Keeping coordinator lifetime keyed only to the page
      // prevents a locale/auth refresh from discarding a dirty revision.
      persist: async () => {
        throw new Error('Course save coordinator is not ready');
      },
      onStatusChange: (nextStatus) => setStatusState({ courseKey, status: nextStatus }),
    });
    coordinatorRef.current = coordinator;
    const unsubscribe = useStageStore.subscribe((state, previous) => {
      // Only authoring mutations are dirty. Playback navigation also changes
      // stage state, but must not rewrite the whole enterprise course.
      if (state.mode === 'edit' && state.scenes !== previous.scenes) {
        coordinator.markDirty();
      }
    });
    return () => {
      unsubscribe();
      coordinator.dispose();
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
    };
  }, [courseKey]);

  useEffect(() => {
    coordinatorRef.current?.configure({
      persist: persistLatest,
      onSaved: () => {
        toast.success(saveSuccessMessage, { id: SAVE_TOAST_ID });
      },
      onError: (error) => {
        log.warn('Course edit save failed:', error);
        toast.error(saveFailedMessage, { id: SAVE_TOAST_ID });
      },
    });
  }, [persistLatest, saveFailedMessage, saveSuccessMessage]);

  const flush = useCallback(() => coordinatorRef.current?.flush() ?? Promise.resolve(true), []);

  return {
    status,
    saveNow: flush,
    flush,
  };
}
