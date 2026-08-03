import { apiError } from '@/lib/server/api-response';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';
import { getEnterpriseService } from '@/lib/storage/enterprise-route-utils';
import { getAdminDataRepository } from '@/lib/admin/admin-data-repository';
import { AdminManagementError, createAdminManagementService } from '@/lib/admin/admin-management';
import { AdminQueryError } from '@/lib/admin/admin-query';
import type { TenantAccessContext } from '@/lib/auth/types';

export function getAdminManagementService(access?: TenantAccessContext) {
  return createAdminManagementService({
    repository: getAdminDataRepository(access?.tenantId),
    enterprise: getEnterpriseService(access),
    flags: () => ({ forum: isForumEnabled(), danmaku: isDanmakuEnabled() }),
  });
}

export function adminManagementErrorResponse(error: unknown) {
  if (error instanceof AdminQueryError) {
    return apiError('INVALID_REQUEST', 400, error.message);
  }
  if (error instanceof AdminManagementError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
    return apiError('INVALID_REQUEST', status, error.message);
  }
  const details = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Admin management operation failed', details);
}
