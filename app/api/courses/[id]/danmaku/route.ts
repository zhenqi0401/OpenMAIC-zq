import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { danmakuErrorResponse, getDanmakuService } from '@/lib/community/danmaku-route-utils';
import {
  decodeDanmakuCursor,
  parseDanmakuLimit,
  type DanmakuInputSource,
} from '@/lib/community/danmaku';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody, requiredString } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CreateDanmakuBody {
  sceneKey?: unknown;
  actionId?: unknown;
  actionOffsetMs?: unknown;
  content?: unknown;
  inputSource?: unknown;
  authorId?: unknown;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id: courseId } = await context.params;
    const search = new URL(request.url).searchParams;
    const sceneKey = search.get('sceneKey');
    if (!requiredString(sceneKey)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'sceneKey is required');
    }
    const result = await getDanmakuService().listVisible({
      courseId,
      sceneKey: sceneKey.trim(),
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
      after: decodeDanmakuCursor(search.get('cursor')),
      limit: parseDanmakuLimit(search.get('limit')),
    });
    return apiSuccess({ danmaku: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    return danmakuErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  const body = await readJsonBody<CreateDanmakuBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    !requiredString(body.sceneKey) ||
    !requiredString(body.actionId) ||
    !requiredString(body.content) ||
    typeof body.actionOffsetMs !== 'number'
  ) {
    return apiError(
      'MISSING_REQUIRED_FIELD',
      400,
      'sceneKey, actionId, actionOffsetMs and content are required',
    );
  }

  try {
    const { id: courseId } = await context.params;
    const result = await getDanmakuService().create({
      courseId,
      sceneKey: body.sceneKey.trim(),
      actionId: body.actionId.trim(),
      actionOffsetMs: body.actionOffsetMs,
      content: body.content,
      inputSource: body.inputSource as DanmakuInputSource | undefined,
      clientRequestId: request.headers.get('idempotency-key')?.trim() || undefined,
      // The author is deliberately derived from the authenticated session. body.authorId is ignored.
      authorId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
    });
    return apiSuccess(
      { danmaku: result.danmaku, idempotentReplay: !result.created },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return danmakuErrorResponse(error);
  }
}
