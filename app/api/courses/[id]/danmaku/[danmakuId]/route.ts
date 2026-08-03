import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { danmakuErrorResponse, getDanmakuService } from '@/lib/community/danmaku-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';

type RouteContext = { params: Promise<{ id: string; danmakuId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id: courseId, danmakuId } = await context.params;
    const danmaku = await getDanmakuService().deleteOwn({
      id: danmakuId,
      courseId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
    });
    return apiSuccess({ danmaku });
  } catch (error) {
    return danmakuErrorResponse(error);
  }
}
