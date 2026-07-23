import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiSuccess } from '@/lib/server/api-response';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { parseAdminEnum } from '@/lib/admin/admin-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  try {
    const range = parseAdminEnum(
      new URL(request.url).searchParams,
      'range',
      ['today', 'week', 'month'] as const,
      'today',
    );
    const summary = await getAdminManagementService().getCommunitySummary(range);
    return apiSuccess({ summary });
  } catch (error) {
    return adminManagementErrorResponse(error);
  }
}
