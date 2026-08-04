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

const tenantId = 'tenant-a';

const adminRole: AuthRole = {
  id: 'role-admin',
  tenantId,
  code: 'admin',
  name: 'Administrator',
  isAdmin: true,
};

const learnerRole: AuthRole = {
  id: 'role-learner',
  tenantId,
  code: 'learner',
  name: 'Learner',
  isAdmin: false,
};

type InMemoryAuthRepository = AuthRepository & {
  users: AuthUser[];
  roles: AuthRole[];
  inviteCodes: Array<{
    codeHash: string;
    tenantId?: string;
    roleId: string;
    enabled: boolean;
    expiresAt: Date | null;
  }>;
};

function makeRepo(): InMemoryAuthRepository {
  const repo: InMemoryAuthRepository = {
    users: [] as AuthUser[],
    roles: [adminRole, learnerRole],
    inviteCodes: [
      {
        codeHash: hashInviteCode('LEARN-2026'),
        tenantId,
        roleId: learnerRole.id,
        enabled: true,
        expiresAt: new Date('2027-08-01T00:00:00Z'),
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
      return role
        ? {
            user,
            role,
            tenant: {
              id: tenantId,
              companyId: 'company-a',
              name: 'Company A',
              type: 'company' as const,
              status: 'active' as const,
            },
          }
        : null;
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
        tenantId: input.tenantId,
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
    async updateUserFromHostSso(userId, input) {
      const user = repo.users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      user.displayName = input.displayName;
      user.phone = input.phone;
      return user;
    },
    async listUsersWithRoles() {
      return repo.users.map((user) => ({
        user,
        role: repo.roles.find((role) => role.id === user.roleId)!,
      }));
    },
    async transitionUserRole(input) {
      const user = repo.users.find(
        (candidate) => candidate.id === input.userId && candidate.tenantId === input.actorTenantId,
      );
      if (!user) return { outcome: 'user_not_found' } as const;
      const currentRole = repo.roles.find((role) => role.id === user.roleId)!;
      const role = repo.roles.find(
        (candidate) => candidate.id === input.roleId && candidate.tenantId === input.actorTenantId,
      );
      if (!role) return { outcome: 'role_not_found' } as const;
      if (!currentRole.isAdmin && role.isAdmin && user.status !== 'active') {
        return { outcome: 'disabled_admin' } as const;
      }
      if (currentRole.isAdmin && !role.isAdmin && user.id === input.actorUserId) {
        return { outcome: 'self_demote' } as const;
      }
      user.roleId = role.id;
      return { outcome: 'updated', user, role } as const;
    },
    async deleteTenantUser(input) {
      const index = repo.users.findIndex(
        (candidate) => candidate.id === input.userId && candidate.tenantId === input.actorTenantId,
      );
      if (index === -1) return { outcome: 'user_not_found' } as const;
      const role = repo.roles.find((candidate) => candidate.id === repo.users[index].roleId);
      if (role?.isAdmin) return { outcome: 'admin_user' } as const;
      const [user] = repo.users.splice(index, 1);
      return { outcome: 'deleted', user } as const;
    },
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
      inviteCode: ' learn - 2026 ',
    });

    expect(result.identity).toEqual({
      userId: 'user-1',
      tenantId,
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

  test('rejects invite codes outside the shared format boundaries before lookup', async () => {
    const repo = makeRepo();
    const findInviteCode = vi.spyOn(repo, 'findInviteCodeByHash');
    const service = createAuthService(repo);

    await expect(
      service.registerWithPassword({
        name: '张三',
        phone: '13800138001',
        password: 'password-123',
        inviteCode: 'A B C',
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_INVITE_CODE'));
    await expect(
      service.registerWithPassword({
        name: '李四',
        phone: '13800138002',
        password: 'password-123',
        inviteCode: 'A'.repeat(17),
      }),
    ).rejects.toMatchObject(new AuthServiceError('INVALID_INVITE_CODE'));

    expect(findInviteCode).not.toHaveBeenCalled();
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

    const first = await service.loginWithHostSso({
      hostUserId: 'host-admin-1',
      companyId: 'company-a',
      companyName: 'Company A',
      displayName: '宿主管理员',
      phone: '13800138000',
      timestamp: 1,
    });
    const second = await service.loginWithHostSso({
      hostUserId: 'host-admin-1',
      companyId: 'company-a',
      companyName: 'Company A',
      displayName: '宿主管理员（新）',
      phone: '13900139000',
      timestamp: 2,
    });

    expect(repo.users).toHaveLength(1);
    expect(repo.users[0]).toMatchObject({
      displayName: '宿主管理员（新）',
      phone: '13900139000',
    });
    expect(first.identity).toEqual({
      userId: 'user-1',
      tenantId,
      roleId: adminRole.id,
      roleCode: adminRole.code,
      isAdmin: true,
      authSource: 'host-sso',
    });
    expect(second.identity.userId).toBe(first.identity.userId);
  });

  test('does not bind a host SSO account to another user phone', async () => {
    const repo = makeRepo();
    const service = createAuthService(repo);
    await service.registerWithPassword({
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });

    await expect(
      service.loginWithHostSso({
        hostUserId: 'host-admin-1',
        companyId: 'company-a',
        companyName: 'Company A',
        displayName: '宿主管理员',
        phone: '13800138000',
        timestamp: 1,
      }),
    ).rejects.toMatchObject(new AuthServiceError('PHONE_ALREADY_REGISTERED'));
  });

  test('keeps the database-assigned learner role when a previously demoted SSO user logs in', async () => {
    const repo = makeRepo();
    repo.provisionHostSsoUser = async () => ({
      user: {
        id: 'host-user-1',
        tenantId,
        phone: '13900139000',
        passwordHash: null,
        hostUserId: 'host-admin-1',
        roleId: learnerRole.id,
        status: 'active',
        displayName: '已降权用户',
      },
      role: learnerRole,
      tenant: {
        id: tenantId,
        companyId: 'company-a',
        name: 'Company A',
        type: 'company',
        status: 'active',
      },
    });

    await expect(
      createAuthService(repo).loginWithHostSso({
        hostUserId: 'host-admin-1',
        companyId: 'company-a',
        companyName: 'Company A',
        displayName: '已降权用户',
        phone: '13900139000',
        timestamp: 1,
      }),
    ).resolves.toMatchObject({
      role: { id: learnerRole.id, isAdmin: false },
      identity: { roleId: learnerRole.id, isAdmin: false },
    });
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
        role: {
          id: learnerRole.id,
          tenantId,
          code: 'learner',
          name: 'Learner',
          isAdmin: false,
        },
        status: 'active',
        displayName: '张三',
      },
    ]);

    const updated = await service.updateUserRole({
      userId: 'user-1',
      roleId: adminRole.id,
      actorUserId: 'admin-1',
      actorTenantId: tenantId,
    });

    expect(updated.identity).toMatchObject({
      userId: 'user-1',
      roleId: adminRole.id,
      roleCode: 'admin',
      isAdmin: true,
    });

    repo.users[0].status = 'disabled';
    repo.users[0].roleId = learnerRole.id;
    await expect(
      service.updateUserRole({
        userId: 'user-1',
        roleId: adminRole.id,
        actorUserId: 'admin-1',
        actorTenantId: tenantId,
      }),
    ).rejects.toMatchObject(new AuthServiceError('DISABLED_ADMIN_PROMOTION'));
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

    repo.users[0].roleId = adminRole.id;
    await expect(service.deleteUser('user-1', tenantId)).rejects.toMatchObject(
      new AuthServiceError('ADMIN_USER_DELETE_NOT_ALLOWED'),
    );
    repo.users[0].roleId = learnerRole.id;

    await expect(service.deleteUser('user-1', tenantId)).resolves.toMatchObject({
      id: 'user-1',
      phone: '13800138000',
    });
    expect(repo.users).toHaveLength(0);
    await expect(service.deleteUser('missing-user', tenantId)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('verifies signed host SSO requests with the shared secret', () => {
    const payload = {
      hostUserId: 'host-admin-1',
      companyId: 'company-a',
      companyName: 'Company A',
      displayName: '宿主管理员',
      phone: '13800138000',
      timestamp: 1_784_606_400,
    };
    const signature = verifyHostSsoSignature.sign(payload, 'secret');

    expect(verifyHostSsoSignature(payload, signature, 'secret')).toBe(true);
    expect(
      verifyHostSsoSignature({ ...payload, displayName: '被篡改的姓名' }, signature, 'secret'),
    ).toBe(false);
    expect(
      verifyHostSsoSignature({ ...payload, companyId: 'company-b' }, signature, 'secret'),
    ).toBe(false);
    expect(
      verifyHostSsoSignature({ ...payload, companyName: 'Company B' }, signature, 'secret'),
    ).toBe(false);
    expect(verifyHostSsoSignature(payload, signature, 'other-secret')).toBe(false);
  });
});
