import { describe, expect, it, vi } from 'vitest';
import { loadAccessAdminData } from '@/components/admin/access/AccessAdminPanel';

describe('AccessAdminPanel data loading', () => {
  it('loads roles, invite codes, and users without loading the dashboard', async () => {
    const client = {
      getDashboard: vi.fn(),
      listRoles: vi.fn(async () => []),
      listInviteCodes: vi.fn(async () => []),
      listUsers: vi.fn(async () => []),
    };

    await expect(loadAccessAdminData(client)).resolves.toEqual({
      roles: [],
      inviteCodes: [],
      users: [],
    });
    expect(client.getDashboard).not.toHaveBeenCalled();
    expect(client.listRoles).toHaveBeenCalledOnce();
    expect(client.listInviteCodes).toHaveBeenCalledOnce();
    expect(client.listUsers).toHaveBeenCalledOnce();
  });
});
