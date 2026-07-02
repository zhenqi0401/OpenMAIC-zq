import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface RoleBody {
  code?: string;
  name?: string;
  isAdmin?: boolean;
}

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const roles = await getEnterpriseService().listRoles();
    return apiSuccess({ roles });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<RoleBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.code) || !requiredString(body.name)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'code and name are required');
  }

  try {
    const role = await getEnterpriseService().createRole({
      code: body.code.trim(),
      name: body.name.trim(),
      isAdmin: body.isAdmin,
    });
    return apiSuccess({ role }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
