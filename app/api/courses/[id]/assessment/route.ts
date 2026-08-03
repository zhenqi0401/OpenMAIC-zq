import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id } = await context.params;
    const assessment = await getEnterpriseService().getCourseAssessment({
      courseId: id,
      userId: current.user.id,
      roleId: current.identity.roleId,
      allowUnpublished: current.identity.isAdmin,
    });
    return apiSuccess({ assessment });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
