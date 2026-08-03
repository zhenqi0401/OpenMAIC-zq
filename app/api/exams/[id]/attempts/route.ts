import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';
import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';
import type { StageExamQuestionRef } from '@/lib/exams/stage-exam';

export const dynamic = 'force-dynamic';

interface ExamAttemptBody {
  answers?: AssessmentAnswers;
  questionRefs?: StageExamQuestionRef[];
  durationSeconds?: number | null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  const body = await readJsonBody<ExamAttemptBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!body.answers || !Array.isArray(body.questionRefs)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'answers and questionRefs are required');
  }

  try {
    const { id } = await context.params;
    const result = await getEnterpriseService(
      toTenantAccessContext(current.identity),
    ).submitStageExam({
      examPolicyId: id,
      userId: current.user.id,
      roleId: current.identity.roleId,
      roleSnapshot: current.identity.roleCode,
      answers: body.answers,
      questionRefs: body.questionRefs,
      durationSeconds: body.durationSeconds ?? null,
    });
    return apiSuccess({ result }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
