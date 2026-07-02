import { NextRequest } from 'next/server';
import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { callLLM } from '@/lib/ai/llm';
import { apiSuccess } from '@/lib/server/api-response';
import { llmApiError } from '@/lib/server/llm-error-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { EnterpriseStorageServiceError } from '@/lib/storage/enterprise-service';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

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
    const { id } = await context.params;
    const course = await getEnterpriseService().regenerateCourseAssessment(id, {
      aiCall,
      questionCount: body.questionCount,
      languageDirective: body.languageDirective,
    });
    return apiSuccess({ course });
  } catch (error) {
    if (!(error instanceof EnterpriseStorageServiceError)) {
      return llmApiError(error);
    }
    return enterpriseErrorResponse(error);
  }
}
