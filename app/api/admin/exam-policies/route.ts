import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface ExamPolicyBody {
  title?: string;
  targetRoleId?: string;
  categoryIds?: string[];
  courseIds?: string[];
  questionCount?: number;
  passThreshold?: number;
  timeLimitMinutes?: number | null;
}

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const examPolicies = await getEnterpriseService().listExamPolicies();
    return apiSuccess({ examPolicies });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<ExamPolicyBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    !requiredString(body.title) ||
    !requiredString(body.targetRoleId) ||
    !Array.isArray(body.categoryIds) ||
    !Array.isArray(body.courseIds) ||
    typeof body.questionCount !== 'number'
  ) {
    return apiError(
      'MISSING_REQUIRED_FIELD',
      400,
      'title, targetRoleId, categoryIds, courseIds and questionCount are required',
    );
  }

  try {
    const examPolicy = await getEnterpriseService().createExamPolicy({
      title: body.title.trim(),
      targetRoleId: body.targetRoleId,
      categoryIds: body.categoryIds,
      courseIds: body.courseIds,
      questionCount: body.questionCount,
      passThreshold: body.passThreshold ?? 80,
      timeLimitMinutes: body.timeLimitMinutes ?? null,
    });
    return apiSuccess({ examPolicy }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
