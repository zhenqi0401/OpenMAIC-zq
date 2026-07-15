import { apiError } from '@/lib/server/api-response';
import { getEnterpriseRepository } from '@/lib/storage/enterprise-repository';
import { ForumServiceError, createForumService } from './forum';
import { getForumRepository } from './forum-repository';
import { getCommunityRateLimiter } from './governance';

export function getForumService() {
  return createForumService(
    getForumRepository(),
    getEnterpriseRepository(),
    getCommunityRateLimiter(),
  );
}

export function forumErrorResponse(error: unknown) {
  if (error instanceof ForumServiceError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'RATE_LIMITED'
            ? 429
            : error.code === 'CONFLICT'
              ? 409
              : 400;
    return apiError(
      error.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'INVALID_REQUEST',
      status,
      error.message,
    );
  }
  const details = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Forum operation failed', details);
}
