import { describe, expect, it, vi } from 'vitest';
import {
  buildAccessSectionUrl,
  loadAccessAdminData,
  resolveAccessSection,
} from '@/components/admin/access/AccessAdminPanel';
import { getRoleUsageCounts } from '@/components/admin/access/AccessRolesTab';
import { maskAdminPhone } from '@/components/admin/access/AccessUsersTab';

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

  it('parses access sections defensively and defaults to the users tab', () => {
    expect(resolveAccessSection(undefined)).toBe('users');
    expect(resolveAccessSection(null)).toBe('users');
    expect(resolveAccessSection('users')).toBe('users');
    expect(resolveAccessSection('roles')).toBe('roles');
    expect(resolveAccessSection('invites')).toBe('invites');
    expect(resolveAccessSection('unknown')).toBe('users');
    expect(buildAccessSectionUrl('?module=access&source=test', 'roles')).toBe(
      '/admin?module=access&source=test&section=roles',
    );
  });

  it('masks user phone numbers before rendering them', () => {
    expect(maskAdminPhone('13800138000')).toBe('138****8000');
    expect(maskAdminPhone('1234567')).toBe('12***67');
    expect(maskAdminPhone(null)).toBe('-');
  });

  it('calculates current user and invite-code counts for each loaded role', () => {
    const roles = [
      { id: 'role-admin', code: 'admin', name: '管理员', isAdmin: true },
      { id: 'role-learner', code: 'learner', name: '学员', isAdmin: false },
    ];
    const users = [
      {
        id: 'user-1',
        phone: '13800138000',
        hostUserId: null,
        displayName: '张三',
        status: 'active',
        role: roles[1],
      },
      {
        id: 'user-2',
        phone: null,
        hostUserId: 'host-2',
        displayName: '李四',
        status: 'active',
        role: roles[1],
      },
    ];
    const inviteCodes = [
      {
        id: 'invite-1',
        roleId: 'role-learner',
        enabled: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        expiresAt: null,
      },
      {
        id: 'invite-2',
        roleId: 'role-admin',
        enabled: false,
        createdAt: '2026-07-02T00:00:00.000Z',
        expiresAt: null,
      },
    ];

    expect(getRoleUsageCounts(roles, users, inviteCodes)).toEqual({
      'role-admin': { userCount: 0, inviteCount: 1 },
      'role-learner': { userCount: 2, inviteCount: 1 },
    });
  });
});
