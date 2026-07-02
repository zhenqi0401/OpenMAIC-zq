import { apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  getHostFilters,
  getHostToken,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = await getEnterpriseService().getHostExamAttempts({
      pathname: new URL(request.url).pathname,
      token: getHostToken(request),
      filters: getHostFilters(request),
    });
    return apiSuccess(result);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
