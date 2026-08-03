import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
} from '@/lib/storage/enterprise-route-utils';
import type { EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';

export const dynamic = 'force-dynamic';

interface ExamPolicyPatchBody {
  title?: string;
  targetRoleId?: string;
  categoryIds?: string[];
  courseIds?: string[];
  questionCount?: number;
  passThreshold?: number;
  timeLimitMinutes?: number | null;
  status?: EnterpriseExamPolicy['status'];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<ExamPolicyPatchBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');

  try {
    const { id } = await context.params;
    const examPolicy = await getEnterpriseService(
      toTenantAccessContext(admin.identity),
    ).updateExamPolicy(id, body);
    return apiSuccess({ examPolicy });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const { id } = await context.params;
    const examPolicy = await getEnterpriseService(
      toTenantAccessContext(admin.identity),
    ).deleteExamPolicy(id);
    return apiSuccess({ examPolicy });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
