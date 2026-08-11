'use client';

import { Stage } from '@/components/stage';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { useStageStore } from '@/lib/store';
import { loadImageMapping } from '@/lib/utils/image-storage';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Result, Spin } from 'antd';
import { useSceneGenerator, type GenerationParams } from '@/lib/hooks/use-scene-generator';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { createLogger } from '@/lib/logger';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { generateMediaForOutlines } from '@/lib/media/media-orchestrator';
import { migrateScene } from '@/lib/edit/slide-schema';
import type { Scene } from '@/lib/types/stage';
import { canManageCourses, type CourseAuthoringIdentity } from '@/lib/authoring/course-permissions';
import {
  classifyCourseStorageFailure,
  regenerateGeneratedCourseAssessment,
  replaceGeneratedCourseDraftContent,
  resolveGeneratedCourseStorageId,
  resolveStageCourseStorageId,
} from '@/lib/authoring/course-draft';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { loadEnterpriseClassroom } from '@/lib/classroom/enterprise-course-loader';
import { useCourseEditPersistence } from '@/lib/authoring/use-course-edit-persistence';
import { findSceneForOutline } from '@/lib/generation/outline-scene-identity';
import { loadResumeGenerationParams } from '@/lib/generation/resume-generation-params';

const log = createLogger('Classroom');

export default function ClassroomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classroomId = params?.id as string;
  const requestedLearningMode = searchParams.get('mode') === 'learn';

  const { loadFromStorage } = useStageStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authoringIdentity, setAuthoringIdentity] = useState<CourseAuthoringIdentity | null>(null);
  const learningMode = requestedLearningMode || authoringIdentity?.isAdmin === false;
  const [enterpriseCourseId, setEnterpriseCourseId] = useState<string | null>(null);
  const [enterpriseCourseScope, setEnterpriseCourseScope] = useState<'platform' | 'tenant' | null>(
    null,
  );

  const generationStartedRef = useRef(false);
  const generatedCourseIdRef = useRef<string | null>(null);
  const assessmentGenerationStartedRef = useRef(false);
  const contentSyncQueueRef = useRef<Promise<unknown>>(Promise.resolve(null));
  const completedCourseIdsRef = useRef(new Set<string>());

  const courseEditPersistence = useCourseEditPersistence({
    courseKey: classroomId,
    enterpriseCourseId,
  });

  const syncGeneratedDraftContent = useCallback(
    async (
      courseId = generatedCourseIdRef.current,
      options: { generationComplete?: boolean } = {},
    ) => {
      if (!courseId) return;
      if (options.generationComplete) completedCourseIdsRef.current.add(courseId);

      // Serialize snapshots for this page. Each queued operation reads the
      // latest store state only when it starts, so an older per-scene PATCH
      // cannot land after the final completion PATCH with stale scenes/flags.
      const run = async () => {
        const { scenes, outlines, stage, generationComplete } = useStageStore.getState();
        const isComplete =
          completedCourseIdsRef.current.has(courseId) ||
          options.generationComplete === true ||
          generationComplete;
        try {
          return await replaceGeneratedCourseDraftContent(fetch, courseId, {
            stage,
            scenes,
            outlines,
            generationStatus: isComplete ? 'ready' : 'generating',
            generationComplete: isComplete,
          });
        } catch (error) {
          log.warn('[Classroom] Failed to sync generated course draft content:', error);
          return null;
        }
      };
      const queued = contentSyncQueueRef.current.then(run, run);
      contentSyncQueueRef.current = queued.then(
        () => null,
        () => null,
      );
      return queued;
    },
    [],
  );

  const generateDraftAssessment = useCallback(async (courseId = generatedCourseIdRef.current) => {
    if (!courseId || assessmentGenerationStartedRef.current) return;
    assessmentGenerationStartedRef.current = true;

    const { stage } = useStageStore.getState();
    const modelConfig = getCurrentModelConfig();
    const body = {
      languageDirective: stage?.languageDirective,
      ...(modelConfig.thinkingConfig ? { thinkingConfig: modelConfig.thinkingConfig } : {}),
    };
    try {
      await regenerateGeneratedCourseAssessment(fetch, courseId, body, {
        'x-model': modelConfig.modelString || '',
        'x-api-key': modelConfig.apiKey || '',
        'x-base-url': modelConfig.baseUrl || '',
        'x-provider-type': modelConfig.providerType || '',
      });
    } catch (error) {
      log.warn('[Classroom] Failed to generate post-course assessment:', error);
      assessmentGenerationStartedRef.current = false;
    }
  }, []);

  const finalizeGeneratedCourse = useCallback(
    async (courseId = generatedCourseIdRef.current) => {
      const content = await syncGeneratedDraftContent(courseId, { generationComplete: true });
      if (content) await generateDraftAssessment(courseId);
      return content;
    },
    [generateDraftAssessment, syncGeneratedDraftContent],
  );

  const { generateRemaining, retrySingleOutline, stop } = useSceneGenerator({
    onSceneGenerated: async () => {
      await syncGeneratedDraftContent();
    },
    onComplete: () => {
      log.info('[Classroom] All scenes generated');
      void finalizeGeneratedCourse();
    },
  });

  const loadClassroom = useCallback(async () => {
    try {
      try {
        const sessionResponse = await fetch('/api/auth/session');
        const session = sessionResponse.ok ? await sessionResponse.json() : null;
        setAuthoringIdentity(
          canManageCourses(session) && !requestedLearningMode
            ? { isAdmin: true }
            : { isAdmin: false },
        );
      } catch {
        setAuthoringIdentity({ isAdmin: false });
      }

      const enterpriseClassroom = await loadEnterpriseClassroom(
        classroomId,
        undefined,
        requestedLearningMode,
      );
      const loadedEnterpriseClassroom = enterpriseClassroom !== null;
      if (enterpriseClassroom) {
        const migrated = enterpriseClassroom.scenes.map(migrateScene);
        useStageStore.setState({
          stage: enterpriseClassroom.stage,
          scenes: migrated,
          currentSceneId: enterpriseClassroom.currentSceneId,
          chats: [],
          outlines: enterpriseClassroom.outlines,
          generationComplete: enterpriseClassroom.generationComplete,
          generatingOutlines: [],
          mode: 'playback',
        });
        generatedCourseIdRef.current = classroomId;
        useMediaGenerationStore
          .getState()
          .restoreFromManifest(classroomId, enterpriseClassroom.mediaManifest);
        if (enterpriseClassroom.stage.generatedAgentConfigs?.length) {
          const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
          await saveGeneratedAgents(
            enterpriseClassroom.stage.id,
            enterpriseClassroom.stage.generatedAgentConfigs,
          );
        }
        setEnterpriseCourseId(classroomId);
        setEnterpriseCourseScope(enterpriseClassroom.scope);
        log.info('Loaded enterprise course from PostgreSQL:', classroomId);
      } else {
        await loadFromStorage(classroomId);
        // A legacy generated classroom can still be addressed by its stage
        // id. Its own persisted `serverCourseId` is scoped to that stage and
        // is therefore safe to use for progress and assessment APIs. Do not
        // restore this from the global generationParams slot: that slot may
        // belong to a different course.
        const stageCourseId = resolveStageCourseStorageId(
          classroomId,
          useStageStore.getState().stage,
        );
        generatedCourseIdRef.current = stageCourseId;
        setEnterpriseCourseId(stageCourseId);
      }

      // If IndexedDB had no data, try server-side storage (API-generated classrooms)
      if (!loadedEnterpriseClassroom && !useStageStore.getState().stage) {
        log.info('No IndexedDB data, trying server-side storage for:', classroomId);
        try {
          const res = await fetch(`/api/classroom?id=${encodeURIComponent(classroomId)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.classroom) {
              const { stage, scenes } = json.classroom;
              useStageStore.getState().setStage(stage);
              // Normalize legacy slide content (missing schemaVersion) on the
              // way in, same as the store's setScenes/loadFromStorage paths —
              // server snapshots predate the schema field.
              const migrated = (scenes as Scene[]).map(migrateScene);
              useStageStore.setState({
                scenes: migrated,
                currentSceneId: migrated[0]?.id ?? null,
                // Match `loadFromStorage` semantics: mode is transient UI
                // state, not persisted with the stage. Reset on every
                // classroom load so SPA navigation doesn't carry Pro
                // mode across.
                mode: 'playback',
              });
              log.info('Loaded from server-side storage:', classroomId);

              // Hydrate server-generated agents into IndexedDB + registry.
              // Don't set selectedAgentIds here — the general agent
              // restoration logic below (Path 2) handles it uniformly.
              if (stage.generatedAgentConfigs?.length) {
                const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
                await saveGeneratedAgents(stage.id, stage.generatedAgentConfigs);
                log.info('Hydrated server-generated agents for stage:', stage.id);
              }
            }
          }
        } catch (fetchErr) {
          log.warn('Server-side storage fetch failed:', fetchErr);
        }
      }

      // Restore completed media generation tasks from IndexedDB only for local/API-generated classrooms.
      // Enterprise course media comes from PostgreSQL manifests and authenticated media endpoints.
      if (!loadedEnterpriseClassroom) {
        await useMediaGenerationStore.getState().restoreFromDB(classroomId);
      }
      // Restore agents for this stage
      const { loadGeneratedAgentsForStage, useAgentRegistry } =
        await import('@/lib/orchestration/registry/store');
      const activeStageId = useStageStore.getState().stage?.id ?? classroomId;
      const generatedAgentIds = await loadGeneratedAgentsForStage(activeStageId);
      const { useSettingsStore } = await import('@/lib/store/settings');
      const { restoreAgentSelection } =
        await import('@/lib/orchestration/registry/agent-selection');
      // Keep the user's explicit AgentBar mode/selection when still valid for
      // this stage instead of unconditionally forcing auto mode (which
      // clobbered it on every classroom visit); fall back to the stage-derived
      // defaults otherwise, marking them as NOT user-set so the next classroom
      // never mistakes them for a choice. Stale generated IDs (from another
      // stage / pre-bleed-fix) never validate, so they don't resolve against a
      // leftover registry entry.
      const settings = useSettingsStore.getState();
      const registry = useAgentRegistry.getState();
      const stage = useStageStore.getState().stage;
      const { selection: next, isUserSet } = restoreAgentSelection({
        persisted: { mode: settings.agentMode, selectedAgentIds: settings.selectedAgentIds },
        persistedIsUserSet: settings.agentSelectionIsUserSet,
        generatedAgentIds,
        stageAgentIds: stage?.agentIds,
        isPresetAgent: (id) => {
          const a = registry.getAgent(id);
          return !!a && !a.isGenerated;
        },
      });
      // restoreAgentSelection returns the persisted object as-is when keeping
      // it, so reference checks skip redundant store writes.
      if (next.mode !== settings.agentMode) settings.setAgentMode(next.mode);
      if (next.selectedAgentIds !== settings.selectedAgentIds) {
        settings.setSelectedAgentIds(next.selectedAgentIds);
      }
      if (isUserSet !== settings.agentSelectionIsUserSet) {
        settings.setAgentSelectionIsUserSet(isUserSet);
      }
    } catch (error) {
      log.error('Failed to load classroom:', error);
      setError(error instanceof Error ? error.message : 'Failed to load classroom');
    } finally {
      setLoading(false);
    }
  }, [classroomId, loadFromStorage, requestedLearningMode]);

  useEffect(() => {
    // Reset loading state on course switch to unmount Stage during transition,
    // preventing stale data from syncing back to the new course
    setLoading(true);
    setError(null);
    generationStartedRef.current = false;
    generatedCourseIdRef.current = null;
    assessmentGenerationStartedRef.current = false;
    setEnterpriseCourseId(null);

    // Clear previous classroom's media tasks to prevent cross-classroom contamination.
    // Placeholder IDs (gen_img_1, gen_vid_1) are NOT globally unique across stages,
    // so stale tasks from a previous classroom would shadow the new one's.
    const mediaStore = useMediaGenerationStore.getState();
    mediaStore.revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    // Clear whiteboard history to prevent snapshots from a previous course leaking in.
    useWhiteboardHistoryStore.getState().clearHistory();

    loadClassroom();

    // Cancel ongoing generation when classroomId changes or component unmounts
    return () => {
      stop();
    };
  }, [classroomId, loadClassroom, stop]);

  // Auto-resume generation for pending outlines
  useEffect(() => {
    if (loading || error || generationStartedRef.current) return;

    const state = useStageStore.getState();
    const { outlines, scenes, stage, generationComplete } = state;

    // Check if there are pending outlines. A finished deck is frozen for
    // editing: deleting a slide leaves its outline orphaned, but that must not
    // be treated as an interrupted generation and regenerated. Only resume
    // when generation has not completed.
    const hasPending =
      !generationComplete &&
      outlines.some((outline) => findSceneForOutline(scenes, outline) === undefined);

    if (hasPending && stage) {
      generationStartedRef.current = true;

      // Load generation params from sessionStorage (stored by generation-preview before navigating)
      type StoredGenerationParams = Omit<
        GenerationParams,
        'stageInfo' | 'imageMapping' | 'courseStorage'
      > & { generatedCourseId?: unknown };
      const params = loadResumeGenerationParams<StoredGenerationParams>(sessionStorage);
      const stageServerCourseId = (stage as unknown as { serverCourseId?: unknown }).serverCourseId;
      const generatedCourseId =
        resolveStageCourseStorageId(classroomId, stage) ??
        resolveGeneratedCourseStorageId(classroomId, [
          params.generatedCourseId,
          generatedCourseIdRef.current,
          stageServerCourseId,
        ]);
      generatedCourseIdRef.current = generatedCourseId;
      setEnterpriseCourseId(generatedCourseId);

      // Reconstruct imageMapping from IndexedDB using pdfImages storageIds
      const storageIds = (params.pdfImages || [])
        .map((img: { storageId?: string }) => img.storageId)
        .filter((storageId): storageId is string => Boolean(storageId));

      loadImageMapping(storageIds).then((imageMapping) => {
        generateRemaining({
          pdfImages: params.pdfImages,
          imageMapping,
          stageInfo: {
            name: stage.name || '',
            description: stage.description,
            style: stage.style,
          },
          agents: params.agents,
          userProfile: params.userProfile,
          languageDirective: params.languageDirective || stage.languageDirective,
          generationRunId: params.generationRunId,
          requirements: params.requirements,
          courseStorage: generatedCourseId ? { courseId: generatedCourseId } : undefined,
        });
      });
    } else if (outlines.length > 0 && stage) {
      // All scenes are generated, but some media may not have finished.
      // Resume media generation for any tasks not yet in IndexedDB.
      // generateMediaForOutlines skips already-completed tasks automatically.
      generationStartedRef.current = true;
      // The deck reached the classroom already fully materialized (e.g. a
      // single-slide course, or a deck whose last slide finished in
      // generation-preview), so generateRemaining's completion path never
      // ran. Record completion now so a later edit/delete is not treated as
      // an interrupted generation. No-op if already complete or not all
      // outlines have scenes.
      const wasComplete = useStageStore.getState().generationComplete;
      useStageStore.getState().markGenerationCompleteIfDone();
      if (!wasComplete && useStageStore.getState().generationComplete) {
        void finalizeGeneratedCourse();
      }
      // Resume media only for outlines that still have a scene. On a finished
      // deck the user may have deleted a slide, leaving an orphaned outline;
      // generating its media would waste API calls on a slide that is gone.
      const materializedOutlines = outlines.filter(
        (outline) => findSceneForOutline(scenes, outline) !== undefined,
      );
      generateMediaForOutlines(
        materializedOutlines,
        stage.id,
        undefined,
        generatedCourseIdRef.current ? { courseId: generatedCourseIdRef.current } : undefined,
      ).catch((err) => {
        log.warn('[Classroom] Media generation resume error:', {
          reason: classifyCourseStorageFailure(err),
          error: err,
        });
      });
    }
  }, [classroomId, loading, error, finalizeGeneratedCourse, generateRemaining]);

  return (
    <ThemeProvider>
      <MediaStageProvider value={classroomId}>
        <div className="h-screen flex flex-col overflow-hidden">
          {enterpriseCourseScope === 'platform' ? (
            <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
              精品课程
            </div>
          ) : null}
          {loading ? (
            <div className="flex flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
              <Spin size="large" description="正在加载课堂…" />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
              <Result
                extra={
                  <>
                    <Button
                      type="primary"
                      onClick={() => {
                        setError(null);
                        setLoading(true);
                        loadClassroom();
                      }}
                    >
                      重新加载
                    </Button>
                    <Link href={learningMode ? '/learn' : '/'}>
                      <Button type="default">返回{learningMode ? '学习中心' : '生成工作台'}</Button>
                    </Link>
                  </>
                }
                status="error"
                subTitle={error}
                title="课堂加载失败"
              />
            </div>
          ) : (
            <Stage
              authoringIdentity={authoringIdentity}
              enterpriseCourseId={enterpriseCourseId}
              learningMode={learningMode}
              onRetryOutline={retrySingleOutline}
              courseSaveStatus={courseEditPersistence.status}
              onSaveCourse={courseEditPersistence.saveNow}
              onFlushCourse={courseEditPersistence.flush}
            />
          )}
        </div>
      </MediaStageProvider>
    </ThemeProvider>
  );
}
