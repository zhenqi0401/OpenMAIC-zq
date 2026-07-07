import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  getRouteId,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context?: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const id = await getRouteId(request, context);
    const course = await getEnterpriseService().getVisibleCourse(id, current.identity.roleId);
    if (!course) return apiError('INVALID_REQUEST', 404, 'Course not found');
    return apiSuccess({
      course: course.course,
      stage: course.stage,
      scenes: course.scenes,
      outlines: course.outlines,
      mediaManifest: course.mediaManifest,
      audioManifest: course.audioManifest,
    });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
