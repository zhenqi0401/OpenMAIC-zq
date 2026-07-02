import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult } from '@/lib/auth/service';
import type { EnterpriseCourse, EnterpriseRepository } from '@/lib/storage/enterprise-service';
import { hashHostApiSecret } from '@/lib/security/host-api-key';

const mocks = vi.hoisted(() => ({
  repository: null as EnterpriseRepository | null,
  admin: null as AuthResult | Response | null,
  current: null as AuthResult | null,
}));

vi.mock('@/lib/storage/enterprise-repository', () => ({
  getEnterpriseRepository: () => mocks.repository,
}));

vi.mock('@/lib/auth/current-session', () => ({
  requireCurrentAdmin: async () => mocks.admin,
  getCurrentAuthResult: async () => mocks.current,
}));

const adminRole = { id: 'role-admin', code: 'admin', name: 'Admin', isAdmin: true };
const learnerRole = { id: 'role-learner', code: 'learner', name: 'Learner', isAdmin: false };

const adminAuth: AuthResult = {
  user: {
    id: 'admin-1',
    phone: null,
    passwordHash: null,
    hostUserId: 'host-admin',
    roleId: adminRole.id,
    status: 'active',
    displayName: 'Admin',
  },
  role: adminRole,
  identity: {
    userId: 'admin-1',
    roleId: adminRole.id,
    roleCode: 'admin',
    isAdmin: true,
    authSource: 'host-sso',
  },
};

const learnerAuth: AuthResult = {
  user: {
    id: 'learner-1',
    phone: '13800138000',
    passwordHash: null,
    hostUserId: null,
    roleId: learnerRole.id,
    status: 'active',
    displayName: 'Learner',
  },
  role: learnerRole,
  identity: {
    userId: 'learner-1',
    roleId: learnerRole.id,
    roleCode: 'learner',
    isAdmin: false,
    authSource: 'password',
  },
};

function makeCourse(id: string, status: EnterpriseCourse['status']): EnterpriseCourse {
  return {
    id,
    name: id,
    description: null,
    categoryId: 'cat-1',
    categoryName: 'Default',
    status,
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: status === 'published' ? new Date('2026-07-01T00:00:00Z') : null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}

function makeRepository(): EnterpriseRepository {
  const courses = [
    makeCourse('course-draft', 'draft'),
    makeCourse('course-published', 'published'),
  ];
  const content = new Map<string, { scenes: unknown[]; outlines: unknown[] }>();
  const examPolicies: Awaited<ReturnType<EnterpriseRepository['listExamPolicies']>> = [];
  const media: Awaited<ReturnType<EnterpriseRepository['listMediaFiles']>> = [];

  return {
    async listRoles() {
      return [adminRole, learnerRole];
    },
    async createRole(input) {
      return { id: `role-${input.code}`, isAdmin: false, ...input };
    },
    async updateRole(id, patch) {
      return { ...learnerRole, id, ...patch };
    },
    async listInviteCodes() {
      return [];
    },
    async createInviteCode(input) {
      return {
        id: 'invite-1',
        roleId: input.roleId,
        enabled: input.enabled ?? true,
        expiresAt: input.expiresAt ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async updateInviteCode(id, patch) {
      return {
        id,
        roleId: patch.roleId ?? learnerRole.id,
        enabled: patch.enabled ?? true,
        expiresAt: patch.expiresAt ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async listCategories() {
      return [{ id: 'cat-1', name: 'Default', sortOrder: 0 }];
    },
    async createCategory(input) {
      return { id: 'cat-2', sortOrder: 0, ...input };
    },
    async updateCategory(id, patch) {
      return { id, name: patch.name ?? 'Default', sortOrder: patch.sortOrder ?? 0 };
    },
    async listAdminCourses() {
      return courses;
    },
    async createCourse(input) {
      return { ...makeCourse('course-new', 'draft'), ...input };
    },
    async updateCourseVisibility(id, visibility) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, ...visibility } : null;
    },
    async updateCourse(id, patch) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, ...patch } : null;
    },
    async publishCourse(id) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, status: 'published', publishedAt: new Date() } : null;
    },
    async archiveCourse(id) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, status: 'archived' } : null;
    },
    async getCourseContent(id) {
      const course = courses.find((candidate) => candidate.id === id);
      const stored = content.get(id) ?? { scenes: [], outlines: [] };
      return course ? { course, scenes: stored.scenes, outlines: stored.outlines } : null;
    },
    async replaceCourseContent(courseId, input) {
      content.set(courseId, { scenes: input.scenes, outlines: input.outlines });
      return { courseId, scenes: input.scenes, outlines: input.outlines };
    },
    async upsertCourseProgress(input) {
      return { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
    },
    async getDashboardSummary() {
      return {
        courseCompletionRate: 0,
        assessmentPassRate: 0,
        examPassRate: 0,
        learnerCount: 1,
        courseCount: 2,
        assessmentAttemptCount: 0,
        examAttemptCount: 0,
      };
    },
    async listCourseProgress() {
      return [];
    },
    async listAssessmentAttempts() {
      return [];
    },
    async listExamAttempts() {
      return [];
    },
    async listExamPolicies() {
      return examPolicies;
    },
    async createExamPolicy(input) {
      const policy = { id: 'exam-policy-1', status: 'draft' as const, ...input };
      examPolicies.push(policy);
      return policy;
    },
    async updateExamPolicy(id, patch) {
      const policy = examPolicies.find((candidate) => candidate.id === id);
      if (!policy) return null;
      Object.assign(policy, patch);
      return policy;
    },
    async publishExamPolicy(id) {
      const policy = examPolicies.find((candidate) => candidate.id === id);
      if (!policy) return null;
      policy.status = 'published';
      return policy;
    },
    async findHostApiKey(keyId) {
      return keyId === 'host_demo'
        ? { keyId, secretHash: hashHostApiSecret('sk_demo'), enabled: true }
        : null;
    },
    async touchHostApiKey() {},
    async createMediaFile(input) {
      const record = {
        id: 'media-1',
        courseId: input.courseId ?? null,
        sceneId: input.sceneId ?? null,
        mediaType: input.mediaType,
        mimeType: input.mimeType ?? null,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
        ossKey: input.ossKey,
        posterOssKey: input.posterOssKey ?? null,
        sizeBytes: input.sizeBytes ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      };
      media.push(record);
      return record;
    },
    async listMediaFiles() {
      return media;
    },
    async createOssPresignedUpload(input) {
      return {
        method: 'PUT',
        uploadUrl: `https://openmaic-enterprise.oss-cn-hangzhou.aliyuncs.com/${input.ossKey}?OSSAccessKeyId=test-id&Expires=1780000000&Signature=sig`,
        ossKey: input.ossKey,
        expiresAt: new Date('2026-07-01T01:00:00Z'),
        headers: { 'Content-Type': input.mimeType },
      };
    },
  };
}

async function getRoute(route: string, url = 'http://localhost/test', headers?: HeadersInit) {
  const routeModule = (await import(route)) as { GET: (request: Request) => Promise<Response> };
  return routeModule.GET(new Request(url, { headers }));
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

async function postRouteWithContext(
  route: string,
  body: Record<string, unknown>,
  context: { params: Promise<{ id: string }> },
) {
  const routeModule = (await import(route)) as {
    POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.POST(
    new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  );
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

describe('Slice-01 API routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.repository = makeRepository();
    mocks.admin = adminAuth;
    mocks.current = learnerAuth;
  });

  test('admin categories API requires admin context and creates categories', async () => {
    const created = await postRoute('@/app/api/admin/categories/route', {
      name: 'Sales',
      sortOrder: 10,
    });

    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      success: true,
      category: { id: 'cat-2', name: 'Sales', sortOrder: 10 },
    });

    mocks.admin = new Response('forbidden', { status: 403 });
    const forbidden = await getRoute('@/app/api/admin/categories/route');
    expect(forbidden.status).toBe(403);
  });

  test('admin course API lists courses, updates visibility, and publishes courses', async () => {
    const list = await getRoute('@/app/api/admin/courses/route');
    await expect(list.json()).resolves.toMatchObject({
      courses: [{ id: 'course-draft' }, { id: 'course-published' }],
    });

    const visibility = await patchRoute(
      '@/app/api/admin/courses/[id]/visibility/route',
      { visibilityMode: 'roles', visibleRoleIds: [learnerRole.id] },
      { params: Promise.resolve({ id: 'course-draft' }) },
    );
    await expect(visibility.json()).resolves.toMatchObject({
      course: { id: 'course-draft', visibilityMode: 'roles', visibleRoleIds: [learnerRole.id] },
    });

    const published = await postRouteWithContext(
      '@/app/api/admin/courses/[id]/publish/route',
      {},
      { params: Promise.resolve({ id: 'course-draft' }) },
    );
    await expect(published.json()).resolves.toMatchObject({
      course: { id: 'course-draft', status: 'published' },
    });

    const updated = await patchRoute(
      '@/app/api/admin/courses/[id]/route',
      { name: 'Updated Course', description: 'Updated', categoryId: 'cat-1' },
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(updated.json()).resolves.toMatchObject({
      course: { id: 'course-published', name: 'Updated Course', status: 'published' },
    });
  });

  test('learner course API only returns published visible courses and saves progress', async () => {
    const list = await getRoute('@/app/api/courses/route');
    await expect(list.json()).resolves.toMatchObject({
      courses: [{ id: 'course-published' }],
    });

    const draft = await getRoute(
      '@/app/api/courses/[id]/route',
      'http://localhost/api/courses/course-draft',
    );
    expect(draft.status).toBe(404);

    const progress = await patchRoute(
      '@/app/api/courses/[id]/progress/route',
      { sceneIndex: 1, actionIndex: 2, completed: true },
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(progress.json()).resolves.toMatchObject({
      progress: { userId: 'learner-1', courseId: 'course-published', completed: true },
    });
  });

  test('admin content and exam policy APIs persist Slice-01 backend records only', async () => {
    const contentResponse = await patchRoute(
      '@/app/api/admin/courses/[id]/content/route',
      {
        scenes: [{ id: 'scene-1', type: 'slide', title: 'Intro', content: {}, actions: [] }],
        outlines: [{ id: 'outline-1', title: 'Intro' }],
      },
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(contentResponse.json()).resolves.toMatchObject({
      content: { courseId: 'course-published', scenes: [{ id: 'scene-1' }] },
    });

    const examPolicyResponse = await postRoute('@/app/api/admin/exam-policies/route', {
      title: 'Sales Exam',
      targetRoleId: learnerRole.id,
      categoryIds: ['cat-1'],
      courseIds: ['course-published'],
      questionCount: 10,
      passThreshold: 80,
      timeLimitMinutes: 30,
    });
    await expect(examPolicyResponse.json()).resolves.toMatchObject({
      examPolicy: { id: 'exam-policy-1', status: 'draft' },
    });

    const publishResponse = await postRouteWithContext(
      '@/app/api/admin/exam-policies/[id]/publish/route',
      {},
      { params: Promise.resolve({ id: 'exam-policy-1' }) },
    );
    await expect(publishResponse.json()).resolves.toMatchObject({
      examPolicy: { id: 'exam-policy-1', status: 'published' },
    });
  });

  test('host and storage APIs use API-key auth and metadata-only media records', async () => {
    const rejected = await getRoute(
      '@/app/api/host/summary/route',
      'http://localhost/api/host/summary',
    );
    expect(rejected.status).toBe(401);

    const summary = await getRoute(
      '@/app/api/host/summary/route',
      'http://localhost/api/host/summary',
      {
        Authorization: 'Bearer host_demo.sk_demo',
      },
    );
    await expect(summary.json()).resolves.toMatchObject({
      summary: { learnerCount: 1, courseCount: 2 },
    });

    const created = await postRoute('@/app/api/storage/media/route', {
      courseId: 'course-published',
      mediaType: 'video',
      mimeType: 'video/mp4',
      ossKey: 'courses/course-published/video.mp4',
      sizeBytes: 4096,
    });
    await expect(created.json()).resolves.toMatchObject({
      mediaFile: { id: 'media-1', ossKey: 'courses/course-published/video.mp4', sizeBytes: 4096 },
    });

    const listed = await getRoute('@/app/api/storage/media/route');
    await expect(listed.json()).resolves.toMatchObject({
      mediaFiles: [{ id: 'media-1', ossKey: 'courses/course-published/video.mp4' }],
    });

    const presign = await postRoute('@/app/api/storage/presign/route', {
      ossKey: 'courses/course-published/video.mp4',
      mimeType: 'video/mp4',
      expiresInSeconds: 900,
    });
    await expect(presign.json()).resolves.toMatchObject({
      presignedUpload: {
        method: 'PUT',
        ossKey: 'courses/course-published/video.mp4',
        headers: { 'Content-Type': 'video/mp4' },
      },
    });
  });
});
