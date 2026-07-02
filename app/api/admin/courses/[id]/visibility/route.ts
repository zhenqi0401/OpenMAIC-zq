import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';
import type { CourseVisibilityMode } from '@/lib/storage/enterprise-service';

export const dynamic = 'force-dynamic';

interface VisibilityBody {
  visibilityMode?: CourseVisibilityMode;
  visibleRoleIds?: string[];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<VisibilityBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (body.visibilityMode !== 'all' && body.visibilityMode !== 'roles') {
    return apiError('INVALID_REQUEST', 400, 'visibilityMode must be all or roles');
  }
  if (body.visibilityMode === 'roles' && !Array.isArray(body.visibleRoleIds)) {
    return apiError(
      'MISSING_REQUIRED_FIELD',
      400,
      'visibleRoleIds is required for role visibility',
    );
  }

  try {
    const { id } = await context.params;
    const course = await getEnterpriseService().updateCourseVisibility(id, {
      visibilityMode: body.visibilityMode,
      visibleRoleIds: body.visibilityMode === 'roles' ? (body.visibleRoleIds ?? []) : [],
    });
    return apiSuccess({ course });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
