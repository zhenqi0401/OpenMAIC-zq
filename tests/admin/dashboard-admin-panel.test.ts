import { describe, expect, it, vi } from 'vitest';
import { loadDashboardAdminData } from '@/components/admin/dashboard/DashboardAdminPanel';

describe('DashboardAdminPanel data loading', () => {
  it('loads dashboard, roles, invite codes, and users together', async () => {
    const dashboard = {
      summary: {
        courseCompletionRate: 75,
        assessmentPassRate: 80,
        examPassRate: 60,
        learnerCount: 2,
        courseCount: 3,
        assessmentAttemptCount: 4,
        examAttemptCount: 5,
      },
      progress: [],
    };
    const client = {
      getDashboard: vi.fn(async () => dashboard),
      listRoles: vi.fn(async () => []),
      listInviteCodes: vi.fn(async () => []),
      listUsers: vi.fn(async () => []),
    };

    await expect(loadDashboardAdminData(client)).resolves.toEqual({
      dashboard,
      roles: [],
      inviteCodes: [],
      users: [],
    });
    expect(client.getDashboard).toHaveBeenCalledOnce();
    expect(client.listRoles).toHaveBeenCalledOnce();
    expect(client.listInviteCodes).toHaveBeenCalledOnce();
    expect(client.listUsers).toHaveBeenCalledOnce();
  });
});
