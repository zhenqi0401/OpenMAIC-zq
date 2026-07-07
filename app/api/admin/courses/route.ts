import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CourseBody {
  name?: string;
  description?: string | null;
  categoryId?: string;
  assessmentQuestions?: unknown[];
  stageSnapshot?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
}

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const courses = await getEnterpriseService().listAdminCourses();
    return apiSuccess({ courses });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<CourseBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.name) || !requiredString(body.categoryId)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'name and categoryId are required');
  }

  try {
    const course = await getEnterpriseService().createCourse({
      name: body.name.trim(),
      description: body.description ?? null,
      categoryId: body.categoryId,
      assessmentQuestions: body.assessmentQuestions,
      stageSnapshot: body.stageSnapshot,
      generationStatus: body.generationStatus,
      generationComplete: body.generationComplete,
      createdBy: admin.user.id,
    });
    return apiSuccess({ course }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
