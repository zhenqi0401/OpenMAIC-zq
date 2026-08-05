import type { Scene, Stage } from '@/lib/types/stage';
import type { SceneOutline } from '@/lib/types/generation';

type FetchLike = (url: string) => Promise<Response>;

interface CourseDetailResponse {
  content?: CourseDetailPayload;
}

interface CourseDetailPayload {
  course?: {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    generationComplete?: unknown;
    scope?: unknown;
  };
  stage?: unknown;
  scenes?: unknown[];
  outlines?: unknown[];
  audioManifest?: Array<{ audioId?: unknown; url?: unknown }>;
  mediaManifest?: Array<{
    mediaId?: unknown;
    url?: unknown;
    type?: unknown;
    posterUrl?: unknown;
  }>;
}

export interface EnterpriseClassroomData {
  scope: 'platform' | 'tenant';
  stage: Stage;
  scenes: Scene[];
  currentSceneId: string | null;
  outlines: SceneOutline[];
  generationComplete: boolean;
  mediaManifest: Array<{
    mediaId: string;
    url: string;
    type: 'image' | 'video';
    posterUrl?: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hydrateAudioUrls<T>(value: T, audioUrls: Map<string, string>): T {
  if (Array.isArray(value)) {
    return value.map((item) => hydrateAudioUrls(item, audioUrls)) as T;
  }
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = hydrateAudioUrls(child, audioUrls);
  }

  const audioId = typeof next.audioId === 'string' ? next.audioId : null;
  const audioUrl = audioId ? audioUrls.get(audioId) : null;
  if (audioUrl) next.audioUrl = audioUrl;

  return next as T;
}

function normalizeStage(courseId: string, courseName: string, value: unknown): Stage {
  const base = isRecord(value) ? value : {};
  const now = Date.now();
  return {
    ...base,
    id: typeof base.id === 'string' ? base.id : courseId,
    name: typeof base.name === 'string' ? base.name : courseName,
    createdAt: typeof base.createdAt === 'number' ? base.createdAt : now,
    updatedAt: typeof base.updatedAt === 'number' ? base.updatedAt : now,
    serverCourseId: courseId,
  } as unknown as Stage;
}

export async function loadEnterpriseClassroom(
  courseId: string,
  fetcher: FetchLike = (url) => fetch(url),
  learningMode = false,
): Promise<EnterpriseClassroomData | null> {
  const encodedId = encodeURIComponent(courseId);
  const query = learningMode ? '?mode=learn' : '';
  let response = await fetcher(`/api/courses/${encodedId}${query}`);
  if (!response.ok && !learningMode) {
    response = await fetcher(`/api/admin/courses/${encodedId}/content`);
  }
  if (!response.ok) return null;

  const envelope = (await response.json().catch(() => ({}))) as CourseDetailResponse &
    CourseDetailPayload;
  const data: CourseDetailPayload = isRecord(envelope.content) ? envelope.content : envelope;
  const course = isRecord(data.course) ? data.course : {};
  const resolvedCourseId = typeof course.id === 'string' ? course.id : courseId;
  const courseName = typeof course.name === 'string' ? course.name : 'Untitled Course';
  const stage = normalizeStage(resolvedCourseId, courseName, data.stage);

  const audioUrls = new Map<string, string>();
  for (const item of Array.isArray(data.audioManifest) ? data.audioManifest : []) {
    if (typeof item.audioId === 'string' && typeof item.url === 'string') {
      audioUrls.set(item.audioId, item.url);
    }
  }

  const scenes = (Array.isArray(data.scenes) ? data.scenes : [])
    .filter(isRecord)
    .map((scene, index) => {
      const normalized = {
        ...hydrateAudioUrls(scene, audioUrls),
        id: typeof scene.id === 'string' ? scene.id : `scene-${index + 1}`,
        stageId: typeof scene.stageId === 'string' ? scene.stageId : stage.id,
        order: typeof scene.order === 'number' ? scene.order : index + 1,
      };
      return normalized as Scene;
    });

  return {
    scope: course.scope === 'platform' ? 'platform' : 'tenant',
    stage,
    scenes,
    currentSceneId: scenes[0]?.id ?? null,
    outlines: (Array.isArray(data.outlines) ? data.outlines : []) as SceneOutline[],
    generationComplete:
      typeof course.generationComplete === 'boolean' ? course.generationComplete : true,
    mediaManifest: (Array.isArray(data.mediaManifest) ? data.mediaManifest : [])
      .filter(
        (item) =>
          typeof item.mediaId === 'string' &&
          typeof item.url === 'string' &&
          (item.type === 'image' || item.type === 'video'),
      )
      .map((item) => ({
        mediaId: item.mediaId as string,
        url: item.url as string,
        type: item.type as 'image' | 'video',
        ...(typeof item.posterUrl === 'string' ? { posterUrl: item.posterUrl } : {}),
      })),
  };
}
