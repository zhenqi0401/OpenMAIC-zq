import { describe, expect, it } from 'vitest';
import { getAdminSlice08LoadPlan } from '@/components/admin/AdminSlice08Panel';

describe('getAdminSlice08LoadPlan', () => {
  it('does not load dashboard data for the access-only view', () => {
    expect(getAdminSlice08LoadPlan('access')).toEqual({
      dashboard: false,
      roles: true,
      inviteCodes: true,
      users: true,
    });
  });

  it('loads dashboard dependencies for dashboard and combined views', () => {
    expect(getAdminSlice08LoadPlan('dashboard').dashboard).toBe(true);
    expect(getAdminSlice08LoadPlan('all').dashboard).toBe(true);
  });
});
