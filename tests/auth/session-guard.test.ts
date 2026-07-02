import { describe, expect, test, vi } from 'vitest';

import type { SessionIdentity } from '@/lib/auth/types';
import {
  resolveSessionIdentity,
  requireAdminIdentity,
  requireSessionIdentity,
} from '@/lib/auth/session-guard';
import { createSessionToken } from '@/lib/security/session-token';

const admin: SessionIdentity = {
  userId: 'admin-1',
  roleId: 'role-admin',
  roleCode: 'admin',
  isAdmin: true,
  authSource: 'password',
};

const learner: SessionIdentity = {
  userId: 'learner-1',
  roleId: 'role-learner',
  roleCode: 'learner',
  isAdmin: false,
  authSource: 'password',
};

describe('enterprise session guard', () => {
  test('resolves a signed session cookie into the current user identity', () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
    const token = createSessionToken(admin, 'session-secret');

    expect(resolveSessionIdentity(token, 'session-secret')).toMatchObject(admin);

    vi.useRealTimers();
  });

  test('requires a valid session before returning identity', () => {
    expect(() => requireSessionIdentity(undefined, 'session-secret')).toThrow(
      'OpenMAIC session required',
    );
    expect(() => requireSessionIdentity('bad-token', 'session-secret')).toThrow(
      'OpenMAIC session required',
    );
  });

  test('requires administrator permission for admin APIs', () => {
    expect(requireAdminIdentity(admin)).toBe(admin);
    expect(() => requireAdminIdentity(learner)).toThrow('Administrator permission required');
  });
});
