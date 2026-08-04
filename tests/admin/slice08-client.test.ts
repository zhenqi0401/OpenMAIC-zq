import { describe, expect, test, vi } from 'vitest';

import {
  AdminClientError,
  buildRoleOptions,
  createAdminClient,
  createUserRoleDrafts,
  getInviteCodeView,
  getRoleLabel,
} from '@/lib/admin/client';
import {
  formatDashboardPercent,
  toDashboardProgressRatio,
} from '@/components/admin/dashboard/DashboardAdminPanel';

const roles = [
  { id: 'role-admin', code: 'admin', name: '管理员', isAdmin: true },
  { id: 'role-sales', code: 'sales', name: '销售', isAdmin: false },
];

describe('Slice-08 admin client helpers', () => {
  test('loads the dashboard through the existing admin API and surfaces failures', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/admin/dashboard') {
        return Response.json({
          summary: {
            courseCompletionRate: 75,
            examPassRate: 60,
            learnerCount: 2,
            activeCourseCount: 3,
            examAttemptCount: 5,
          },
          communityActivity: { totals: {}, points: [] },
          pending: { total: 0, items: [] },
        });
      }
      return new Response('nope', { status: 500 });
    });
    const client = createAdminClient(fetcher);

    await expect(client.getDashboard()).resolves.toMatchObject({
      summary: {
        courseCompletionRate: 75,
        examPassRate: 60,
      },
    });

    fetcher.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    await expect(client.listRoles()).rejects.toBeInstanceOf(AdminClientError);
  });

  test('keeps dashboard, role, invite-code, and user read paths unchanged', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.startsWith('/api/admin/dashboard')) {
        return Response.json({ summary: {}, progress: [] });
      }
      if (url === '/api/admin/roles') return Response.json({ roles: [] });
      if (url === '/api/admin/invite-codes') return Response.json({ inviteCodes: [] });
      if (url === '/api/admin/users') return Response.json({ users: [] });
      return new Response('not found', { status: 404 });
    });
    const client = createAdminClient(fetcher);

    await Promise.all([
      client.getDashboard('week'),
      client.listRoles(),
      client.listInviteCodes(),
      client.listUsers(),
    ]);

    expect(calls).toEqual([
      '/api/admin/dashboard?range=week',
      '/api/admin/roles',
      '/api/admin/invite-codes',
      '/api/admin/users',
    ]);
  });

  test('uses role list options for user role drafts instead of free-form roleId entry', () => {
    const users = [
      {
        id: 'user-1',
        phone: '13800138000',
        hostUserId: null,
        displayName: '张三',
        status: 'active',
        role: roles[1],
      },
    ];

    expect(buildRoleOptions(roles)).toEqual([
      { value: 'role-admin', label: '管理员 (admin) · 管理员', isAdmin: true },
      { value: 'role-sales', label: '销售 (sales) · 普通角色', isAdmin: false },
    ]);
    expect(createUserRoleDrafts(users)).toEqual({ 'user-1': 'role-sales' });
    expect(getRoleLabel('role-sales', roles)).toBe('销售 (sales) · 普通角色');
    expect(getRoleLabel('missing-role', roles)).toBe('missing-role');
  });

  test('maps invite code rows without requiring cleartext code storage', () => {
    expect(
      getInviteCodeView(
        {
          id: 'invite-1',
          roleId: 'role-sales',
          enabled: true,
          expiresAt: '2026-08-01T00:00:00.000Z',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        roles,
        new Date('2026-07-02T00:00:00.000Z'),
      ),
    ).toMatchObject({
      id: 'invite-1',
      status: 'active',
      roleLabel: '销售 (sales) · 普通角色',
      cleartextCode: null,
    });

    expect(
      getInviteCodeView(
        {
          id: 'invite-2',
          roleId: 'role-sales',
          enabled: false,
          expiresAt: null,
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        roles,
        new Date('2026-07-02T00:00:00.000Z'),
      ).status,
    ).toBe('disabled');

    expect(
      getInviteCodeView(
        {
          id: 'invite-3',
          roleId: 'role-sales',
          enabled: true,
          expiresAt: '2026-07-01T00:00:00.000Z',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        roles,
        new Date('2026-07-02T00:00:00.000Z'),
      ).status,
    ).toBe('expired');
  });

  test('writes roles, invite codes, and user role changes to existing Slice-01 endpoints', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json({});
    });
    const client = createAdminClient(fetcher);

    await client.createRole({ code: 'ops', name: '运营', isAdmin: false });
    await client.updateRole('role-sales', { name: '销售顾问', isAdmin: false });
    await client.createInviteCode({
      code: 'SALES-2026',
      roleId: 'role-sales',
      enabled: true,
      expiresAt: '2026-08-01T00:00',
    });
    await client.updateInviteCode('invite-1', {
      roleId: 'role-sales',
      enabled: false,
      expiresAt: null,
    });
    await client.updateUserRole('user-1', 'role-sales');
    await client.deleteRole('role-sales');
    await client.deleteInviteCode('invite-1');
    await client.deleteUser('user-1');

    expect(calls.map((call) => [call.url, call.init?.method])).toEqual([
      ['/api/admin/roles', 'POST'],
      ['/api/admin/roles/role-sales', 'PATCH'],
      ['/api/admin/invite-codes', 'POST'],
      ['/api/admin/invite-codes/invite-1', 'PATCH'],
      ['/api/admin/users/user-1/role', 'PATCH'],
      ['/api/admin/roles/role-sales', 'DELETE'],
      ['/api/admin/invite-codes/invite-1', 'DELETE'],
      ['/api/admin/users/user-1', 'DELETE'],
    ]);
  });

  test('formats dashboard rates as 0-100 integer percents', () => {
    expect(formatDashboardPercent(100)).toBe('100%');
    expect(formatDashboardPercent(33)).toBe('33%');
  });

  test('clamps dashboard rate display and progress bars defensively', () => {
    expect(formatDashboardPercent(125)).toBe('100%');
    expect(formatDashboardPercent(-10)).toBe('0%');
    expect(toDashboardProgressRatio(125)).toBe(1);
    expect(toDashboardProgressRatio(-10)).toBe(0);
    expect(toDashboardProgressRatio(75)).toBe(0.75);
  });
});
