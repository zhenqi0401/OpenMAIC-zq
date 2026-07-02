import type { SessionIdentity } from './types';
import { verifySessionToken } from '@/lib/security/session-token';

export function resolveSessionIdentity(
  token: string | undefined,
  sessionSecret: string,
): SessionIdentity | null {
  if (!token) return null;
  const verification = verifySessionToken(token, sessionSecret);
  return verification.valid ? verification.identity : null;
}

export function requireSessionIdentity(
  token: string | undefined,
  sessionSecret: string,
): SessionIdentity {
  const identity = resolveSessionIdentity(token, sessionSecret);
  if (!identity) {
    throw new Error('OpenMAIC session required');
  }
  return identity;
}

export function requireAdminIdentity(identity: SessionIdentity): SessionIdentity {
  if (!identity.isAdmin) {
    throw new Error('Administrator permission required');
  }
  return identity;
}
