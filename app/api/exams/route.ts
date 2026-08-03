import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
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
    const exams = await getEnterpriseService(
      toTenantAccessContext(current.identity),
    ).listAvailableExams(current.identity.roleId);
    return apiSuccess({ exams });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
