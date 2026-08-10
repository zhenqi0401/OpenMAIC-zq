import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  try {
    const { id } = await context.params;
    const service = getEnterpriseService();
    const roles = await service.listRoles(toTenantAccessContext(admin.identity));
    const role = roles.find((candidate) => candidate.id === id);
    if (!role) return apiError('INVALID_REQUEST', 404, 'Role not found');
    const courses = await service.getRoleLearningPath(id, toTenantAccessContext(admin.identity));
    return apiSuccess({
      role: { id: role.id, name: role.name, userCount: 0, courseCount: courses.length },
      courses,
    });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const body = await readJsonBody<{ courseIds?: unknown }>(request);
  if (
    !body ||
    !Array.isArray(body.courseIds) ||
    body.courseIds.some((id) => typeof id !== 'string')
  ) {
    return apiError('INVALID_REQUEST', 400, 'courseIds must be an array of course IDs');
  }
  try {
    const { id } = await context.params;
    const courses = await getEnterpriseService().replaceRoleLearningPath(
      id,
      body.courseIds,
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ courses });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
