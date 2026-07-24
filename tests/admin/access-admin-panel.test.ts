import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAccessSectionUrl,
  loadAccessAdminData,
  resolveAccessSection,
} from '@/components/admin/access/AccessAdminPanel';
import { getRoleUsageCounts } from '@/components/admin/access/AccessRolesTab';
import { AccessInvitesTab } from '@/components/admin/access/AccessInvitesTab';

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

  it('shows cleartext only from the current-page map and keeps exactly six desktop columns', () => {
    const roles = [{ id: 'role-learner', code: 'learner', name: '学员', isAdmin: false }];
    const inviteCodes = [
      {
        id: 'invite-current',
        roleId: 'role-learner',
        enabled: true,
        createdAt: '2026-07-23T08:09:10.000Z',
        expiresAt: null,
      },
      {
        id: 'invite-history',
        roleId: 'role-learner',
        enabled: false,
        createdAt: '2026-07-22T08:09:10.000Z',
        expiresAt: '2026-08-22T08:09:10.000Z',
      },
    ];
    const props: React.ComponentProps<typeof AccessInvitesTab> = {
      cleartextInviteCodes: { 'invite-current': 'OPEN-CODE-2026' },
      creatingInvite: false,
      deletingInviteCodeId: null,
      inviteCodes,
      loading: false,
      onCreateInvite: async () => true,
      onDeleteInvite: () => undefined,
      onSaveInvite: async () => true,
      roleOptions: [{ value: 'role-learner', label: '学员 (learner)', isAdmin: false }],
      roles,
      savingInviteCodeId: null,
    };
    const markup = renderToStaticMarkup(React.createElement(AccessInvitesTab, props));
    const headers = [...markup.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map((match) => match[1]);

    expect(headers).toEqual(['邀请码', '绑定角色', '创建时间', '过期时间', '状态', '操作']);
    expect(markup).toContain('OPEN-CODE-2026');
    expect(markup).toContain('复制邀请码 OPEN-CODE-2026');
    expect(markup).toContain('仅创建时可见');
    expect(markup).toContain('长期有效');
    expect(markup).toContain('有效');
    expect(markup).toContain('已停用');
    expect(markup).not.toContain('>启用</th>');

    const refreshedMarkup = renderToStaticMarkup(
      React.createElement(AccessInvitesTab, { ...props, cleartextInviteCodes: {} }),
    );
    expect(refreshedMarkup).not.toContain('OPEN-CODE-2026');
    expect(refreshedMarkup.match(/仅创建时可见/g)?.length).toBeGreaterThanOrEqual(2);

    const panelSource = readFileSync('components/admin/access/AccessAdminPanel.tsx', 'utf8');
    expect(panelSource).toContain('[result.inviteCode.id]: cleartextCode');
    expect(panelSource).toContain('normalizeInviteCode(draft.code)');
  });
});
