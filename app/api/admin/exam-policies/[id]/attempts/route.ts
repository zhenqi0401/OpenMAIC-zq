import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiSuccess } from '@/lib/server/api-response';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { parseAdminPagination } from '@/lib/admin/admin-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  try {
    const search = new URL(request.url).searchParams;
    const { page, pageSize } = parseAdminPagination(search, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });
    const { id } = await context.params;
    return apiSuccess(
      await getAdminManagementService(toTenantAccessContext(admin.identity)).getExamPolicyAttempts(
        id,
        page,
        pageSize,
      ),
    );
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
