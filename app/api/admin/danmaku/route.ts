import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { danmakuErrorResponse, getDanmakuService } from '@/lib/community/danmaku-route-utils';
import {
  decodeDanmakuCursor,
  encodeDanmakuCursor,
  parseDanmakuLimit,
  type DanmakuStatus,
} from '@/lib/community/danmaku';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export const dynamic = 'force-dynamic';

const STATUSES = new Set<DanmakuStatus>([
  'visible',
  'hidden',
  'deleted_by_author',
  'deleted_by_admin',
]);

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  try {
    const search = new URL(request.url).searchParams;
    const status = search.get('status');
    if (status && !STATUSES.has(status as DanmakuStatus)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid danmaku status');
    }
    const limit = parseDanmakuLimit(search.get('limit'));
    const rows = await getDanmakuService().listAdmin({
      courseId: search.get('courseId') || undefined,
      sceneKey: search.get('sceneKey') || undefined,
      authorId: search.get('authorId') || undefined,
      status: (status as DanmakuStatus | null) ?? undefined,
      after: decodeDanmakuCursor(search.get('cursor')),
      limit,
    });
    return apiSuccess({
      danmaku: rows,
      nextCursor: rows.length === limit ? encodeDanmakuCursor(rows[rows.length - 1]) : null,
    });
  } catch (error) {
    return danmakuErrorResponse(error);
  }
}
