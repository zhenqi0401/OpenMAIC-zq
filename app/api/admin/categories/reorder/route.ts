import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { readJsonBody } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const body = await readJsonBody<{ categoryIds?: unknown }>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!Array.isArray(body.categoryIds) || !body.categoryIds.every((id) => typeof id === 'string')) {
    return apiError('INVALID_REQUEST', 400, 'categoryIds must be a string array');
  }
  try {
    const result = await getAdminManagementService().reorderCategories(body.categoryIds);
    return apiSuccess(result);
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
