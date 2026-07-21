import type {
  CourseStatus,
  CourseVisibilityMode,
  EnterpriseCourse,
} from '@/lib/storage/enterprise-service';

export type CourseAdminStatusFilter = CourseStatus | 'all' | 'review';

export interface CourseAdminFilters {
  status: CourseAdminStatusFilter;
  categoryId: string;
  visibilityMode: CourseVisibilityMode | 'any';
  query: string;
}

export const DEFAULT_COURSE_ADMIN_FILTERS: CourseAdminFilters = {
  status: 'all',
  categoryId: '',
  visibilityMode: 'any',
  query: '',
};

export interface CourseContentStatus {
  label: string;
  tone: 'neutral' | 'warning';
}

export function getCourseContentStatus(course: EnterpriseCourse): CourseContentStatus {
  if (course.generationComplete === false && course.generationStatus === 'generating') {
    return { label: '生成中', tone: 'warning' };
  }
  if (course.generationComplete === false) {
    return { label: '内容未完成', tone: 'warning' };
  }
  if (course.assessmentQuestions.length === 0) {
    return { label: '缺少课后测评', tone: 'warning' };
  }
  return { label: '已有测评题', tone: 'neutral' };
}

export function courseNeedsReview(course: EnterpriseCourse): boolean {
  return getCourseContentStatus(course).tone === 'warning';
}

export function shouldApplyCourseAdminFilters(filters: CourseAdminFilters): boolean {
  return (
    filters.status !== DEFAULT_COURSE_ADMIN_FILTERS.status ||
    filters.categoryId !== DEFAULT_COURSE_ADMIN_FILTERS.categoryId ||
    filters.visibilityMode !== DEFAULT_COURSE_ADMIN_FILTERS.visibilityMode ||
    filters.query.trim() !== DEFAULT_COURSE_ADMIN_FILTERS.query
  );
}

export function filterAdminCourses(
  courses: readonly EnterpriseCourse[],
  filters: CourseAdminFilters,
): EnterpriseCourse[] {
  const query = filters.query.trim().toLowerCase();
  return courses.filter((course) => {
    if (filters.status === 'review') {
      if (!courseNeedsReview(course)) return false;
    } else if (filters.status !== 'all' && course.status !== filters.status) {
      return false;
    }
    if (filters.categoryId && course.categoryId !== filters.categoryId) return false;
    if (filters.visibilityMode !== 'any' && course.visibilityMode !== filters.visibilityMode) {
      return false;
    }
    if (!query) return true;
    return (
      course.name.toLowerCase().includes(query) ||
      (course.description ?? '').toLowerCase().includes(query) ||
      (course.categoryName ?? '').toLowerCase().includes(query)
    );
  });
}

export function formatCourseUpdatedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

export function getCourseVisibilitySummary(
  course: Pick<EnterpriseCourse, 'visibilityMode' | 'visibleRoleIds'>,
  roleNames: ReadonlyMap<string, string>,
): string {
  if (course.visibilityMode === 'all') return '全体可见';
  const names = course.visibleRoleIds.map((id) => roleNames.get(id)).filter(Boolean) as string[];
  if (names.length > 0) return `按角色：${names.join('、')}`;
  return course.visibleRoleIds.length > 0
    ? `按角色（${course.visibleRoleIds.length} 个）`
    : '按角色：未选择';
}

export function getCourseStatusAction(course: Pick<EnterpriseCourse, 'status'>): {
  action: 'publish' | 'archive';
  label: string;
} {
  if (course.status === 'published') return { action: 'archive', label: '下架' };
  return { action: 'publish', label: course.status === 'archived' ? '重新发布' : '发布' };
}

export function buildCourseVisibilityRequest(
  courseId: string,
  visibilityMode: CourseVisibilityMode,
  visibleRoleIds: readonly string[],
) {
  return {
    url: `/api/admin/courses/${courseId}/visibility`,
    init: {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visibilityMode,
        visibleRoleIds: visibilityMode === 'all' ? [] : [...visibleRoleIds],
      }),
    },
  } as const;
}
