import { describe, expect, test } from 'vitest';

import {
  canManageCourses,
  isVisibleToRole,
  type CourseVisibility,
  type SessionIdentity,
} from '@/lib/auth/types';

describe('enterprise auth shared types', () => {
  test('grants course management only to admin identities', () => {
    const admin: SessionIdentity = {
      userId: 'u1',
      roleId: 'r1',
      roleCode: 'admin',
      isAdmin: true,
      authSource: 'host-sso',
    };
    const learner: SessionIdentity = {
      userId: 'u2',
      roleId: 'r2',
      roleCode: 'learner',
      isAdmin: false,
      authSource: 'password',
    };

    expect(canManageCourses(admin)).toBe(true);
    expect(canManageCourses(learner)).toBe(false);
  });

  test('evaluates course visibility by all-or-roles mode', () => {
    const all: CourseVisibility = { mode: 'all', roleIds: [] };
    const roleScoped: CourseVisibility = { mode: 'roles', roleIds: ['role-sales'] };

    expect(isVisibleToRole(all, 'role-any')).toBe(true);
    expect(isVisibleToRole(roleScoped, 'role-sales')).toBe(true);
    expect(isVisibleToRole(roleScoped, 'role-ops')).toBe(false);
  });
});
