import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  getRouteId,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const id = await getRouteId(request, context);
    const course = await getEnterpriseService().getVisibleCourse(
      id,
      toTenantAccessContext(current.identity),
    );
    if (!course) return apiError('INVALID_REQUEST', 404, 'Course not found');
    if (
      current.identity.isAdmin &&
      new URL(request.url).searchParams.get('mode') === 'learn' &&
      course.course.status !== 'published'
    ) {
      return apiError('INVALID_REQUEST', 404, 'Course not found');
    }
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
