import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CategoryPatchBody {
  name?: string;
  sortOrder?: number;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<CategoryPatchBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');

  try {
    const { id } = await context.params;
    const category = await getEnterpriseService().updateCategory(id, body);
    return apiSuccess({ category });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
