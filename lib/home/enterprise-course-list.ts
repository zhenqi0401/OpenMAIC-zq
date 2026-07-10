import type { Slide } from '@openmaic/dsl';
import { getFirstSlideByStages, listStages, type StageListItem } from '@/lib/utils/stage-storage';
import type { SessionIdentity } from '@/lib/auth/types';

export type HomeCourseSource = 'enterprise' | 'local';
export type HomeCourseFilter = 'all' | HomeCourseSource;

export type LocalHomeCourse = StageListItem & {
  source: 'local';
};

export type EnterpriseHomeCourse = StageListItem & {
  source: 'enterprise';
  generationComplete?: boolean;
};

export type HomeCourse = LocalHomeCourse | EnterpriseHomeCourse;

export interface HomeCourseLoadResult {
  courses: HomeCourse[];
  thumbnails: Record<string, Slide>;
}

export interface HomeCourseLoaders {
  listLocalStages: () => Promise<StageListItem[]>;
  loadEnterpriseCourses: () => Promise<EnterpriseHomeCourse[]>;
  getFirstSlides: (stageIds: string[]) => Promise<Record<string, Slide>>;
  loadEnterpriseFirstSlides?: (courses: EnterpriseHomeCourse[]) => Promise<Record<string, Slide>>;
}

type FetchLike = (url: string) => Promise<Response>;

interface EnterpriseCourseListResponse {
  error?: unknown;
  courses?: Array<{
    id?: unknown;
    name?: unknown;
    description?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    generationComplete?: unknown;
  }>;
}

interface EnterpriseCourseContentResponse {
  scenes?: Array<{
    content?: {
      type?: unknown;
      canvas?: unknown;
    };
  }>;
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export async function loadEnterpriseHomeCourses(
  fetcher: FetchLike = (url) => fetch(url),
): Promise<EnterpriseHomeCourse[]> {
  const response = await fetcher('/api/courses');
  const data = (await response.json().catch(() => ({}))) as EnterpriseCourseListResponse;
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : '课程加载失败';
    throw new Error(message.includes('课程') ? message : '课程加载失败');
  }
  const courses = Array.isArray(data.courses) ? data.courses : [];

  return courses
    .filter((course) => typeof course.id === 'string' && typeof course.name === 'string')
    .map((course) => ({
      id: course.id as string,
      name: course.name as string,
      description: typeof course.description === 'string' ? course.description : undefined,
      sceneCount: 0,
      createdAt: toTimestamp(course.createdAt),
      updatedAt: toTimestamp(course.updatedAt),
      source: 'enterprise' as const,
      generationComplete:
        typeof course.generationComplete === 'boolean' ? course.generationComplete : undefined,
    }));
}

export function isLocalHomeCourse(course: HomeCourse): course is LocalHomeCourse {
  return course.source === 'local';
}

export function filterHomeCourses(
  courses: HomeCourse[],
  source: HomeCourseFilter,
  query: string,
): HomeCourse[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return courses.filter((course) => {
    if (source !== 'all' && course.source !== source) return false;
    if (!normalizedQuery) return true;
    return [course.name, course.description]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function shouldPersistImportedClassroom(
  identity: SessionIdentity | null,
  categoryId: string,
): boolean {
  return identity?.isAdmin === true && categoryId.trim().length > 0;
}

export async function loadEnterpriseHomeCourseThumbnails(
  courses: Array<{ id: string }>,
  fetcher: FetchLike = (url) => fetch(url),
): Promise<Record<string, Slide>> {
  const thumbnails: Record<string, Slide> = {};
  await Promise.all(
    courses.map(async (course) => {
      const response = await fetcher(`/api/courses/${encodeURIComponent(course.id)}`);
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as EnterpriseCourseContentResponse;
      const scenes = Array.isArray(data.scenes) ? data.scenes : [];
      const firstSlide = scenes.find((scene) => scene.content?.type === 'slide');
      const canvas = firstSlide?.content?.canvas;
      if (canvas && typeof canvas === 'object') {
        thumbnails[course.id] = canvas as Slide;
      }
    }),
  );
  return thumbnails;
}

export async function loadHomeCourses(
  loaders: HomeCourseLoaders = {
    listLocalStages: listStages,
    loadEnterpriseCourses: () => loadEnterpriseHomeCourses(),
    getFirstSlides: getFirstSlideByStages,
  },
): Promise<HomeCourseLoadResult> {
  const [localCourses, enterpriseCourses] = await Promise.all([
    loaders.listLocalStages(),
    loaders.loadEnterpriseCourses(),
  ]);
  const sourcedLocalCourses: LocalHomeCourse[] = localCourses.map((course) => ({
    ...course,
    source: 'local',
  }));
  const [localThumbnails, enterpriseThumbnails] = await Promise.all([
    localCourses.length > 0
      ? loaders.getFirstSlides(localCourses.map((course) => course.id))
      : Promise.resolve({}),
    enterpriseCourses.length > 0
      ? (loaders.loadEnterpriseFirstSlides ?? loadEnterpriseHomeCourseThumbnails)(enterpriseCourses)
      : Promise.resolve({}),
  ]);

  return {
    courses: [...sourcedLocalCourses, ...enterpriseCourses].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    ),
    thumbnails: { ...localThumbnails, ...enterpriseThumbnails },
  };
}
