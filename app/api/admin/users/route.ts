import { apiSuccess } from '@/lib/server/api-response';
import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { parseAdminEnum, parseAdminPagination, parseAdminText } from '@/lib/admin/admin-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const search = new URL(request.url).searchParams;
    const { page, pageSize } = parseAdminPagination(search, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });
    const result = await getAdminManagementService(
      toTenantAccessContext(admin.identity),
    ).queryUsers({
      q: parseAdminText(search, 'q'),
      roleId: parseAdminText(search, 'roleId'),
      status: parseAdminEnum(search, 'status', ['all', 'active', 'disabled'] as const, 'all'),
      page,
      pageSize,
    });
    return apiSuccess(result);
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
