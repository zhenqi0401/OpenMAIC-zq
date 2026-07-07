import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult } from '@/lib/auth/service';
import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';
import { hashHostApiSecret } from '@/lib/security/host-api-key';

const mocks = vi.hoisted(() => ({
  repository: null as EnterpriseRepository | null,
  current: null as AuthResult | null,
  admin: null as AuthResult | Response | null,
  callLLM: vi.fn(),
  resolveModelFromRequest: vi.fn(),
}));

vi.mock('@/lib/storage/enterprise-repository', () => ({
  getEnterpriseRepository: () => mocks.repository,
}));

vi.mock('@/lib/auth/current-session', () => ({
  getCurrentAuthResult: async () => mocks.current,
  requireCurrentAdmin: async () => mocks.admin,
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: mocks.callLLM,
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: mocks.resolveModelFromRequest,
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

function makeRepository(): EnterpriseRepository {
  const course = {
    id: 'course-1',
    name: 'Published Course',
    description: null,
    categoryId: 'cat-1',
    categoryName: 'Default',
    status: 'published' as const,
    visibilityMode: 'all' as const,
    visibleRoleIds: [],
    assessmentQuestions: [
      {
        id: 'q1',
        type: 'single' as const,
        question: 'Pick one',
        options: [
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ],
        answer: ['A'],
        analysis: 'Because A is correct.',
        points: 1,
      },
    ],
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
  const attempts: Awaited<ReturnType<EnterpriseRepository['listCourseAssessmentAttempts']>> = [];
  let progress = {
    userId: 'learner-1',
    courseId: 'course-1',
    sceneIndex: 1,
    actionIndex: 1,
    completed: true,
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };

  return {
    async listRoles() {
      return [learnerRole];
    },
    async createRole() {
      throw new Error('not used');
    },
    async updateRole() {
      throw new Error('not used');
    },
    async listInviteCodes() {
      return [];
    },
    async createInviteCode() {
      throw new Error('not used');
    },
    async updateInviteCode() {
      throw new Error('not used');
    },
    async listCategories() {
      return [{ id: 'cat-1', name: 'Default', sortOrder: 0 }];
    },
    async createCategory(input) {
      return { id: 'cat-new', sortOrder: 0, ...input };
    },
    async updateCategory(id, patch) {
      return { id, name: patch.name ?? 'Default', sortOrder: patch.sortOrder ?? 0 };
    },
    async listAdminCourses() {
      return [course];
    },
    async createCourse(input) {
      return { ...course, ...input, id: 'course-new', status: 'draft' as const };
    },
    async updateCourse(id, patch) {
      return id === course.id ? { ...course, ...patch } : null;
    },
    async updateCourseVisibility(id, visibility) {
      return id === course.id ? { ...course, ...visibility } : null;
    },
    async publishCourse(id) {
      return id === course.id ? course : null;
    },
    async archiveCourse(id) {
      return id === course.id ? { ...course, status: 'archived' as const } : null;
    },
    async getCourseContent(id) {
      return id === course.id ? { course, scenes: [], outlines: [] } : null;
    },
    async replaceCourseContent(courseId, input) {
      return { courseId, scenes: input.scenes, outlines: input.outlines };
    },
    async updateCourseAssessmentQuestions(id, questions) {
      return id === course.id ? { ...course, assessmentQuestions: questions } : null;
    },
    async getCourseProgress(userId, courseId) {
      return progress.userId === userId && progress.courseId === courseId ? progress : null;
    },
    async upsertCourseProgress(input) {
      progress = { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
      return progress;
    },
    async listCourseAssessmentAttempts() {
      return attempts;
    },
    async createAssessmentAttempt(input) {
      const attempt = {
        ...input,
        id: `attempt-${input.attemptNumber}`,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
      attempts.push(attempt);
      return attempt;
    },
    async getDashboardSummary() {
      return {
        courseCompletionRate: 0,
        assessmentPassRate: 0,
        examPassRate: 0,
        learnerCount: 1,
        courseCount: 1,
        assessmentAttemptCount: attempts.length,
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
      return [];
    },
    async createExamPolicy() {
      throw new Error('not used');
    },
    async updateExamPolicy() {
      throw new Error('not used');
    },
    async publishExamPolicy() {
      throw new Error('not used');
    },
    async listExamAttemptsForUser() {
      return [];
    },
    async createExamAttempt() {
      throw new Error('not used');
    },
    async findHostApiKey(keyId) {
      return keyId === 'host_demo'
        ? { keyId, secretHash: hashHostApiSecret('sk_demo'), enabled: true }
        : null;
    },
    async touchHostApiKey() {},
    async createMediaFile() {
      throw new Error('not used');
    },
    async listMediaFiles() {
      return [];
    },
    async getMediaFileBlob() {
      return null;
    },
    async createCourseAudioBlob() {
      throw new Error('not used');
    },
    async listCourseAudioBlobs() {
      return [];
    },
    async getCourseAudioBlob() {
      return null;
    },
  };
}

async function getRoute(route: string, context: { params: Promise<{ id: string }> }) {
  const routeModule = (await import(route)) as {
    GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return routeModule.GET(new Request('http://localhost/test'), context);
}

async function postRoute(
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

describe('Slice-04 assessment API routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.repository = makeRepository();
    mocks.current = learnerAuth;
    mocks.admin = adminAuth;
    mocks.callLLM.mockReset();
    mocks.resolveModelFromRequest.mockReset();
    mocks.resolveModelFromRequest.mockResolvedValue({
      model: {},
      modelInfo: { outputWindow: 4000 },
      modelString: 'mock:model',
      thinkingConfig: undefined,
    });
    mocks.callLLM.mockResolvedValue({
      text: JSON.stringify([
        {
          id: 'ai-generated',
          type: 'single',
          question: 'What should the learner do?',
          options: ['Apply the course process', 'Ignore the course process'],
          correctAnswer: 'Apply the course process',
          analysis: 'The course process is the expected answer.',
          points: 10,
        },
      ]),
    });
  });

  test('learner can fetch choice-only course assessment', async () => {
    const response = await getRoute('@/app/api/courses/[id]/assessment/route', {
      params: Promise.resolve({ id: 'course-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assessment: {
        courseId: 'course-1',
        questions: [{ id: 'q1', type: 'single' }],
      },
    });
  });

  test('learner can submit an assessment attempt without quiz-grade API', async () => {
    const response = await postRoute(
      '@/app/api/courses/[id]/assessment/attempts/route',
      { answers: { q1: 'A' } },
      { params: Promise.resolve({ id: 'course-1' }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        attempt: { score: 100, passed: true, attemptNumber: 1 },
        requiresRelearning: false,
      },
    });
  });

  test('admin can edit course assessment questions while short answers are filtered out', async () => {
    const response = await patchRoute(
      '@/app/api/admin/courses/[id]/assessment/route',
      {
        questions: [
          { id: 'choice', type: 'single', question: 'Pick one', answer: ['A'] },
          { id: 'short', type: 'short_answer', question: 'Explain' },
        ],
      },
      { params: Promise.resolve({ id: 'course-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      course: { assessmentQuestions: [{ id: 'choice' }] },
    });
  });

  test('admin regenerate creates post-course assessment questions with AI', async () => {
    const response = await postRoute(
      '@/app/api/admin/courses/[id]/assessment/regenerate/route',
      { languageDirective: 'Use Simplified Chinese.' },
      { params: Promise.resolve({ id: 'course-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveModelFromRequest).toHaveBeenCalled();
    expect(mocks.callLLM).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      course: { assessmentQuestions: [{ id: 'ai-generated', type: 'single', answer: ['A'] }] },
    });
  });
});
