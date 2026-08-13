import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { isCoursePopularityEnabled } from '@/lib/config/feature-flags';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  const requestedSort = new URL(request.url).searchParams.get('sort') ?? 'latest';
  if (requestedSort !== 'latest' && requestedSort !== 'popular') {
    return apiError('INVALID_REQUEST', 400, 'sort must be latest or popular');
  }
  if (requestedSort === 'popular' && !isCoursePopularityEnabled()) {
    return apiError('INVALID_REQUEST', 404, 'Course popularity is disabled');
  }

  try {
    const service = getEnterpriseService();
    const [courses, categories] = await Promise.all([
      service.listVisibleCourses(toTenantAccessContext(current.identity), requestedSort),
      service.listCategories(toTenantAccessContext(current.identity)),
    ]);
    // Thumbnails are resolved only for the courses listVisibleCourses admitted,
    // so tenant isolation and learner visibility match the course list exactly.
    // A thumbnail lookup failure must never take down the course list itself —
    // degrade to placeholder thumbnails instead of erroring the whole response.
    let thumbnails: Map<string, unknown> = new Map();
    try {
      thumbnails = await service.listCourseThumbnails(courses.map((course) => course.id));
    } catch (error) {
      console.error('Failed to resolve learner course thumbnails:', error);
    }
    return apiSuccess({
      courses: courses.map(
        ({
          managementMode: _managementMode,
          tenantId: _tenantId,
          stageSnapshot: _stageSnapshot,
          ...course
        }) => ({
          ...course,
          thumbnail: thumbnails.get(course.id) ?? null,
        }),
      ),
      categories: categories.map(
        ({ managementMode: _managementMode, tenantId: _tenantId, ...category }) => category,
      ),
    });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
