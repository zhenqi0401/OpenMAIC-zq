import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const service = getEnterpriseService();
    const [courses, categories] = await Promise.all([
      service.listVisibleCourses(current.identity.roleId),
      service.listCategories(),
    ]);
    return apiSuccess({ courses, categories });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
