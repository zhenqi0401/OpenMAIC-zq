import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface RolePatchBody {
  code?: string;
  name?: string;
  isAdmin?: boolean;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<RolePatchBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');

  try {
    const { id } = await context.params;
    const role = await getEnterpriseService().updateRole(
      id,
      body,
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ role });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const role = await getEnterpriseService().deleteRole(id, toTenantAccessContext(admin.identity));
    return apiSuccess({ role });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
