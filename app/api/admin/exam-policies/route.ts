import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
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

interface ExamPolicyBody {
  title?: string;
  targetRoleId?: string;
  categoryIds?: string[];
  courseIds?: string[];
  questionCount?: number;
  passThreshold?: number;
  timeLimitMinutes?: number | null;
}

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const search = new URL(request.url).searchParams;
    const { page, pageSize } = parseAdminPagination(search, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });
    const result = await getAdminManagementService(
      toTenantAccessContext(admin.identity),
    ).queryExamPolicies({
      q: parseAdminText(search, 'q'),
      status: parseAdminEnum(
        search,
        'status',
        ['all', 'draft', 'published', 'archived'] as const,
        'all',
      ),
      targetRoleId: parseAdminText(search, 'targetRoleId'),
      page,
      pageSize,
    });
    return apiSuccess(result);
  } catch (error) {
    return adminManagementErrorResponse(error);
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
    const examPolicy = await getEnterpriseService(
      toTenantAccessContext(admin.identity),
    ).createExamPolicy({
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
