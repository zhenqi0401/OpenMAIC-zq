import { getCurrentAuthResult } from '@/lib/auth/current-session';
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
      service.listVisibleCourses(current.identity.roleId, requestedSort),
      service.listCategories(),
    ]);
    return apiSuccess({ courses, categories });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
