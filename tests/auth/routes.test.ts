import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  hashInviteCode,
  verifyHostSsoSignature,
  type AuthRepository,
  type AuthRole,
  type AuthUser,
} from '@/lib/auth/service';
import { createSessionToken } from '@/lib/security/session-token';

const mocks = vi.hoisted(() => ({
  cookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  repository: null as AuthRepository | null,
}));

const tenantId = 'tenant-a';
const tenantBId = 'tenant-b';

vi.mock('next/headers', () => ({
  cookies: async () => mocks.cookieStore,
}));

vi.mock('@/lib/auth/repository', () => ({
  getAuthRepository: () => mocks.repository,
}));

vi.mock('@/lib/admin/admin-data-repository', () => ({
  getAdminDataRepository: (actorTenantId?: string) => ({
    async queryUsers(input: {
      q?: string;
      roleId?: string;
      status: string;
      page: number;
      pageSize: number;
    }) {
      const records = (await mocks.repository!.listUsersWithRoles()).filter(({ user, role }) => {
        if (actorTenantId && user.tenantId !== actorTenantId) return false;
        if (input.q) {
          const q = input.q.toLowerCase();
          if (
            !user.displayName.toLowerCase().includes(q) &&
            !user.phone?.includes(q) &&
            !user.hostUserId?.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (input.roleId && role.id !== input.roleId) return false;
        return input.status === 'all' || user.status === input.status;
      });
      const offset = (input.page - 1) * input.pageSize;
      return {
        users: records.slice(offset, offset + input.pageSize).map(({ user, role }) => ({
          id: user.id,
          phone: user.phone,
          hostUserId: user.hostUserId,
          displayName: user.displayName,
          status: user.status,
          role,
        })),
        total: records.length,
      };
    },
    async updateUserStatus(input: {
      userId: string;
      currentUserId: string;
      status: 'active' | 'disabled';
    }) {
      const record = (await mocks.repository!.listUsersWithRoles()).find(
        ({ user }) => user.id === input.userId && user.tenantId === actorTenantId,
      );
      if (!record) return { outcome: 'not_found' } as const;
      record.user.status = input.status;
      return {
        outcome: 'updated',
        user: {
          id: record.user.id,
          phone: record.user.phone,
          hostUserId: record.user.hostUserId,
          displayName: record.user.displayName,
          status: record.user.status,
          role: record.role,
        },
      } as const;
    },
  }),
}));

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

const tenantBRole: AuthRole = {
  id: 'role-b-learner',
  tenantId: tenantBId,
  code: 'learner',
  name: 'Tenant B Learner',
  isAdmin: false,
};

function makeRepo(): AuthRepository & { users: AuthUser[]; roles: AuthRole[] } {
  const users: AuthUser[] = [];
  const roles = [adminRole, learnerRole, tenantBRole];
  const inviteCodes = [
    {
      codeHash: hashInviteCode('LEARN-2026'),
      tenantId,
      roleId: learnerRole.id,
      enabled: true,
      expiresAt: new Date('2027-08-01T00:00:00Z'),
    },
  ];

  return {
    users,
    roles,
    async findUserByPhone(phone) {
      return users.find((user) => user.phone === phone) ?? null;
    },
    async findUserByHostUserId(hostUserId) {
      return users.find((user) => user.hostUserId === hostUserId) ?? null;
    },
    async findUserWithRoleById(userId) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      const role = roles.find((candidate) => candidate.id === user.roleId);
      return role
        ? {
            user,
            role,
            tenant: {
              id: user.tenantId ?? tenantId,
              companyId: user.tenantId === tenantBId ? 'company-b' : 'company-a',
              name: user.tenantId === tenantBId ? 'Company B' : 'Company A',
              type: 'company' as const,
              status: 'active' as const,
            },
          }
        : null;
    },
    async findRoleById(roleId) {
      return roles.find((role) => role.id === roleId) ?? null;
    },
    async findRoleByCode(code) {
      return roles.find((role) => role.code === code) ?? null;
    },
    async findInviteCodeByHash(codeHash) {
      return inviteCodes.find((code) => code.codeHash === codeHash) ?? null;
    },
    async createUser(input) {
      const user: AuthUser = {
        id: `user-${users.length + 1}`,
        tenantId: input.tenantId,
        phone: input.phone ?? null,
        passwordHash: input.passwordHash ?? null,
        hostUserId: input.hostUserId ?? null,
        roleId: input.roleId,
        status: 'active',
        displayName: input.displayName,
      };
      users.push(user);
      return user;
    },
    async updateUserFromHostSso(userId, input) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      user.displayName = input.displayName;
      user.phone = input.phone;
      return user;
    },
    async listUsersWithRoles() {
      return users.map((user) => ({
        user,
        role: roles.find((role) => role.id === user.roleId)!,
      }));
    },
    async transitionUserRole(input) {
      const user = users.find(
        (candidate) => candidate.id === input.userId && candidate.tenantId === input.actorTenantId,
      );
      if (!user) return { outcome: 'user_not_found' } as const;
      const currentRole = roles.find((role) => role.id === user.roleId)!;
      const role = roles.find(
        (candidate) => candidate.id === input.roleId && candidate.tenantId === input.actorTenantId,
      );
      if (!role) return { outcome: 'role_not_found' } as const;
      if (!currentRole.isAdmin && role.isAdmin && user.status !== 'active') {
        return { outcome: 'disabled_admin' } as const;
      }
      if (currentRole.isAdmin && !role.isAdmin && user.id === input.actorUserId) {
        return { outcome: 'self_demote' } as const;
      }
      if (
        currentRole.isAdmin &&
        !role.isAdmin &&
        user.status === 'active' &&
        users.filter(
          (candidate) =>
            candidate.tenantId === input.actorTenantId &&
            candidate.status === 'active' &&
            roles.find((candidateRole) => candidateRole.id === candidate.roleId)?.isAdmin,
        ).length <= 1
      ) {
        return { outcome: 'last_admin' } as const;
      }
      user.roleId = role.id;
      return { outcome: 'updated', user, role } as const;
    },
    async deleteTenantUser(input) {
      const index = users.findIndex(
        (candidate) => candidate.id === input.userId && candidate.tenantId === input.actorTenantId,
      );
      if (index === -1) return { outcome: 'user_not_found' } as const;
      const role = roles.find((candidate) => candidate.id === users[index].roleId);
      if (role?.isAdmin) return { outcome: 'admin_user' } as const;
      const [user] = users.splice(index, 1);
      return { outcome: 'deleted', user } as const;
    },
  };
}

async function postRoute(route: string, body: Record<string, unknown>, headers?: HeadersInit) {
  const routeModule = (await import(route)) as { POST: (request: Request) => Promise<Response> };
  return routeModule.POST(
    new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

async function getRoute(route: string) {
  const routeModule = (await import(route)) as { GET: (request: Request) => Promise<Response> };
  return routeModule.GET(new Request('http://localhost/test'));
}

async function patchRoute(
  route: string,
  body: Record<string, unknown>,
  context: { params: Promise<{ id: string }> },
) {
  const routeModule = (await import(route)) as {
    PATCH: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.PATCH(
    new Request('http://localhost/test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  );
}

async function deleteRoute(route: string, context: { params: Promise<{ id: string }> }) {
  const routeModule = (await import(route)) as {
    DELETE: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.DELETE(new Request('http://localhost/test', { method: 'DELETE' }), context);
}

describe('Slice-07 auth routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.cookieStore.get.mockReset();
    mocks.cookieStore.set.mockReset();
    mocks.cookieStore.delete.mockReset();
    mocks.repository = makeRepo();
    vi.stubEnv('SESSION_SECRET', 'session-secret');
    vi.stubEnv('HOST_SSO_SECRET', 'host-secret');
  });

  test('POST /api/auth/register creates a learner session cookie', async () => {
    const res = await postRoute('@/app/api/auth/register/route', {
      name: '张三',
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toMatchObject({
      success: true,
      user: { id: 'user-1', phone: '13800138000', displayName: '张三' },
      identity: { roleCode: 'learner', isAdmin: false, authSource: 'password' },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      'openmaic_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  test('POST /api/auth/register requires a display name', async () => {
    const res = await postRoute('@/app/api/auth/register/route', {
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toMatchObject({
      success: false,
      errorCode: 'MISSING_REQUIRED_FIELD',
    });
  });

  test('POST /api/auth/register enforces the shared invite-code length limits', async () => {
    for (const inviteCode of ['ABC', 'A'.repeat(17)]) {
      const res = await postRoute('@/app/api/auth/register/route', {
        name: '张三',
        phone: '13800138000',
        password: 'password-123',
        inviteCode,
      });

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        success: false,
        error: 'INVALID_INVITE_CODE',
      });
    }
  });

  test('POST /api/auth/host-sso requires a valid host signature and creates an admin session', async () => {
    const body = {
      hostUserId: 'host-admin-1',
      companyId: 'company-a',
      companyName: 'Company A',
      displayName: '宿主管理员',
      phone: '13800138000',
      timestamp: Math.floor(Date.now() / 1000),
    };
    const signature = verifyHostSsoSignature.sign(body, 'host-secret');

    const res = await postRoute('@/app/api/auth/host-sso/route', body, {
      'x-openmaic-signature': signature,
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      user: {
        hostUserId: 'host-admin-1',
        displayName: '宿主管理员',
        phone: '13800138000',
      },
      identity: { roleCode: 'admin', isAdmin: true, authSource: 'host-sso' },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      'openmaic_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );

    const rejected = await postRoute('@/app/api/auth/host-sso/route', body, {
      'x-openmaic-signature': 'bad',
    });
    expect(rejected.status).toBe(401);

    const expiredBody = { ...body, timestamp: body.timestamp - 301 };
    const expired = await postRoute('@/app/api/auth/host-sso/route', expiredBody, {
      'x-openmaic-signature': verifyHostSsoSignature.sign(expiredBody, 'host-secret'),
    });
    expect(expired.status).toBe(401);
  });

  test('admin user APIs require administrator sessions and update current user roles', async () => {
    const repo = mocks.repository as ReturnType<typeof makeRepo>;
    repo.users.push(
      {
        id: 'admin-1',
        tenantId,
        phone: null,
        passwordHash: null,
        hostUserId: 'host-admin-1',
        roleId: adminRole.id,
        status: 'active',
        displayName: 'Admin',
      },
      {
        id: 'learner-1',
        tenantId,
        phone: '13800138000',
        passwordHash: null,
        hostUserId: null,
        roleId: learnerRole.id,
        status: 'active',
        displayName: 'Learner',
      },
      {
        id: 'learner-2',
        tenantId,
        phone: '13800138001',
        passwordHash: null,
        hostUserId: null,
        roleId: learnerRole.id,
        status: 'active',
        displayName: 'Learner 2',
      },
    );
    repo.users.push({
      id: 'tenant-b-user',
      tenantId: tenantBId,
      phone: '13800138002',
      passwordHash: null,
      hostUserId: null,
      roleId: tenantBRole.id,
      status: 'active',
      displayName: 'Tenant B User',
    });
    mocks.cookieStore.get.mockReturnValue({
      value: createSessionToken(
        {
          userId: 'admin-1',
          tenantId,
          roleId: adminRole.id,
          roleCode: 'admin',
          isAdmin: true,
          authSource: 'host-sso',
        },
        'session-secret',
      ),
    });

    const listResponse = await getRoute('@/app/api/admin/users/route');
    const listJson = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listJson.users).toHaveLength(3);
    expect(JSON.stringify(listJson)).not.toContain('tenant-b-user');

    const sessionResponse = await getRoute('@/app/api/auth/session/route');
    const sessionJson = await sessionResponse.json();
    expect(sessionJson).toMatchObject({
      authenticated: true,
      tenant: { name: 'Company A' },
      user: { id: 'admin-1' },
    });
    expect(JSON.stringify(sessionJson)).not.toContain('companyId');

    for (const [targetUserId, targetRoleId] of [
      ['tenant-b-user', adminRole.id],
      ['learner-1', tenantBRole.id],
    ] as const) {
      const crossTenantRoleResponse = await patchRoute(
        '@/app/api/admin/users/[id]/role/route',
        { roleId: targetRoleId },
        { params: Promise.resolve({ id: targetUserId }) },
      );
      expect(crossTenantRoleResponse.status).toBe(404);
    }

    const crossTenantStatusResponse = await patchRoute(
      '@/app/api/admin/users/[id]/status/route',
      { status: 'disabled' },
      { params: Promise.resolve({ id: 'tenant-b-user' }) },
    );
    expect(crossTenantStatusResponse.status).toBe(404);

    const crossTenantDeleteResponse = await deleteRoute('@/app/api/admin/users/[id]/route', {
      params: Promise.resolve({ id: 'tenant-b-user' }),
    });
    expect(crossTenantDeleteResponse.status).toBe(404);
    expect(repo.users.find((user) => user.id === 'tenant-b-user')?.status).toBe('active');

    const updateResponse = await patchRoute(
      '@/app/api/admin/users/[id]/role/route',
      { roleId: adminRole.id },
      { params: Promise.resolve({ id: 'learner-1' }) },
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      user: { id: 'learner-1', role: { id: adminRole.id, isAdmin: true } },
    });

    const demoteSelfResponse = await patchRoute(
      '@/app/api/admin/users/[id]/role/route',
      { roleId: learnerRole.id },
      { params: Promise.resolve({ id: 'admin-1' }) },
    );
    expect(demoteSelfResponse.status).toBe(409);

    const demoteLearnerResponse = await patchRoute(
      '@/app/api/admin/users/[id]/role/route',
      { roleId: learnerRole.id },
      { params: Promise.resolve({ id: 'learner-1' }) },
    );
    expect(demoteLearnerResponse.status).toBe(200);

    const deleteResponse = await deleteRoute('@/app/api/admin/users/[id]/route', {
      params: Promise.resolve({ id: 'learner-1' }),
    });
    const deleteJson = await deleteResponse.json();
    expect(deleteResponse.status).toBe(200);
    expect(deleteJson.user.id).toBe('learner-1');
    expect(repo.users.map((user) => user.id)).toEqual(['admin-1', 'learner-2', 'tenant-b-user']);

    mocks.cookieStore.get.mockReturnValue({
      value: createSessionToken(
        {
          userId: 'learner-2',
          tenantId,
          roleId: learnerRole.id,
          roleCode: 'learner',
          isAdmin: false,
          authSource: 'password',
        },
        'session-secret',
      ),
    });

    const forbidden = await getRoute('@/app/api/admin/users/route');
    expect(forbidden.status).toBe(403);
  });
});
