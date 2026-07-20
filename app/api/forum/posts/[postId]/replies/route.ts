import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { parseForumPagination } from '@/lib/community/forum';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody, requiredString } from '@/lib/storage/enterprise-route-utils';

type Context = { params: Promise<{ postId: string }> };
interface CreateReplyBody {
  body?: unknown;
  authorId?: unknown;
  parentReplyId?: unknown;
}

export async function GET(request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  try {
    const { postId } = await context.params;
    const pagination = parseForumPagination(new URL(request.url).searchParams);
    const result = await getForumService().listReplies({
      postId,
      roleId: current.identity.roleId,
      ...pagination,
    });
    return apiSuccess({ ...result, ...pagination });
  } catch (error) {
    return forumErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  const body = await readJsonBody<CreateReplyBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.body)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'body is required');
  }
  if (
    body.parentReplyId !== undefined &&
    body.parentReplyId !== null &&
    !requiredString(body.parentReplyId)
  ) {
    return apiError('INVALID_REQUEST', 400, 'parentReplyId must be a non-empty string or null');
  }
  try {
    const { postId } = await context.params;
    const reply = await getForumService().createReply({
      postId,
      authorId: current.user.id,
      roleId: current.identity.roleId,
      body: body.body,
      parentReplyId: typeof body.parentReplyId === 'string' ? body.parentReplyId.trim() : null,
    });
    return apiSuccess({ reply }, 201);
  } catch (error) {
    return forumErrorResponse(error);
  }
}
