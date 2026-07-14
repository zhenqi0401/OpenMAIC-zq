import { describe, expect, test, vi } from 'vitest';

import {
  AuthServiceError,
  createAuthService,
  hashInviteCode,
  verifyHostSsoSignature,
  type AuthRepository,
} from '@/lib/auth/service';
import type { AuthRole, AuthUser } from '@/lib/auth/service';
import { verifyPassword } from '@/lib/security/password';

const adminRole: AuthRole = {
  id: 'role-admin',
  code: 'admin',
  name: 'Administrator',
  isAdmin: true,
};

const learnerRole: AuthRole = {
  id: 'role-learner',
  code: 'learner',
  name: 'Learner',
  isAdmin: false,
};

function makeRepo(): AuthRepository & {
  users: AuthUser[];
  roles: AuthRole[];
  inviteCodes: Array<{
    codeHash: string;
    roleId: string;
    enabled: boolean;
    expiresAt: Date | null;
  }>;
} {
  const repo = {
    users: [] as AuthUser[],
    roles: [adminRole, learnerRole],
    inviteCodes: [
      {
        codeHash: hashInviteCode('LEARN-2026'),
        roleId: learnerRole.id,
        enabled: true,
        expiresAt: new Date('2026-08-01T00:00:00Z'),
      },
    ],
    async findUserByPhone(phone: string) {
      return repo.users.find((user) => user.phone === phone) ?? null;
    },
    async findUserByHostUserId(hostUserId: string) {
      return repo.users.find((user) => user.hostUserId === hostUserId) ?? null;
    },
    async findUserWithRoleById(userId: string) {
      const user = repo.users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      const role = repo.roles.find((candidate) => candidate.id === user.roleId);
      return role ? { user, role } : null;
    },
    async findRoleById(roleId: string) {
      return repo.roles.find((role) => role.id === roleId) ?? null;
    },
    async findRoleByCode(code: string) {
      return repo.roles.find((role) => role.code === code) ?? null;
    },
    async findInviteCodeByHash(codeHash: string) {
      return repo.inviteCodes.find((code) => code.codeHash === codeHash) ?? null;
    },
    async createUser(input) {
      const user: AuthUser = {
        id: `user-${repo.users.length + 1}`,
        phone: input.phone ?? null,
        passwordHash: input.passwordHash ?? null,
        hostUserId: input.hostUserId ?? null,
        roleId: input.roleId,
        status: 'active',
        displayName: input.displayName,
      };
      repo.users.push(user);
      return user;
    },
    async listUsersWithRoles() {
      return repo.users.map((user) => ({
        user,
        role: repo.roles.find((role) => role.id === user.roleId)!,
      }));
    },
    async updateUserRole(userId: string, roleId: string) {
      const user = repo.users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      user.roleId = roleId;
      return user;
    },
    async deleteUser(userId: string) {
      const index = repo.users.findIndex((candidate) => candidate.id === userId);
      if (index === -1) return null;
      const [user] = repo.users.splice(index, 1);
      return user;
    },
  } satisfies AuthRepository & {
    users: AuthUser[];
    roles: AuthRole[];
    inviteCodes: Array<{
      codeHash: string;
      roleId: string;
      enabled: boolean;
      expiresAt: Date | null;
    }>;
  };

  return repo;
}

describe('Slice-07 auth service', () => {
  test('registers a learner with phone, password, and a valid invite code', async () => {
    vi.setSystemTime(new Date('2026-07-02T00:00:00Z'));
    const repo = makeRepo();
    const service = createAuthService(repo);

    const result = await service.registerWithPassword({
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });

    expect(result.identity).toEqual({
      userId: 'user-1',
      roleId: learnerRole.id,
      roleCode: learnerRole.code,
      isAdmin: false,
      authSource: 'password',
    });
    expect(result.user.phone).toBe('13800138000');
    expect(result.user.displayName).toBe('张三');
    expect(result.user.passwordHash).not.toBe('password-123');
    await expect(verifyPassword('password-123', result.user.passwordHash!)).resolves.toBe(true);
    vi.useRealTimers();
  });

  test('normalizes names and rejects invalid names or mobile numbers', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);

    await expect(
      service.registerWithPassword({
        name: '  张三  ',
        phone: '13800138000',
        password: 'password-123',
        inviteCode: 'LEARN-2026',
      }),
    ).resolves.toMatchObject({ user: { displayName: '张三' } });

    await expect(
      service.registerWithPassword({
        name: '张',
        phone: '13900139000',
        password: 'password-123',
        inviteCode: 'LEARN-2026',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_DISPLAY_NAME'));

    await expect(
      service.registerWithPassword({
        name: '李四',
        phone: '12800128000',
        password: 'password-123',
        inviteCode: 'LEARN-2026',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_PHONE'));
  });

  test('rejects disabled, expired, or unknown invite codes', async () => {
    vi.setSystemTime(new Date('2026-07-02T00:00:00Z'));
    const repo = makeRepo();
    repo.inviteCodes.push(
      {
        codeHash: hashInviteCode('DISABLED'),
        roleId: learnerRole.id,
        enabled: false,
        expiresAt: null,
      },
      {
        codeHash: hashInviteCode('EXPIRED'),
        roleId: learnerRole.id,
        enabled: true,
        expiresAt: new Date('2026-07-01T00:00:00Z'),
      },
    );
    const service = createAuthService(repo);

    await expect(
      service.registerWithPassword({
        name: '张三',
        phone: '13800138001',
        password: 'password-123',
        inviteCode: 'NOPE',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_INVITE_CODE'));
    await expect(
      service.registerWithPassword({
        name: '李四',
        phone: '13800138002',
        password: 'password-123',
        inviteCode: 'DISABLED',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVITE_CODE_DISABLED'));
    await expect(
      service.registerWithPassword({
        name: '王五',
        phone: '13800138003',
        password: 'password-123',
        inviteCode: 'EXPIRED',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVITE_CODE_EXPIRED'));
    vi.useRealTimers();
  });

  test('does not allow the learner registration entry to create administrator accounts', async () => {
    const repo = makeRepo();
    repo.inviteCodes.push({
      codeHash: hashInviteCode('ADMIN-CODE'),
      roleId: adminRole.id,
      enabled: true,
      expiresAt: null,
    });
    const service = createAuthService(repo);

    await expect(
      service.registerWithPassword({
        name: '赵六',
        phone: '13800138004',
        password: 'password-123',
        inviteCode: 'ADMIN-CODE',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVITE_ROLE_NOT_ALLOWED'));
  });

  test('logs in an active password user and rejects wrong passwords', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);
    await service.registerWithPassword({
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });

    await expect(
      service.loginWithPassword({ phone: '13800138000', password: 'password-123' }),
    ).resolves.toMatchObject({
      identity: {
        userId: 'user-1',
        roleCode: 'learner',
        isAdmin: false,
        authSource: 'password',
      },
    });
    await expect(
      service.loginWithPassword({ phone: '13800138000', password: 'wrong-password' }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_CREDENTIALS'));
  });

  test('creates an administrator on first host SSO and reuses the binding later', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);

    const first = await service.loginWithHostSso({ hostUserId: 'host-admin-1' });
    const second = await service.loginWithHostSso({ hostUserId: 'host-admin-1' });

    expect(repo.users).toHaveLength(1);
    expect(first.identity).toEqual({
      userId: 'user-1',
      roleId: adminRole.id,
      roleCode: adminRole.code,
      isAdmin: true,
      authSource: 'host-sso',
    });
    expect(second.identity.userId).toBe(first.identity.userId);
  });

  test('lists users and lets administrators update the current role only', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);
    await service.registerWithPassword({
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });

    await expect(service.listUsers()).resolves.toEqual([
      {
        id: 'user-1',
        phone: '13800138000',
        hostUserId: null,
        role: { id: learnerRole.id, code: 'learner', name: 'Learner', isAdmin: false },
        status: 'active',
        displayName: '张三',
      },
    ]);

    const updated = await service.updateUserRole({ userId: 'user-1', roleId: adminRole.id });

    expect(updated.identity).toMatchObject({
      userId: 'user-1',
      roleId: adminRole.id,
      roleCode: 'admin',
      isAdmin: true,
    });
  });

  test('deletes users by id and reports missing users', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);
    await service.registerWithPassword({
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });

    await expect(service.deleteUser('user-1')).resolves.toMatchObject({
      id: 'user-1',
      phone: '13800138000',
    });
    expect(repo.users).toHaveLength(0);
    await expect(service.deleteUser('missing-user')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('verifies signed host SSO requests with the shared secret', () => {
    const signature = verifyHostSsoSignature.sign('host-admin-1', 'secret');

    expect(verifyHostSsoSignature('host-admin-1', signature, 'secret')).toBe(true);
    expect(verifyHostSsoSignature('host-admin-2', signature, 'secret')).toBe(false);
    expect(verifyHostSsoSignature('host-admin-1', signature, 'other-secret')).toBe(false);
  });
});
