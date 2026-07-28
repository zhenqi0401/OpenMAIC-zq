import { NextRequest } from 'next/server';
import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { callLLM } from '@/lib/ai/llm';
import { apiSuccess } from '@/lib/server/api-response';
import { llmApiError } from '@/lib/server/llm-error-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { EnterpriseStorageServiceError } from '@/lib/storage/enterprise-service';
import { createLogger } from '@/lib/logger';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';
const log = createLogger('CourseAssessmentRegenerate');
const MAX_ASSESSMENT_ATTEMPTS = 3;

interface RegenerateAssessmentBody {
  questionCount?: number;
  languageDirective?: string;
  thinkingConfig?: unknown;
  thinking?: unknown;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const body = (await readJsonBody<RegenerateAssessmentBody>(request)) ?? {};
    const { model, modelInfo, thinkingConfig } = await resolveModelFromRequest(
      request,
      body,
      'course-assessment',
    );
    const aiCall = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      const result = await callLLM(
        {
          model,
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: modelInfo?.outputWindow,
          maxRetries: 0,
        },
        'course-assessment',
        undefined,
        thinkingConfig,
      );
      return result.text;
    };
    for (let attempt = 1; attempt <= MAX_ASSESSMENT_ATTEMPTS; attempt += 1) {
      try {
        const course = await getEnterpriseService().regenerateCourseAssessment(id, {
          aiCall,
          questionCount: body.questionCount,
          languageDirective: body.languageDirective,
        });
        if (attempt > 1) {
          log.info('Assessment generation recovered after retry', { courseId: id, attempt });
        }
        return apiSuccess({ course });
      } catch (error) {
        const retryable = !(error instanceof EnterpriseStorageServiceError);
        const finalAttempt = attempt === MAX_ASSESSMENT_ATTEMPTS;
        log[finalAttempt || !retryable ? 'error' : 'warn']('Assessment generation attempt failed', {
          courseId: id,
          attempt,
          maxAttempts: MAX_ASSESSMENT_ATTEMPTS,
          retryable,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!retryable || finalAttempt) throw error;
      }
    }
    throw new Error('Assessment generation exhausted all attempts');
  } catch (error) {
    if (!(error instanceof EnterpriseStorageServiceError)) {
      return llmApiError(error);
    }
    return enterpriseErrorResponse(error);
  }
}
