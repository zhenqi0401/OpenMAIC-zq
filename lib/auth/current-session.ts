import { apiError } from '@/lib/server/api-response';
import { requireAdminIdentity } from './session-guard';
import { getAuthRepository } from './repository';
import { createAuthService, type AuthResult } from './service';
import { getSessionSecret, readSessionCookie } from './session-cookie';
import { resolveSessionIdentity } from './session-guard';

export async function getCurrentAuthResult(): Promise<AuthResult | null> {
  const token = await readSessionCookie();
  const identity = resolveSessionIdentity(token, getSessionSecret());
  if (!identity) return null;
  return createAuthService(getAuthRepository()).getSessionUser(identity.userId);
}

export async function requireCurrentAdmin(): Promise<AuthResult | Response> {
  const current = await getCurrentAuthResult();
  if (!current) {
    return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');
  }
  try {
    requireAdminIdentity(current.identity);
  } catch {
    return apiError('INVALID_REQUEST', 403, 'Administrator permission required');
  }
  return current;
}
