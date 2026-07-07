import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CoursePatchBody {
  name?: string;
  description?: string | null;
  categoryId?: string;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<CoursePatchBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');

  try {
    const { id } = await context.params;
    const course = await getEnterpriseService().updateCourse(id, {
      name: body.name,
      description: body.description,
      categoryId: body.categoryId,
    });
    return apiSuccess({ course });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const course = await getEnterpriseService().deleteCourse(id);
    return apiSuccess({ course });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
