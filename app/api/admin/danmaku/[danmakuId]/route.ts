import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { danmakuErrorResponse, getDanmakuService } from '@/lib/community/danmaku-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody } from '@/lib/storage/enterprise-route-utils';

interface ModerateBody {
  action?: unknown;
  reason?: unknown;
}

type RouteContext = { params: Promise<{ danmakuId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<ModerateBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (body.action !== 'hide' && body.action !== 'restore' && body.action !== 'delete') {
    return apiError('INVALID_REQUEST', 400, 'action must be hide, restore or delete');
  }
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return apiError('INVALID_REQUEST', 400, 'reason must be a string');
  }

  try {
    const { danmakuId } = await context.params;
    const danmaku = await getDanmakuService().moderate({
      id: danmakuId,
      action: body.action,
      adminId: admin.user.id,
      reason: body.reason,
    });
    return apiSuccess({ danmaku });
  } catch (error) {
    return danmakuErrorResponse(error);
  }
}
