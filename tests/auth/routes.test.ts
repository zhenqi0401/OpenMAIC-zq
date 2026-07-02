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

vi.mock('next/headers', () => ({
  cookies: async () => mocks.cookieStore,
}));

vi.mock('@/lib/auth/repository', () => ({
  getAuthRepository: () => mocks.repository,
}));

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

function makeRepo(): AuthRepository & { users: AuthUser[] } {
  const users: AuthUser[] = [];
  const roles = [adminRole, learnerRole];
  const inviteCodes = [
    {
      codeHash: hashInviteCode('LEARN-2026'),
      roleId: learnerRole.id,
      enabled: true,
      expiresAt: new Date('2026-08-01T00:00:00Z'),
    },
  ];

  return {
    users,
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
      return role ? { user, role } : null;
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
    async listUsersWithRoles() {
      return users.map((user) => ({
        user,
        role: roles.find((role) => role.id === user.roleId)!,
      }));
    },
    async updateUserRole(userId, roleId) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) return null;
      user.roleId = roleId;
      return user;
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
      phone: '13800138000',
      password: 'password-123',
      inviteCode: 'LEARN-2026',
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toMatchObject({
      success: true,
      user: { id: 'user-1', phone: '13800138000' },
      identity: { roleCode: 'learner', isAdmin: false, authSource: 'password' },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      'openmaic_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  test('POST /api/auth/host-sso requires a valid host signature and creates an admin session', async () => {
    const signature = verifyHostSsoSignature.sign('host-admin-1', 'host-secret');

    const res = await postRoute(
      '@/app/api/auth/host-sso/route',
      { hostUserId: 'host-admin-1' },
      { 'x-openmaic-signature': signature },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      identity: { roleCode: 'admin', isAdmin: true, authSource: 'host-sso' },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      'openmaic_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );

    const rejected = await postRoute(
      '@/app/api/auth/host-sso/route',
      { hostUserId: 'host-admin-1' },
      { 'x-openmaic-signature': 'bad' },
    );
    expect(rejected.status).toBe(401);
  });

  test('admin user APIs require administrator sessions and update current user roles', async () => {
    const repo = mocks.repository as ReturnType<typeof makeRepo>;
    repo.users.push(
      {
        id: 'admin-1',
        phone: null,
        passwordHash: null,
        hostUserId: 'host-admin-1',
        roleId: adminRole.id,
        status: 'active',
        displayName: 'Admin',
      },
      {
        id: 'learner-1',
        phone: '13800138000',
        passwordHash: null,
        hostUserId: null,
        roleId: learnerRole.id,
        status: 'active',
        displayName: 'Learner',
      },
      {
        id: 'learner-2',
        phone: '13800138001',
        passwordHash: null,
        hostUserId: null,
        roleId: learnerRole.id,
        status: 'active',
        displayName: 'Learner 2',
      },
    );
    mocks.cookieStore.get.mockReturnValue({
      value: createSessionToken(
        {
          userId: 'admin-1',
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

    const updateResponse = await patchRoute(
      '@/app/api/admin/users/[id]/role/route',
      { roleId: adminRole.id },
      { params: Promise.resolve({ id: 'learner-1' }) },
    );
    const updateJson = await updateResponse.json();
    expect(updateResponse.status).toBe(200);
    expect(updateJson.user.role.code).toBe('admin');

    mocks.cookieStore.get.mockReturnValue({
      value: createSessionToken(
        {
          userId: 'learner-2',
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
