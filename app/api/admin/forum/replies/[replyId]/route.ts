import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody } from '@/lib/storage/enterprise-route-utils';

type Context = { params: Promise<{ replyId: string }> };
interface ModerateBody {
  action?: unknown;
  reason?: unknown;
}

export async function PATCH(request: Request, context: Context) {
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
    const { replyId } = await context.params;
    const reply = await getForumService().moderateReply({
      id: replyId,
      action: body.action,
      adminId: admin.user.id,
      reason: body.reason,
    });
    return apiSuccess({ reply });
  } catch (error) {
    return forumErrorResponse(error);
  }
}
