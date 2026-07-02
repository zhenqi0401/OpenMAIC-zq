import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const course = await getEnterpriseService().publishCourse(id);
    return apiSuccess({ course });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
