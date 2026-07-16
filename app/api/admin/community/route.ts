import { requireCurrentAdmin } from '@/lib/auth/current-session';
import {
  getCommunityAdminRepository,
  parseCommunityAdminFilters,
} from '@/lib/community/community-admin';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  let filters;
  try {
    filters = parseCommunityAdminFilters(new URL(request.url).searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid community filters';
    return apiError('INVALID_REQUEST', 400, message);
  }

  if (
    (!isDanmakuEnabled() && filters.type === 'danmaku') ||
    (!isForumEnabled() && (filters.type === 'posts' || filters.type === 'replies')) ||
    (!isDanmakuEnabled() && !isForumEnabled())
  ) {
    return apiError('INVALID_REQUEST', 404, 'Community feature is disabled');
  }

  try {
    const result = await getCommunityAdminRepository().list(filters);
    return apiSuccess({ ...result, page: filters.page, pageSize: filters.pageSize });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 500, 'Community management query failed', details);
  }
}
