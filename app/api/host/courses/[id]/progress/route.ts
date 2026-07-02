import { apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  getHostFilters,
  getHostToken,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await getEnterpriseService().getHostCourseProgress({
      pathname: new URL(request.url).pathname,
      token: getHostToken(request),
      filters: { ...getHostFilters(request), courseId: id },
    });
    return apiSuccess(result);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
