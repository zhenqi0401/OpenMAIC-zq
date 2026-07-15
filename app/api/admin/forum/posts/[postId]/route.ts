import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody } from '@/lib/storage/enterprise-route-utils';

type Context = { params: Promise<{ postId: string }> };
interface ModerateBody {
  action?: unknown;
  reason?: unknown;
}

const ACTIONS = new Set(['hide', 'restore', 'delete', 'pin', 'unpin', 'lock', 'unlock']);

export async function PATCH(request: Request, context: Context) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;
  const body = await readJsonBody<ModerateBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (typeof body.action !== 'string' || !ACTIONS.has(body.action)) {
    return apiError('INVALID_REQUEST', 400, 'Invalid forum post action');
  }
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return apiError('INVALID_REQUEST', 400, 'reason must be a string');
  }
  try {
    const { postId } = await context.params;
    const post = await getForumService().moderatePost({
      id: postId,
      action: body.action as 'hide' | 'restore' | 'delete' | 'pin' | 'unpin' | 'lock' | 'unlock',
      adminId: admin.user.id,
      reason: body.reason,
    });
    return apiSuccess({ post });
  } catch (error) {
    return forumErrorResponse(error);
  }
}
