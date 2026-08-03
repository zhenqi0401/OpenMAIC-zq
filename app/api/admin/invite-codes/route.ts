import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  parseDate,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface InviteCodeBody {
  code?: string;
  roleId?: string;
  enabled?: boolean;
  expiresAt?: string | null;
}

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const inviteCodes = await getEnterpriseService().listInviteCodes(
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ inviteCodes });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<InviteCodeBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.code) || !requiredString(body.roleId)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'code and roleId are required');
  }

  const expiresAt = parseDate(body.expiresAt);
  if (expiresAt === undefined && body.expiresAt !== undefined) {
    return apiError('INVALID_REQUEST', 400, 'expiresAt must be an ISO date or null');
  }

  try {
    const inviteCode = await getEnterpriseService().createInviteCode(
      {
        code: body.code.trim(),
        roleId: body.roleId,
        enabled: body.enabled,
        expiresAt,
        createdBy: admin.user.id,
      },
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ inviteCode }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
