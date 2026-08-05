import type { Slide } from '@openmaic/dsl';
import type { StageListItem } from '@/lib/utils/stage-storage';

export type HomeCourseScope = 'platform' | 'tenant';
export type HomeCourseFilter = 'all' | HomeCourseScope;
export type HomeCourseSort = 'latest' | 'popular';

export type EnterpriseHomeCourse = StageListItem & {
  source: 'enterprise';
  scope: HomeCourseScope;
  categoryId: string;
  categoryName: string | null;
  categoryKey: string | null;
  learnerCount: number;
  generationComplete?: boolean;
};

export interface HomeCourseCategory {
  id: string;
  name: string;
  sortOrder: number;
  scope: HomeCourseScope;
  categoryKey?: string | null;
  isSystem?: boolean;
}

export interface EnterpriseHomeCatalog {
  courses: EnterpriseHomeCourse[];
  categories: HomeCourseCategory[];
}

export interface LearnerHomeCourseLoadResult {
  courses: EnterpriseHomeCourse[];
  categories: HomeCourseCategory[];
  thumbnails: Record<string, Slide>;
}

export interface LearnerHomeCourseLoaders {
  loadEnterpriseCatalog: () => Promise<EnterpriseHomeCatalog>;
  loadEnterpriseFirstSlides?: (courses: EnterpriseHomeCourse[]) => Promise<Record<string, Slide>>;
}

type FetchLike = (url: string) => Promise<Response>;

interface EnterpriseCourseListResponse {
  error?: unknown;
  courses?: Array<{
    id?: unknown;
    name?: unknown;
    description?: unknown;
    categoryId?: unknown;
    categoryName?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    generationComplete?: unknown;
    scope?: unknown;
    learnerCount?: unknown;
    sceneCount?: unknown;
  }>;
  categories?: Array<{
    id?: unknown;
    name?: unknown;
    sortOrder?: unknown;
    scope?: unknown;
    categoryKey?: unknown;
    isSystem?: unknown;
  }>;
}

interface EnterpriseCourseContentResponse {
  content?: EnterpriseCourseContentResponse;
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

export async function loadEnterpriseHomeCatalog(
  fetcher: FetchLike = (url) => fetch(url),
): Promise<EnterpriseHomeCatalog> {
  const response = await fetcher('/api/courses');
  const data = (await response.json().catch(() => ({}))) as EnterpriseCourseListResponse;
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : '课程加载失败';
    throw new Error(message.includes('课程') ? message : '课程加载失败');
  }
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];
  const categories: HomeCourseCategory[] = rawCategories
    .filter(
      (category) =>
        typeof category.id === 'string' &&
        typeof category.name === 'string' &&
        typeof category.sortOrder === 'number',
    )
    .map((category) => ({
      id: category.id as string,
      name: category.name as string,
      sortOrder: category.sortOrder as number,
      scope:
        category.scope === 'platform' || category.scope === 'tenant' ? category.scope : 'tenant',
      categoryKey: typeof category.categoryKey === 'string' ? category.categoryKey : null,
      isSystem:
        typeof category.isSystem === 'boolean'
          ? category.isSystem
          : typeof category.categoryKey === 'string',
    }));
  const categoryKeys = new Map(categories.map((category) => [category.id, category.categoryKey]));

  return {
    courses: courses
      .filter(
        (course) =>
          typeof course.id === 'string' &&
          typeof course.name === 'string' &&
          typeof course.categoryId === 'string',
      )
      .map((course) => ({
        id: course.id as string,
        name: course.name as string,
        description: typeof course.description === 'string' ? course.description : undefined,
        categoryId: course.categoryId as string,
        categoryName: typeof course.categoryName === 'string' ? course.categoryName : null,
        sceneCount:
          typeof course.sceneCount === 'number' && Number.isFinite(course.sceneCount)
            ? Math.max(0, Math.trunc(course.sceneCount))
            : 0,
        createdAt: toTimestamp(course.createdAt),
        updatedAt: toTimestamp(course.updatedAt),
        source: 'enterprise' as const,
        scope: course.scope === 'platform' || course.scope === 'tenant' ? course.scope : 'tenant',
        categoryKey: categoryKeys.get(course.categoryId as string) ?? null,
        learnerCount:
          typeof course.learnerCount === 'number' && Number.isFinite(course.learnerCount)
            ? Math.max(0, Math.trunc(course.learnerCount))
            : 0,
        generationComplete:
          typeof course.generationComplete === 'boolean' ? course.generationComplete : undefined,
      })),
    categories,
  };
}

export function filterHomeCourses(
  courses: EnterpriseHomeCourse[],
  scope: HomeCourseFilter,
  query: string,
  categoryKey: string | null = null,
  categoryId: string | null = null,
): EnterpriseHomeCourse[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return courses.filter((course) => {
    if (scope !== 'all' && course.scope !== scope) return false;
    if (categoryKey && course.categoryKey !== categoryKey) return false;
    if (categoryId && course.categoryId !== categoryId) return false;
    if (!normalizedQuery) return true;
    return [course.name, course.description]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function sortHomeCourses(
  courses: EnterpriseHomeCourse[],
  sort: HomeCourseSort,
): EnterpriseHomeCourse[] {
  return [...courses].sort((left, right) => {
    if (sort === 'popular') {
      const countDifference = right.learnerCount - left.learnerCount;
      if (countDifference !== 0) return countDifference;
    }
    const dateDifference = right.updatedAt - left.updatedAt;
    if (dateDifference !== 0) return dateDifference;
    return left.id.localeCompare(right.id);
  });
}

export interface HomeCourseSelection {
  scope: HomeCourseFilter;
  categoryKey: string | null;
  categoryId: string | null;
}

export function changeHomeCourseScope(
  selection: HomeCourseSelection,
  scope: HomeCourseFilter,
): HomeCourseSelection {
  return {
    scope,
    categoryKey: selection.categoryKey,
    categoryId: scope === 'platform' ? null : selection.categoryId,
  };
}

export function changeHomeCourseCategory(
  selection: HomeCourseSelection,
  category: Pick<HomeCourseCategory, 'id' | 'categoryKey'> | null,
): HomeCourseSelection {
  return {
    scope: category?.categoryKey ? selection.scope : category ? 'tenant' : selection.scope,
    categoryKey: category?.categoryKey ?? null,
    categoryId: category && !category.categoryKey ? category.id : null,
  };
}

export async function loadEnterpriseHomeCourseThumbnails(
  courses: Array<{ id: string }>,
  fetcher: FetchLike = (url) => fetch(url),
): Promise<Record<string, Slide>> {
  const thumbnails: Record<string, Slide> = {};
  await Promise.all(
    courses.map(async (course) => {
      let response = await fetcher(`/api/courses/${encodeURIComponent(course.id)}`);
      if (!response.ok) {
        response = await fetcher(`/api/admin/courses/${encodeURIComponent(course.id)}/content`);
      }
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as EnterpriseCourseContentResponse;
      const payload = data.content ?? data;
      const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
      const firstSlide = scenes.find((scene) => scene.content?.type === 'slide');
      const canvas = firstSlide?.content?.canvas;
      if (canvas && typeof canvas === 'object') {
        thumbnails[course.id] = canvas as Slide;
      }
    }),
  );
  return thumbnails;
}

/**
 * Load the learner catalogue exclusively from the server-authoritative course API.
 * Browser-local IndexedDB stages intentionally never enter this path.
 */
export async function loadLearnerHomeCourses(
  loaders: LearnerHomeCourseLoaders = {
    loadEnterpriseCatalog: () => loadEnterpriseHomeCatalog(),
  },
): Promise<LearnerHomeCourseLoadResult> {
  const enterpriseCatalog = await loaders.loadEnterpriseCatalog();
  const courses = sortHomeCourses(enterpriseCatalog.courses, 'latest');
  const thumbnails =
    courses.length > 0
      ? await (loaders.loadEnterpriseFirstSlides ?? loadEnterpriseHomeCourseThumbnails)(courses)
      : {};

  return {
    courses,
    categories: enterpriseCatalog.categories,
    thumbnails,
  };
}
