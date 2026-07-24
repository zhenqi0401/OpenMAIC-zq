import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '@/lib/auth/service';
import { AdminManagementError } from '@/lib/admin/admin-management';

const mocks = vi.hoisted(() => ({
  admin: null as AuthResult | Response | null,
  service: {
    queryUsers: vi.fn(),
    updateUserStatus: vi.fn(),
    queryCourses: vi.fn(),
    getCoursePreviews: vi.fn(),
    reorderCategories: vi.fn(),
    deleteCategory: vi.fn(),
    queryExamPolicies: vi.fn(),
    getExamPolicyAttempts: vi.fn(),
    getCommunitySummary: vi.fn(),
    getDashboard: vi.fn(),
  },
  communityRepository: {
    list: vi.fn(),
  },
  communityFlags: {
    danmaku: true,
    forum: true,
  },
}));

vi.mock('@/lib/auth/current-session', () => ({
  requireCurrentAdmin: async () => mocks.admin,
}));

vi.mock('@/lib/admin/admin-management-route', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/admin/admin-management-route')>();
  return { ...original, getAdminManagementService: () => mocks.service };
});

vi.mock('@/lib/community/community-admin', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community/community-admin')>();
  return { ...original, getCommunityAdminRepository: () => mocks.communityRepository };
});

vi.mock('@/lib/config/feature-flags', () => ({
  isDanmakuEnabled: () => mocks.communityFlags.danmaku,
  isForumEnabled: () => mocks.communityFlags.forum,
}));

const admin: AuthResult = {
  user: {
    id: 'admin-1',
    phone: null,
    passwordHash: null,
    hostUserId: 'host-admin',
    roleId: 'role-admin',
    status: 'active',
    displayName: '管理员',
  },
  role: { id: 'role-admin', code: 'admin', name: '管理员', isAdmin: true },
  identity: {
    userId: 'admin-1',
    roleId: 'role-admin',
    roleCode: 'admin',
    isAdmin: true,
    authSource: 'host-sso',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = admin;
  mocks.communityFlags.danmaku = true;
  mocks.communityFlags.forum = true;
});

describe('stage 2 admin routes', () => {
  it('validates and forwards user query parameters with unified pagination', async () => {
    mocks.service.queryUsers.mockResolvedValue({
      users: [],
      pagination: { page: 2, pageSize: 20, total: 0, totalPages: 1 },
    });
    const { GET } = await import('@/app/api/admin/users/route');
    const response = await GET(
      new Request(
        'http://localhost/api/admin/users?q=%E5%BC%A0&roleId=role-1&status=disabled&page=2&pageSize=20',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.service.queryUsers).toHaveBeenCalledWith({
      q: '张',
      roleId: 'role-1',
      status: 'disabled',
      page: 2,
      pageSize: 20,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      pagination: { page: 2, pageSize: 20, total: 0, totalPages: 1 },
    });

    const invalid = await GET(
      new Request('http://localhost/api/admin/users?status=blocked&page=0'),
    );
    expect(invalid.status).toBe(400);
  });

  it('rejects invalid status mutations and maps self-disable conflicts', async () => {
    const { PATCH } = await import('@/app/api/admin/users/[id]/status/route');
    const context = { params: Promise.resolve({ id: 'admin-1' }) };
    const invalid = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'locked' }),
      }),
      context,
    );
    expect(invalid.status).toBe(400);

    mocks.service.updateUserStatus.mockRejectedValue(
      new AdminManagementError('CONFLICT', '管理员不能停用当前登录账号'),
    );
    const conflict = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'disabled' }),
      }),
      context,
    );
    expect(conflict.status).toBe(409);
  });

  it('validates course filters, sort and preview limits', async () => {
    mocks.service.queryCourses.mockResolvedValue({
      courses: [],
      pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    });
    const courseRoute = await import('@/app/api/admin/courses/route');
    const response = await courseRoute.GET(
      new Request(
        'http://localhost/api/admin/courses?status=review&visibilityMode=roles&pageSize=12&sort=updatedAt%3Adesc',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.service.queryCourses).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'review', visibilityMode: 'roles', pageSize: 12 }),
    );
    const invalid = await courseRoute.GET(
      new Request('http://localhost/api/admin/courses?sort=name%3Aasc'),
    );
    expect(invalid.status).toBe(400);

    mocks.service.getCoursePreviews.mockRejectedValue(
      new AdminManagementError('INVALID_REQUEST', '一次最多预览 20 门课程'),
    );
    const previewRoute = await import('@/app/api/admin/courses/previews/route');
    const tooMany = Array.from({ length: 21 }, (_, index) => `id-${index}`).join(',');
    const preview = await previewRoute.GET(
      new Request(`http://localhost/api/admin/courses/previews?ids=${tooMany}`),
    );
    expect(preview.status).toBe(400);
  });

  it('validates category reorder payloads and returns in-use conflicts', async () => {
    const reorderRoute = await import('@/app/api/admin/categories/reorder/route');
    const invalid = await reorderRoute.PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ categoryIds: 1 }),
      }),
    );
    expect(invalid.status).toBe(400);

    mocks.service.deleteCategory.mockRejectedValue(
      new AdminManagementError('CONFLICT', '请先调整相关课程分类'),
    );
    const categoryRoute = await import('@/app/api/admin/categories/[id]/route');
    const conflict = await categoryRoute.DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'cat-1' }),
    });
    expect(conflict.status).toBe(409);
  });

  it('forwards exam filters and rejects invalid attempts pagination', async () => {
    mocks.service.queryExamPolicies.mockResolvedValue({
      examPolicies: [],
      summary: {},
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    const policyRoute = await import('@/app/api/admin/exam-policies/route');
    const response = await policyRoute.GET(
      new Request(
        'http://localhost/api/admin/exam-policies?q=%E5%AE%89%E5%85%A8&status=published&targetRoleId=role-1',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.service.queryExamPolicies).toHaveBeenCalledWith(
      expect.objectContaining({ q: '安全', status: 'published', targetRoleId: 'role-1' }),
    );

    const attemptsRoute = await import('@/app/api/admin/exam-policies/[id]/attempts/route');
    const invalid = await attemptsRoute.GET(
      new Request('http://localhost/api/admin/exam-policies/policy-1/attempts?pageSize=101'),
      { params: Promise.resolve({ id: 'policy-1' }) },
    );
    expect(invalid.status).toBe(400);
  });

  it('validates community and dashboard ranges and preserves admin authorization', async () => {
    const community = await import('@/app/api/admin/community/summary/route');
    const invalidCommunity = await community.GET(
      new Request('http://localhost/api/admin/community/summary?range=year'),
    );
    expect(invalidCommunity.status).toBe(400);

    const dashboard = await import('@/app/api/admin/dashboard/route');
    const invalidDashboard = await dashboard.GET(
      new Request('http://localhost/api/admin/dashboard?range=quarter'),
    );
    expect(invalidDashboard.status).toBe(400);

    mocks.admin = new Response(null, { status: 403 });
    const forbidden = await dashboard.GET(new Request('http://localhost/api/admin/dashboard'));
    expect(forbidden.status).toBe(403);
    expect(mocks.service.getDashboard).not.toHaveBeenCalled();
  });

  it('validates community list filters and adds unified pagination compatibly', async () => {
    mocks.communityRepository.list.mockResolvedValue({ items: [{ id: 'reply-1' }], total: 41 });
    const community = await import('@/app/api/admin/community/route');
    const response = await community.GET(
      new Request(
        'http://localhost/api/admin/community?type=replies&status=hidden&page=2&pageSize=20',
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 41,
      page: 2,
      pageSize: 20,
      pagination: { page: 2, pageSize: 20, total: 41, totalPages: 3 },
    });
    expect(mocks.communityRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'replies', status: 'hidden', page: 2, pageSize: 20 }),
    );

    mocks.communityFlags.danmaku = false;
    mocks.communityFlags.forum = false;
    mocks.communityRepository.list.mockResolvedValue({ items: [], total: 0 });
    const auditResponse = await community.GET(
      new Request('http://localhost/api/admin/community?type=audit'),
    );
    expect(auditResponse.status).toBe(200);
    expect(mocks.communityRepository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'audit' }),
    );

    const invalidStatus = await community.GET(
      new Request('http://localhost/api/admin/community?type=replies&status=archived'),
    );
    expect(invalidStatus.status).toBe(400);
    const invalidDate = await community.GET(
      new Request('http://localhost/api/admin/community?from=2026-07-23&to=2026-07-22'),
    );
    expect(invalidDate.status).toBe(400);
  });
});
