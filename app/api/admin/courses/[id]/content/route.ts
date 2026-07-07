import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CourseContentBody {
  scenes?: unknown[];
  outlines?: unknown[];
  stage?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const content = await getEnterpriseService().getCourseContent(id);
    if (!content) return apiError('INVALID_REQUEST', 404, 'Course not found');
    return apiSuccess({ content });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<CourseContentBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!Array.isArray(body.scenes) || !Array.isArray(body.outlines)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'scenes and outlines are required arrays');
  }

  try {
    const { id } = await context.params;
    const content = await getEnterpriseService().replaceCourseContent(id, {
      scenes: body.scenes,
      outlines: body.outlines,
      stage: body.stage,
      generationStatus: body.generationStatus,
      generationComplete: body.generationComplete,
    });
    return apiSuccess({ content });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
