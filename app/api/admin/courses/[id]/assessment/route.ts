import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface AssessmentBody {
  questions?: unknown[];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<AssessmentBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!Array.isArray(body.questions)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'questions are required');
  }

  try {
    const { id } = await context.params;
    const access = toTenantAccessContext(admin.identity);
    const visible = await getEnterpriseService().getCourseContent(id, access);
    if (!visible) return apiError('INVALID_REQUEST', 404, 'Course not found');
    if (visible.course.managementMode === 'read_only') {
      return apiError('INVALID_REQUEST', 403, '平台精品课程只读');
    }
    const course = await getEnterpriseService().updateCourseAssessmentQuestions(id, body.questions);
    return apiSuccess({ course });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
