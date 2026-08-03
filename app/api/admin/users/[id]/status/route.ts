import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { readJsonBody } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const body = await readJsonBody<{ status?: unknown }>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (body.status !== 'active' && body.status !== 'disabled') {
    return apiError('INVALID_REQUEST', 400, 'status must be active or disabled');
  }
  try {
    const { id } = await context.params;
    const user = await getAdminManagementService(
      toTenantAccessContext(admin.identity),
    ).updateUserStatus({
      userId: id,
      currentUserId: admin.user.id,
      status: body.status,
    });
    return apiSuccess({ user });
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
