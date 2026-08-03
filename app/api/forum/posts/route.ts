import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { forumErrorResponse, getForumService } from '@/lib/community/forum-route-utils';
import { parseForumPagination, type ForumScope, type ForumSort } from '@/lib/community/forum';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readJsonBody, requiredString } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface CreatePostBody {
  scope?: unknown;
  courseId?: unknown;
  title?: unknown;
  body?: unknown;
  authorId?: unknown;
}

export async function GET(request: Request) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const search = new URL(request.url).searchParams;
    const scope = search.get('scope');
    const sort = search.get('sort') ?? 'latest';
    if (scope && scope !== 'global' && scope !== 'course') {
      return apiError('INVALID_REQUEST', 400, 'scope must be global or course');
    }
    if (sort !== 'latest' && sort !== 'activity') {
      return apiError('INVALID_REQUEST', 400, 'sort must be latest or activity');
    }
    const pagination = parseForumPagination(search);
    const result = await getForumService().listPosts({
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
      authorId: search.get('mine') === 'true' ? current.user.id : undefined,
      scope: (scope as ForumScope | null) ?? undefined,
      courseId: search.get('courseId') || undefined,
      sort: sort as ForumSort,
      ...pagination,
    });
    return apiSuccess({ ...result, ...pagination });
  } catch (error) {
    return forumErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  const body = await readJsonBody<CreatePostBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    (body.scope !== 'global' && body.scope !== 'course') ||
    !requiredString(body.title) ||
    !requiredString(body.body)
  ) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'scope, title and body are required');
  }
  if (body.courseId !== undefined && body.courseId !== null && typeof body.courseId !== 'string') {
    return apiError('INVALID_REQUEST', 400, 'courseId must be a string');
  }

  try {
    const post = await getForumService().createPost({
      authorId: current.user.id,
      roleId: current.identity.roleId,
      tenantId: current.identity.tenantId,
      scope: body.scope,
      courseId: body.courseId as string | null | undefined,
      title: body.title,
      body: body.body,
    });
    return apiSuccess({ post }, 201);
  } catch (error) {
    return forumErrorResponse(error);
  }
}
