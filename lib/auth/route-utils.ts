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
    const status =
      error.code === 'INVALID_CREDENTIALS' || error.code === 'USER_DISABLED'
        ? 401
        : error.code === 'TENANT_SUSPENDED' || error.code === 'TENANT_MISMATCH'
          ? 403
          : error.code === 'ADMIN_ROLE_NOT_ALLOWED'
            ? 403
            : error.code === 'USER_NOT_FOUND'
              ? 404
              : 400;
    return apiError('INVALID_REQUEST', status, error.code);
  }
  const message = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Authentication operation failed', message);
}
