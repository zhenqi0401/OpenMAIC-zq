import { describe, expect, test } from 'vitest';

import { getAuthRedirect, shouldShowAdminEntry } from '@/lib/auth/route-policy';
import type { SessionIdentity } from '@/lib/auth/types';

const admin: SessionIdentity = {
  userId: 'admin-1',
  roleId: 'role-admin',
  roleCode: 'admin',
  isAdmin: true,
  authSource: 'host-sso',
};

const learner: SessionIdentity = {
  userId: 'learner-1',
  roleId: 'role-learner',
  roleCode: 'learner',
  isAdmin: false,
  authSource: 'password',
};

describe('Slice-07 auth route policy', () => {
  test('lets anonymous users reach login and register, but redirects protected pages', () => {
    expect(getAuthRedirect('/login', null)).toBeNull();
    expect(getAuthRedirect('/register', null)).toBeNull();
    expect(getAuthRedirect('/', null)).toBe('/login');
    expect(getAuthRedirect('/admin', null)).toBe('/login');
  });

  test('keeps learners out of admin pages and sends signed-in users away from auth pages', () => {
    expect(getAuthRedirect('/login', learner)).toBe('/');
    expect(getAuthRedirect('/register', learner)).toBe('/');
    expect(getAuthRedirect('/admin', learner)).toBe('/');
    expect(getAuthRedirect('/admin', admin)).toBeNull();
    expect(getAuthRedirect('/generation-preview', learner)).toBe('/');
    expect(getAuthRedirect('/generation-preview', admin)).toBeNull();
  });

  test('shows the admin entry only to admin identities', () => {
    expect(shouldShowAdminEntry(admin)).toBe(true);
    expect(shouldShowAdminEntry(learner)).toBe(false);
    expect(shouldShowAdminEntry(null)).toBe(false);
  });
});
