import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody, requiredString } from '@/lib/storage/enterprise-route-utils';

type Context = { params: Promise<{ postId: string }> };
interface UpdatePostBody {
  title?: unknown;
  body?: unknown;
  authorId?: unknown;
}

export async function GET(_request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  try {
    const { postId } = await context.params;
    const post = await getForumService().getPost({
      id: postId,
      viewerId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
    });
    return apiSuccess({ post });
  } catch (error) {
    return forumErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  const body = await readJsonBody<UpdatePostBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.title) || !requiredString(body.body)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'title and body are required');
  }
  try {
    const { postId } = await context.params;
    const post = await getForumService().updateOwnPost({
      id: postId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
      title: body.title,
      body: body.body,
    });
    return apiSuccess({ post });
  } catch (error) {
    return forumErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  try {
    const { postId } = await context.params;
    const post = await getForumService().deleteOwnPost({
      id: postId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
    });
    return apiSuccess({ post });
  } catch (error) {
    return forumErrorResponse(error);
  }
}
