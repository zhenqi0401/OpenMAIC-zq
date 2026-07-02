import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  getHostFilters,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const dashboard = await getEnterpriseService().getDashboard(getHostFilters(request));
    return apiSuccess(dashboard);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
