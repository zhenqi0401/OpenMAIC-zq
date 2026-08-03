import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';
import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';

export const dynamic = 'force-dynamic';

interface AttemptBody {
  answers?: AssessmentAnswers;
}

function isAnswerValue(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isAnswers(value: unknown): value is AssessmentAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(isAnswerValue);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  const body = await readJsonBody<AttemptBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!isAnswers(body.answers)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'answers are required');
  }

  try {
    const { id } = await context.params;
    const result = await getEnterpriseService().submitCourseAssessment({
      courseId: id,
      userId: current.user.id,
      roleId: current.identity.roleId,
      roleSnapshot: current.identity.roleCode,
      answers: body.answers,
      allowUnpublished: current.identity.isAdmin,
    });
    return apiSuccess({ result }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
