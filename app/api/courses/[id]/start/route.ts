import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  if (current.identity.isAdmin) {
    return apiError(
      'INVALID_REQUEST',
      403,
      'Administrator previews do not record learning progress',
    );
  }

  try {
    const { id } = await context.params;
    const progress = await getEnterpriseService().startCourse({
      courseId: id,
      userId: current.user.id,
      roleId: current.identity.roleId,
    });
    return apiSuccess({ progress });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
