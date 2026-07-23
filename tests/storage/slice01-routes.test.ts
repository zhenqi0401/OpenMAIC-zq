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
  const media: Array<
    Awaited<ReturnType<EnterpriseRepository['listMediaFiles']>>[number] & {
      blob: Buffer;
      posterBlob: Buffer | null;
    }
  > = [];
  const audio = new Map<
    string,
    Awaited<ReturnType<EnterpriseRepository['createCourseAudioBlob']>>
  >();

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
    async getRoleUsage() {
      return { users: 0, inviteCodes: 0, examPolicies: 0 };
    },
    async deleteRole(id) {
      const role = [adminRole, learnerRole].find((candidate) => candidate.id === id);
      return role ?? null;
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
    async deleteInviteCode(id) {
      return {
        id,
        roleId: learnerRole.id,
        enabled: true,
        expiresAt: null,
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
    async deleteCourse(id) {
      const courseIndex = courses.findIndex((candidate) => candidate.id === id);
      if (courseIndex < 0) return null;
      const [course] = courses.splice(courseIndex, 1);
      content.delete(id);
      for (let index = media.length - 1; index >= 0; index -= 1) {
        if (media[index].courseId === id) media.splice(index, 1);
      }
      for (const key of [...audio.keys()]) {
        if (key.startsWith(`${id}:`)) audio.delete(key);
      }
      return course;
    },
    async getCourseContent(id) {
      const course = courses.find((candidate) => candidate.id === id);
      const stored = content.get(id) ?? { scenes: [], outlines: [] };
      return course
        ? {
            course,
            stage: course.stageSnapshot,
            scenes: stored.scenes,
            outlines: stored.outlines,
            mediaManifest: [],
            audioManifest: [],
          }
        : null;
    },
    async replaceCourseContent(courseId, input) {
      content.set(courseId, { scenes: input.scenes, outlines: input.outlines });
      return {
        courseId,
        scenes: input.scenes,
        outlines: input.outlines,
        stage: input.stage,
        generationStatus: input.generationStatus,
        generationComplete: input.generationComplete,
      };
    },
    async updateCourseAssessmentQuestions(id, questions) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, assessmentQuestions: questions } : null;
    },
    async getCourseProgress() {
      return null;
    },
    async markCourseStarted(input) {
      return {
        ...input,
        sceneIndex: 0,
        actionIndex: 0,
        completed: false,
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async upsertCourseProgress(input) {
      return { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
    },
    async listCourseAssessmentAttempts() {
      return [];
    },
    async createAssessmentAttempt(input) {
      return {
        id: `attempt-${input.attemptNumber}`,
        ...input,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
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
    async deleteExamPolicy(id) {
      const index = examPolicies.findIndex((policy) => policy.id === id);
      if (index === -1) return { outcome: 'not_found' as const };
      const policy = examPolicies[index];
      if (policy.status !== 'draft') return { outcome: 'not_draft' as const, policy };
      examPolicies.splice(index, 1);
      return { outcome: 'deleted' as const, policy };
    },
    async listExamAttemptsForUser() {
      return [];
    },
    async createExamAttempt(input) {
      return {
        id: `exam-attempt-${input.attemptNumber}`,
        ...input,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
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
        sceneKey: input.sceneKey ?? null,
        mediaId: input.mediaId,
        mediaType: input.mediaType,
        mimeType: input.mimeType ?? null,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
        blob: input.blob,
        posterBlob: input.posterBlob ?? null,
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
    async getMediaFileBlob(courseId, mediaId) {
      const record = media.find(
        (candidate) => candidate.courseId === courseId && candidate.mediaId === mediaId,
      );
      return record
        ? {
            courseId,
            mediaId,
            mediaType: record.mediaType,
            mimeType: record.mimeType,
            sizeBytes: record.sizeBytes,
            blob: record.blob,
          }
        : null;
    },
    async createCourseAudioBlob(input) {
      const record = {
        courseId: input.courseId,
        sceneKey: input.sceneKey ?? null,
        audioId: input.audioId,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? input.blob.byteLength,
        text: input.text ?? null,
        voice: input.voice ?? null,
        blob: input.blob,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
      audio.set(`${input.courseId}:${input.audioId}`, record);
      return record;
    },
    async listCourseAudioBlobs(courseId) {
      return [...audio.values()].filter((record) => record.courseId === courseId);
    },
    async getCourseAudioBlob(courseId, audioId) {
      return audio.get(`${courseId}:${audioId}`) ?? null;
    },
  };
}

async function getRoute(route: string, url = 'http://localhost/test', headers?: HeadersInit) {
  const routeModule = (await import(route)) as { GET: (request: Request) => Promise<Response> };
  return routeModule.GET(new Request(url, { headers }));
}

async function getRouteWithContext(
  route: string,
  context: { params: Promise<{ id: string }> },
  url = 'http://localhost/test',
) {
  const routeModule = (await import(route)) as {
    GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.GET(new Request(url), context);
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

async function deleteRouteWithContext(route: string, context: { params: Promise<{ id: string }> }) {
  const routeModule = (await import(route)) as {
    DELETE: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.DELETE(new Request('http://localhost/test', { method: 'DELETE' }), context);
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

  test('admin invite-code API enforces the registration format rules', async () => {
    const createInviteCode = vi.spyOn(mocks.repository!, 'createInviteCode');

    for (const code of ['ABC', 'A'.repeat(17)]) {
      const response = await postRoute('@/app/api/admin/invite-codes/route', {
        code,
        roleId: learnerRole.id,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: 'Invite code must contain 4 to 16 characters',
      });
    }

    const created = await postRoute('@/app/api/admin/invite-codes/route', {
      code: ' learn - 2026 ',
      roleId: learnerRole.id,
    });
    expect(created.status).toBe(201);
    expect(createInviteCode).toHaveBeenCalledTimes(1);
    expect(createInviteCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LEARN-2026', roleId: learnerRole.id }),
    );
  });

  test('admin course API lists courses, updates visibility, and publishes courses', async () => {
    const list = await getRoute('@/app/api/admin/courses/route');
    await expect(list.json()).resolves.toMatchObject({
      courses: [{ id: 'course-published' }, { id: 'course-draft' }],
    });

    const created = await postRoute('@/app/api/admin/courses/route', {
      name: 'Two-Factor Theory',
      description: 'Motivation training',
      categoryId: 'cat-1',
      stageSnapshot: { id: 'stage-1', name: 'Two-Factor Theory' },
      generationStatus: 'generating',
      generationComplete: false,
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      course: {
        id: 'course-new',
        stageSnapshot: { id: 'stage-1', name: 'Two-Factor Theory' },
        generationStatus: 'generating',
        generationComplete: false,
      },
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

    const deleted = await deleteRouteWithContext('@/app/api/admin/courses/[id]/route', {
      params: Promise.resolve({ id: 'course-draft' }),
    });
    await expect(deleted.json()).resolves.toMatchObject({
      course: { id: 'course-draft' },
    });

    const deletedList = await getRoute('@/app/api/admin/courses/route');
    await expect(deletedList.json()).resolves.toMatchObject({
      courses: [{ id: 'course-published' }],
    });
  });

  test('learner course API only returns published visible courses and saves progress', async () => {
    const list = await getRoute('@/app/api/courses/route');
    await expect(list.json()).resolves.toMatchObject({
      courses: [{ id: 'course-published' }],
      categories: [{ id: 'cat-1', name: 'Default', sortOrder: 0 }],
    });

    const draft = await getRouteWithContext(
      '@/app/api/courses/[id]/route',
      { params: Promise.resolve({ id: 'course-draft' }) },
      'http://localhost/api/courses/course-draft',
    );
    expect(draft.status).toBe(404);

    const detail = await getRouteWithContext(
      '@/app/api/courses/[id]/route',
      { params: Promise.resolve({ id: 'course-published' }) },
      'http://localhost/api/courses/course-published',
    );
    await expect(detail.json()).resolves.toMatchObject({
      course: { id: 'course-published' },
      scenes: [],
      outlines: [],
      mediaManifest: [],
      audioManifest: [],
    });

    const progress = await patchRoute(
      '@/app/api/courses/[id]/progress/route',
      { sceneIndex: 1, actionIndex: 2, completed: true },
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(progress.json()).resolves.toMatchObject({
      progress: { userId: 'learner-1', courseId: 'course-published', completed: true },
    });
  });

  test('learner course API validates the requested popularity sort', async () => {
    const popular = await getRoute(
      '@/app/api/courses/route',
      'http://localhost/api/courses?sort=popular',
    );
    expect(popular.status).toBe(200);

    const invalid = await getRoute(
      '@/app/api/courses/route',
      'http://localhost/api/courses?sort=unknown',
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: 'sort must be latest or popular',
    });
  });

  test('learner course API keeps all categories when no courses are visible', async () => {
    const repository = makeRepository();
    mocks.repository = {
      ...repository,
      async listCategories() {
        return [
          { id: 'cat-handbook', name: '员工手册', sortOrder: 10 },
          { id: 'cat-rules', name: '公司规范规章制度', sortOrder: 20 },
          { id: 'cat-onboarding', name: '新员工入职', sortOrder: 30 },
        ];
      },
      async listAdminCourses() {
        return [];
      },
    };

    const list = await getRoute('@/app/api/courses/route');
    await expect(list.json()).resolves.toEqual({
      success: true,
      courses: [],
      categories: [
        { id: 'cat-handbook', name: '员工手册', sortOrder: 10 },
        { id: 'cat-rules', name: '公司规范规章制度', sortOrder: 20 },
        { id: 'cat-onboarding', name: '新员工入职', sortOrder: 30 },
      ],
    });
  });

  test('admin content and exam policy APIs persist Slice-01 backend records only', async () => {
    const contentResponse = await patchRoute(
      '@/app/api/admin/courses/[id]/content/route',
      {
        stage: { id: 'stage-1', name: 'Intro course' },
        scenes: [{ id: 'scene-1', type: 'slide', title: 'Intro', content: {}, actions: [] }],
        outlines: [{ id: 'outline-1', title: 'Intro' }],
        generationStatus: 'ready',
        generationComplete: true,
      },
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(contentResponse.json()).resolves.toMatchObject({
      content: {
        courseId: 'course-published',
        scenes: [{ id: 'scene-1' }],
        stage: { id: 'stage-1', name: 'Intro course' },
        generationStatus: 'ready',
        generationComplete: true,
      },
    });

    const readContentResponse = await getRouteWithContext(
      '@/app/api/admin/courses/[id]/content/route',
      { params: Promise.resolve({ id: 'course-published' }) },
    );
    await expect(readContentResponse.json()).resolves.toMatchObject({
      content: {
        course: { id: 'course-published' },
        scenes: [{ id: 'scene-1' }],
        outlines: [{ id: 'outline-1' }],
      },
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

  test('admin exam policy deletion returns 200 for drafts, 409 for published, and 404 when missing', async () => {
    const draft = await postRoute('@/app/api/admin/exam-policies/route', {
      title: 'Draft Exam',
      targetRoleId: learnerRole.id,
      categoryIds: ['cat-1'],
      courseIds: [],
      questionCount: 10,
      passThreshold: 80,
      timeLimitMinutes: 30,
    });
    const draftData = (await draft.json()) as { examPolicy: { id: string } };
    const deleted = await deleteRouteWithContext('@/app/api/admin/exam-policies/[id]/route', {
      params: Promise.resolve({ id: draftData.examPolicy.id }),
    });
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toMatchObject({
      examPolicy: { id: draftData.examPolicy.id, status: 'draft' },
    });

    const publishedDraft = await postRoute('@/app/api/admin/exam-policies/route', {
      title: 'Published Exam',
      targetRoleId: learnerRole.id,
      categoryIds: ['cat-1'],
      courseIds: [],
      questionCount: 10,
      passThreshold: 80,
      timeLimitMinutes: 30,
    });
    const publishedData = (await publishedDraft.json()) as { examPolicy: { id: string } };
    await postRouteWithContext(
      '@/app/api/admin/exam-policies/[id]/publish/route',
      {},
      { params: Promise.resolve({ id: publishedData.examPolicy.id }) },
    );
    const archived = await patchRoute(
      '@/app/api/admin/exam-policies/[id]/route',
      { status: 'archived' },
      { params: Promise.resolve({ id: publishedData.examPolicy.id }) },
    );
    await expect(archived.json()).resolves.toMatchObject({
      examPolicy: { id: publishedData.examPolicy.id, status: 'archived' },
    });
    const conflict = await deleteRouteWithContext('@/app/api/admin/exam-policies/[id]/route', {
      params: Promise.resolve({ id: publishedData.examPolicy.id }),
    });
    expect(conflict.status).toBe(409);

    const missing = await deleteRouteWithContext('@/app/api/admin/exam-policies/[id]/route', {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(missing.status).toBe(404);
  });

  test('host and storage APIs use API-key auth and PostgreSQL media blobs', async () => {
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
      sceneKey: 'scene-1',
      mediaId: 'video-1',
      mediaType: 'video',
      mimeType: 'video/mp4',
      base64: Buffer.from('video-data').toString('base64'),
      sizeBytes: 4096,
    });
    await expect(created.json()).resolves.toMatchObject({
      mediaFile: { id: 'media-1', mediaId: 'video-1', sizeBytes: 4096 },
    });

    const listed = await getRoute('@/app/api/storage/media/route');
    await expect(listed.json()).resolves.toMatchObject({
      mediaFiles: [{ id: 'media-1', mediaId: 'video-1' }],
    });

    const mediaResponse = await getRouteWithContext(
      '@/app/api/courses/[id]/media/[mediaId]/route',
      { params: Promise.resolve({ id: 'course-published', mediaId: 'video-1' }) },
      'http://localhost/api/courses/course-published/media/video-1',
    );
    expect(mediaResponse.status).toBe(200);
    expect(mediaResponse.headers.get('content-type')).toBe('video/mp4');
    expect(Buffer.from(await mediaResponse.arrayBuffer()).toString('utf8')).toBe('video-data');

    const createdAudio = await postRoute('@/app/api/storage/audio/route', {
      courseId: 'course-published',
      sceneKey: 'scene-1',
      audioId: 'tts-1',
      mimeType: 'audio/mpeg',
      base64: Buffer.from('audio-data').toString('base64'),
      sizeBytes: 1024,
    });
    await expect(createdAudio.json()).resolves.toMatchObject({
      audio: { audioId: 'tts-1', mimeType: 'audio/mpeg', sizeBytes: 1024 },
    });
    const audioResponse = await getRouteWithContext(
      '@/app/api/courses/[id]/audio/[audioId]/route',
      { params: Promise.resolve({ id: 'course-published', audioId: 'tts-1' }) },
      'http://localhost/api/courses/course-published/audio/tts-1',
    );
    expect(audioResponse.status).toBe(200);
    expect(audioResponse.headers.get('content-type')).toBe('audio/mpeg');
    expect(Buffer.from(await audioResponse.arrayBuffer()).toString('utf8')).toBe('audio-data');

    mocks.current = adminAuth;
    await postRoute('@/app/api/storage/media/route', {
      courseId: 'course-draft',
      sceneKey: 'scene-1',
      mediaId: 'draft-image-1',
      mediaType: 'image',
      mimeType: 'image/png',
      base64: Buffer.from('draft-image').toString('base64'),
    });
    const draftMediaResponse = await getRouteWithContext(
      '@/app/api/courses/[id]/media/[mediaId]/route',
      { params: Promise.resolve({ id: 'course-draft', mediaId: 'draft-image-1' }) },
      'http://localhost/api/courses/course-draft/media/draft-image-1',
    );
    expect(draftMediaResponse.status).toBe(200);
    expect(Buffer.from(await draftMediaResponse.arrayBuffer()).toString('utf8')).toBe(
      'draft-image',
    );
  });
});
