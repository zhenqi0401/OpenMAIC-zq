import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody, requiredString } from '@/lib/storage/enterprise-route-utils';

type Context = { params: Promise<{ replyId: string }> };
interface UpdateReplyBody {
  body?: unknown;
  authorId?: unknown;
}

export async function PATCH(request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  const body = await readJsonBody<UpdateReplyBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.body))
    return apiError('MISSING_REQUIRED_FIELD', 400, 'body is required');
  try {
    const { replyId } = await context.params;
    const reply = await getForumService().updateOwnReply({
      id: replyId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
      body: body.body,
    });
    return apiSuccess({ reply });
  } catch (error) {
    return forumErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  try {
    const { replyId } = await context.params;
    const reply = await getForumService().deleteOwnReply({
      id: replyId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
    });
    return apiSuccess({ reply });
  } catch (error) {
    return forumErrorResponse(error);
  }
}
