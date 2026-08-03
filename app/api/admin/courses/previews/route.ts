import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const raw = new URL(request.url).searchParams.get('ids');
  if (!raw?.trim()) return apiError('INVALID_REQUEST', 400, 'ids is required');
  const ids = raw.split(',').map((id) => id.trim());
  if (ids.some((id) => !id)) return apiError('INVALID_REQUEST', 400, 'ids contains an empty ID');
  try {
    return apiSuccess(
      await getAdminManagementService(toTenantAccessContext(admin.identity)).getCoursePreviews(ids),
    );
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
