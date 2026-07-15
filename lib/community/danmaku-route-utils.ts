import { apiError } from '@/lib/server/api-response';
import { getEnterpriseRepository } from '@/lib/storage/enterprise-repository';
import { getDanmakuRepository } from './danmaku-repository';
import { createDanmakuService, DanmakuServiceError } from './danmaku';
import { getCommunityRateLimiter } from './governance';

export function getDanmakuService() {
  return createDanmakuService(
    getDanmakuRepository(),
    getEnterpriseRepository(),
    undefined,
    getCommunityRateLimiter(),
  );
}

export function danmakuErrorResponse(error: unknown) {
  if (error instanceof DanmakuServiceError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'CONFLICT'
            ? 409
            : error.code === 'RATE_LIMITED'
              ? 429
              : 400;
    return apiError(
      error.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'INVALID_REQUEST',
      status,
      error.message,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Danmaku operation failed', message);
}
