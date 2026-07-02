import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface ProgressBody {
  sceneIndex?: number;
  actionIndex?: number;
  completed?: boolean;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  const body = await readJsonBody<ProgressBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (typeof body.sceneIndex !== 'number' || typeof body.actionIndex !== 'number') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'sceneIndex and actionIndex are required');
  }

  try {
    const { id } = await context.params;
    const visible = await getEnterpriseService().getVisibleCourse(id, current.identity.roleId);
    if (!visible) return apiError('INVALID_REQUEST', 404, 'Course not found');
    const progress = await getEnterpriseService().saveCourseProgress({
      userId: current.user.id,
      courseId: id,
      sceneIndex: body.sceneIndex,
      actionIndex: body.actionIndex,
      completed: body.completed ?? false,
    });
    return apiSuccess({ progress });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
