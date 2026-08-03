import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id } = await context.params;
    const exam = await getEnterpriseService(toTenantAccessContext(current.identity)).startStageExam(
      {
        examPolicyId: id,
        roleId: current.identity.roleId,
      },
    );
    return apiSuccess({ exam });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
