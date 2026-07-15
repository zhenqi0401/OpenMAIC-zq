import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult } from '@/lib/auth/service';

const mocks = vi.hoisted(() => ({
  current: null as AuthResult | null,
  admin: null as AuthResult | Response | null,
  service: {
    listVisible: vi.fn(),
    create: vi.fn(),
    deleteOwn: vi.fn(),
    listAdmin: vi.fn(),
    moderate: vi.fn(),
  },
}));

vi.mock('@/lib/auth/current-session', () => ({
  getCurrentAuthResult: async () => mocks.current,
  requireCurrentAdmin: async () => mocks.admin,
}));

vi.mock('@/lib/community/danmaku-route-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community/danmaku-route-utils')>();
  return { ...original, getDanmakuService: () => mocks.service };
});

import { GET as adminList } from '@/app/api/admin/danmaku/route';
import { PATCH as adminPatch } from '@/app/api/admin/danmaku/[danmakuId]/route';
import { GET, POST } from '@/app/api/courses/[id]/danmaku/route';
import { DELETE } from '@/app/api/courses/[id]/danmaku/[danmakuId]/route';

const learner: AuthResult = {
  user: {
    id: 'session-user',
    phone: null,
    passwordHash: null,
    hostUserId: null,
    roleId: 'role-1',
    status: 'active',
    displayName: 'Learner',
  },
  role: { id: 'role-1', code: 'learner', name: 'Learner', isAdmin: false },
  identity: {
    userId: 'session-user',
    roleId: 'role-1',
    roleCode: 'learner',
    isAdmin: false,
    authSource: 'password',
  },
};

const admin: AuthResult = {
  ...learner,
  user: { ...learner.user, id: 'admin-1', roleId: 'admin-role' },
  role: { id: 'admin-role', code: 'admin', name: 'Admin', isAdmin: true },
  identity: {
    userId: 'admin-1',
    roleId: 'admin-role',
    roleCode: 'admin',
    isAdmin: true,
    authSource: 'password',
  },
};

describe('DMK learner routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current = learner;
    mocks.admin = admin;
    mocks.service.listVisible.mockResolvedValue({ items: [], nextCursor: null });
    mocks.service.create.mockResolvedValue({
      created: true,
      danmaku: { id: 'dmk-1', content: 'hello' },
    });
    mocks.service.deleteOwn.mockResolvedValue({ id: 'dmk-1', content: 'hello' });
  });

  test('GET requires a session and forwards the role for server-side filtering', async () => {
    mocks.current = null;
    const unauthenticated = await GET(
      new Request('http://localhost/api/courses/course-1/danmaku?sceneKey=scene-1'),
      { params: Promise.resolve({ id: 'course-1' }) },
    );
    expect(unauthenticated.status).toBe(401);

    mocks.current = learner;
    const response = await GET(
      new Request('http://localhost/api/courses/course-1/danmaku?sceneKey=scene-1&limit=25'),
      { params: Promise.resolve({ id: 'course-1' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.service.listVisible).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'role-1', sceneKey: 'scene-1', limit: 25 }),
    );
  });

  test('POST ignores a forged body authorId and uses the session plus idempotency header', async () => {
    const response = await POST(
      new Request('http://localhost/api/courses/course-1/danmaku', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'request-1' },
        body: JSON.stringify({
          sceneKey: 'scene-1',
          actionId: 'action-1',
          actionOffsetMs: 500,
          content: 'hello',
          authorId: 'attacker-choice',
        }),
      }),
      { params: Promise.resolve({ id: 'course-1' }) },
    );
    expect(response.status).toBe(201);
    expect(mocks.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 'session-user',
        roleId: 'role-1',
        clientRequestId: 'request-1',
      }),
    );
  });

  test('DELETE scopes the operation to the session author', async () => {
    await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'course-1', danmakuId: 'dmk-1' }),
    });
    expect(mocks.service.deleteOwn).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user', courseId: 'course-1' }),
    );
  });
});

describe('DMK administrator routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin = admin;
    mocks.service.listAdmin.mockResolvedValue([]);
    mocks.service.moderate.mockResolvedValue({ id: 'dmk-1' });
  });

  test('requires administrator permission before exposing real authors', async () => {
    mocks.admin = new Response(null, { status: 403 });
    const response = await adminList(new Request('http://localhost/api/admin/danmaku'));
    expect(response.status).toBe(403);
    expect(mocks.service.listAdmin).not.toHaveBeenCalled();
  });

  test('lists bounded admin records and records the actual moderator', async () => {
    const listResponse = await adminList(
      new Request('http://localhost/api/admin/danmaku?limit=20&authorId=user-1'),
    );
    expect(listResponse.status).toBe(200);
    expect(mocks.service.listAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, authorId: 'user-1' }),
    );

    const patchResponse = await adminPatch(
      new Request('http://localhost/api/admin/danmaku/dmk-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hide', reason: 'abuse' }),
      }),
      { params: Promise.resolve({ danmakuId: 'dmk-1' }) },
    );
    expect(patchResponse.status).toBe(200);
    expect(mocks.service.moderate).toHaveBeenCalledWith({
      id: 'dmk-1',
      action: 'hide',
      adminId: 'admin-1',
      reason: 'abuse',
    });
  });
});
