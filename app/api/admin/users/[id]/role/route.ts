import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { readJsonBody, authErrorResponse } from '@/lib/auth/route-utils';

export const dynamic = 'force-dynamic';

interface UpdateRoleBody {
  roleId?: string;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<UpdateRoleBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!body.roleId) return apiError('MISSING_REQUIRED_FIELD', 400, 'roleId is required');

  const { id } = await context.params;
  try {
    const auth = createAuthService(getAuthRepository());
    const result = await auth.updateUserRole({
      userId: id,
      roleId: body.roleId,
      actorUserId: admin.user.id,
      actorTenantId: admin.identity.tenantId,
    });
    return apiSuccess({
      user: {
        id: result.user.id,
        phone: result.user.phone,
        hostUserId: result.user.hostUserId,
        displayName: result.user.displayName,
        status: result.user.status,
        role: result.role,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
