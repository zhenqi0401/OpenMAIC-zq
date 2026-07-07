import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  parseDate,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface InviteCodePatchBody {
  roleId?: string;
  enabled?: boolean;
  expiresAt?: string | null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<InviteCodePatchBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');

  const expiresAt = parseDate(body.expiresAt);
  if (expiresAt === undefined && body.expiresAt !== undefined) {
    return apiError('INVALID_REQUEST', 400, 'expiresAt must be an ISO date or null');
  }

  try {
    const { id } = await context.params;
    const inviteCode = await getEnterpriseService().updateInviteCode(id, {
      roleId: body.roleId,
      enabled: body.enabled,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    });
    return apiSuccess({ inviteCode });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const inviteCode = await getEnterpriseService().deleteInviteCode(id);
    return apiSuccess({ inviteCode });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
