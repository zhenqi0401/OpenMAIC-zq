import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult, AuthRole } from '@/lib/auth/service';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import type {
  EnterpriseAssessmentAttemptInput,
  EnterpriseCourse,
  EnterpriseExamAttempt,
  EnterpriseExamAttemptInput,
  EnterpriseExamPolicy,
  EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import type { QuizQuestion } from '@/lib/types/stage';

const mocks = vi.hoisted(() => ({
  repository: null as EnterpriseRepository | null,
  current: null as AuthResult | null,
}));

vi.mock('@/lib/storage/enterprise-repository', () => ({
  getEnterpriseRepository: () => mocks.repository,
}));

vi.mock('@/lib/auth/current-session', () => ({
  getCurrentAuthResult: async () => mocks.current,
}));

const salesRole: AuthRole = {
  id: 'role-sales',
  code: 'sales',
  name: 'Sales',
  isAdmin: false,
};

const opsRole: AuthRole = {
  id: 'role-ops',
  code: 'ops',
  name: 'Ops',
  isAdmin: false,
};

const learnerAuth: AuthResult = {
  user: {
    id: 'learner-1',
    phone: '13800138000',
    passwordHash: null,
    hostUserId: null,
    roleId: salesRole.id,
    status: 'active',
    displayName: 'Learner',
  },
  role: salesRole,
  identity: {
    userId: 'learner-1',
    roleId: salesRole.id,
    roleCode: salesRole.code,
    isAdmin: false,
    authSource: 'password',
  },
};

function question(overrides: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q1',
    type: 'single',
    question: 'Pick one',
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
    ],
    answer: ['A'],
    hasAnswer: true,
    points: 10,
    ...overrides,
  };
}

function makeCourse(patch: Partial<EnterpriseCourse> = {}): EnterpriseCourse {
  return {
    id: 'course-sales',
    name: 'Sales Course',
    description: null,
    categoryId: 'cat-sales',
    categoryName: 'Sales',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [question({ id: 'assessment-single' })],
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...patch,
  };
}

function makeRepository(): EnterpriseRepository {
  const course = makeCourse();
  const policies: EnterpriseExamPolicy[] = [
    {
      id: 'policy-sales',
      title: 'Sales Exam',
      targetRoleId: salesRole.id,
      categoryIds: ['cat-sales'],
      courseIds: [],
      questionCount: 2,
      passThreshold: 80,
      timeLimitMinutes: 30,
      status: 'published',
    },
    {
      id: 'policy-ops',
      title: 'Ops Exam',
      targetRoleId: opsRole.id,
      categoryIds: ['cat-sales'],
      courseIds: [],
      questionCount: 1,
      passThreshold: 80,
      timeLimitMinutes: null,
      status: 'published',
    },
  ];
  const examAttempts: EnterpriseExamAttempt[] = [];

  return {
    async listRoles() {
      return [salesRole, opsRole];
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
      return [{ id: 'cat-sales', name: 'Sales', sortOrder: 0 }];
    },
    async createCategory() {
      throw new Error('not used');
    },
    async updateCategory() {
      throw new Error('not used');
    },
    async listAdminCourses() {
      return [course];
    },
    async createCourse() {
      throw new Error('not used');
    },
    async updateCourse() {
      throw new Error('not used');
    },
    async updateCourseVisibility() {
      throw new Error('not used');
    },
    async publishCourse() {
      throw new Error('not used');
    },
    async archiveCourse() {
      throw new Error('not used');
    },
    async deleteCourse() {
      throw new Error('not used');
    },
    async getCourseContent(id) {
      if (id !== course.id) return null;
      return {
        course,
        scenes: [
          {
            id: 'scene-quiz',
            type: 'quiz',
            content: {
              type: 'quiz',
              questions: [
                question({ id: 'scene-single', type: 'single', answer: ['A'] }),
                question({ id: 'scene-short', type: 'short_answer', answer: undefined }),
              ],
            },
          },
        ],
        outlines: [],
      };
    },
    async replaceCourseContent(courseId, input) {
      return { courseId, scenes: input.scenes, outlines: input.outlines };
    },
    async updateCourseAssessmentQuestions() {
      throw new Error('not used');
    },
    async getCourseProgress() {
      return null;
    },
    async upsertCourseProgress(input) {
      return { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
    },
    async listCourseAssessmentAttempts() {
      return [];
    },
    async createAssessmentAttempt(input: EnterpriseAssessmentAttemptInput) {
      return {
        id: 'assessment-attempt',
        ...input,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async getDashboardSummary() {
      return {
        courseCompletionRate: 0,
        assessmentPassRate: 0,
        examPassRate: examAttempts.length ? 100 : 0,
        learnerCount: 1,
        courseCount: 1,
        assessmentAttemptCount: 0,
        examAttemptCount: examAttempts.length,
      };
    },
    async listCourseProgress() {
      return [];
    },
    async listAssessmentAttempts() {
      return [];
    },
    async listExamAttempts() {
      return examAttempts.map((attempt) => ({
        id: attempt.id,
        userId: attempt.userId,
        displayName: 'Learner',
        roleId: salesRole.id,
        roleCode: salesRole.code,
        examPolicyId: attempt.examPolicyId,
        examTitle: 'Sales Exam',
        score: attempt.score,
        passed: attempt.passed,
        attemptNumber: attempt.attemptNumber,
        createdAt: attempt.createdAt,
      }));
    },
    async listExamPolicies() {
      return policies;
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
    async listExamAttemptsForUser(examPolicyId, userId) {
      return examAttempts.filter(
        (attempt) => attempt.examPolicyId === examPolicyId && attempt.userId === userId,
      );
    },
    async createExamAttempt(input: EnterpriseExamAttemptInput) {
      const attempt: EnterpriseExamAttempt = {
        id: `exam-attempt-${examAttempts.length + 1}`,
        ...input,
        createdAt: new Date('2026-07-01T01:00:00Z'),
      };
      examAttempts.push(attempt);
      return attempt;
    },
    async findHostApiKey(): Promise<StoredHostApiKey | null> {
      return null;
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

async function getRoute(route: string, url = 'http://localhost/test') {
  const routeModule = (await import(route)) as { GET: (request: Request) => Promise<Response> };
  return routeModule.GET(new Request(url));
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

describe('Slice-05 stage exam API routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.repository = makeRepository();
    mocks.current = learnerAuth;
  });

  test('learner sees only published exams for the current role', async () => {
    const response = await getRoute('@/app/api/exams/route');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      exams: [{ id: 'policy-sales', targetRoleId: salesRole.id, candidateQuestionCount: 2 }],
    });
  });

  test('learner starts a role-matched exam without receiving answer keys', async () => {
    const response = await postRoute(
      '@/app/api/exams/[id]/start/route',
      {},
      { params: Promise.resolve({ id: 'policy-sales' }) },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      exam: { questions: Array<Record<string, unknown>>; questionRefs: unknown[] };
    };
    expect(data.exam.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'scene-single', type: 'single' }),
        expect.objectContaining({ id: 'assessment-single', type: 'single' }),
      ]),
    );
    expect(data.exam.questions.every((question) => !('answer' in question))).toBe(true);
    expect(data.exam.questionRefs).toHaveLength(2);
  });

  test('learner submits a started exam attempt that is persisted by the repository', async () => {
    const start = await postRoute(
      '@/app/api/exams/[id]/start/route',
      {},
      { params: Promise.resolve({ id: 'policy-sales' }) },
    );
    const startData = (await start.json()) as {
      exam: {
        questions: Array<{ id: string; type: 'single' | 'multiple' }>;
        questionRefs: unknown[];
      };
    };
    const answers = Object.fromEntries(
      startData.exam.questions.map((question) => [question.id, 'A']),
    );

    const response = await postRoute(
      '@/app/api/exams/[id]/attempts/route',
      { answers, questionRefs: startData.exam.questionRefs, durationSeconds: 180 },
      { params: Promise.resolve({ id: 'policy-sales' }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        attempt: {
          score: 100,
          passed: true,
          attemptNumber: 1,
          duration: 180,
          roleSnapshot: 'sales',
        },
      },
    });
    await expect(mocks.repository?.listExamAttempts()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ examPolicyId: 'policy-sales', score: 100, passed: true }),
      ]),
    );
  });
});
