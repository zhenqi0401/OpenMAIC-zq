import { apiError } from '@/lib/server/api-response';
import { AuthServiceError } from './service';

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    const publicMessage: Partial<Record<typeof error.code, string>> = {
      SELF_ADMIN_DEMOTION: '管理员不能取消当前登录账号的管理员权限',
      LAST_ACTIVE_ADMIN: '不能取消最后一名有效管理员',
      DISABLED_ADMIN_PROMOTION: '请先恢复已冻结账号，再提升为管理员',
      ADMIN_USER_DELETE_NOT_ALLOWED: '管理员账号必须先取消管理员权限，才能永久删除',
    };
    const status =
      error.code === 'INVALID_CREDENTIALS' || error.code === 'USER_DISABLED'
        ? 401
        : error.code === 'TENANT_SUSPENDED' || error.code === 'TENANT_MISMATCH'
          ? 403
          : error.code === 'ADMIN_ROLE_NOT_ALLOWED'
            ? 403
            : error.code === 'SELF_ADMIN_DEMOTION' ||
                error.code === 'LAST_ACTIVE_ADMIN' ||
                error.code === 'DISABLED_ADMIN_PROMOTION' ||
                error.code === 'ADMIN_USER_DELETE_NOT_ALLOWED'
              ? 409
              : error.code === 'USER_NOT_FOUND' || error.code === 'ROLE_NOT_FOUND'
                ? 404
                : 400;
    return apiError('INVALID_REQUEST', status, publicMessage[error.code] ?? error.code);
  }
  const message = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Authentication operation failed', message);
}
