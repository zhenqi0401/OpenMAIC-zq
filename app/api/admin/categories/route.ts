import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CategoryBody {
  name?: string;
  sortOrder?: number;
}

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const categories = await getEnterpriseService().listCategories();
    return apiSuccess({ categories });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<CategoryBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.name)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'name is required');
  }

  try {
    const category = await getEnterpriseService().createCategory({
      name: body.name.trim(),
      sortOrder: body.sortOrder,
    });
    return apiSuccess({ category }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
