import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';
import {
  adminManagementErrorResponse,
  getAdminManagementService,
} from '@/lib/admin/admin-management-route';
import { parseAdminEnum, parseAdminPagination, parseAdminText } from '@/lib/admin/admin-query';

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

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const search = new URL(request.url).searchParams;
    const { page, pageSize } = parseAdminPagination(search, {
      defaultPageSize: 12,
      maxPageSize: 100,
    });
    const result = await getAdminManagementService().queryCourses({
      q: parseAdminText(search, 'q'),
      status: parseAdminEnum(
        search,
        'status',
        ['all', 'draft', 'published', 'archived', 'review'] as const,
        'all',
      ),
      categoryId: parseAdminText(search, 'categoryId'),
      visibilityMode: parseAdminEnum(
        search,
        'visibilityMode',
        ['any', 'all', 'roles'] as const,
        'any',
      ),
      page,
      pageSize,
      sort: parseAdminEnum(search, 'sort', ['updatedAt:desc'] as const, 'updatedAt:desc'),
    });
    return apiSuccess(result);
  } catch (error) {
    return adminManagementErrorResponse(error);
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
