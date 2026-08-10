import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';
import { parseAdminPagination } from '@/lib/admin/admin-query';

export const dynamic = 'force-dynamic';

const statuses = new Set(['not_started', 'learning', 'assessment_pending', 'completed']);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const search = new URL(request.url).searchParams;
  const { page, pageSize } = parseAdminPagination(search, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });
  const learningStatus = search.get('learningStatus') ?? undefined;
  if (learningStatus && !statuses.has(learningStatus)) {
    return apiError('INVALID_REQUEST', 400, 'Invalid learningStatus');
  }
  try {
    const { id } = await context.params;
    const analytics = await getEnterpriseService().getCourseAnalytics(
      id,
      toTenantAccessContext(admin.identity),
      {
        page,
        pageSize,
        roleId: search.get('roleId') ?? undefined,
        learningStatus: learningStatus as never,
      },
    );
    return apiSuccess(analytics);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
