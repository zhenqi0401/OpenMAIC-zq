import { describe, expect, test, vi } from 'vitest';

import { createSessionToken, verifySessionToken } from '@/lib/security/session-token';
import type { SessionIdentity } from '@/lib/auth/types';

const identity: SessionIdentity = {
  userId: 'user-1',
  roleId: 'role-admin',
  roleCode: 'admin',
  isAdmin: true,
  authSource: 'password',
};

describe('enterprise session token', () => {
  test('round-trips a signed SessionIdentity payload', () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));

    const token = createSessionToken(identity, 'secret-1', { expiresInSeconds: 60 });
    const verified = verifySessionToken(token, 'secret-1');

    expect(verified.valid).toBe(true);
    expect(verified.identity).toMatchObject(identity);
    expect(verified.expiresAt).toBe(Math.floor(Date.now() / 1000) + 60);

    vi.useRealTimers();
  });

  test('rejects tokens signed with a different secret', () => {
    const token = createSessionToken(identity, 'secret-1');

    expect(verifySessionToken(token, 'secret-2')).toEqual({
      valid: false,
      reason: 'bad-signature',
    });
  });

  test('rejects expired tokens', () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
    const token = createSessionToken(identity, 'secret-1', { expiresInSeconds: 1 });

    vi.setSystemTime(new Date('2026-07-01T00:00:02Z'));

    expect(verifySessionToken(token, 'secret-1')).toEqual({ valid: false, reason: 'expired' });

    vi.useRealTimers();
  });
});
