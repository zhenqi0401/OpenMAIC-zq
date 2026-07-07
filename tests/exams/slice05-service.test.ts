import { describe, expect, test } from 'vitest';

import type { AuthRole } from '@/lib/auth/service';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import {
  createEnterpriseStorageService,
  type EnterpriseAssessmentAttemptInput,
  type EnterpriseCourse,
  type EnterpriseExamAttempt,
  type EnterpriseExamAttemptInput,
  type EnterpriseExamPolicy,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import type { StageExamQuestionRef } from '@/lib/exams/stage-exam';
import type { QuizQuestion } from '@/lib/types/stage';

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

function course(overrides: Partial<EnterpriseCourse>): EnterpriseCourse {
  return {
    id: 'course-sales',
    name: 'Sales Course',
    description: null,
    categoryId: 'cat-sales',
    categoryName: 'Sales',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRepository(): EnterpriseRepository {
  const courses = [
    course({
      id: 'course-sales',
      categoryId: 'cat-sales',
      assessmentQuestions: [
        question({ id: 'assessment-single', type: 'single', answer: ['A'] }),
        question({ id: 'assessment-multiple', type: 'multiple', answer: ['A', 'B'] }),
        question({ id: 'assessment-short', type: 'short_answer', answer: undefined }),
        question({ id: 'assessment-no-answer', type: 'single', answer: [] }),
      ],
    }),
    course({
      id: 'course-sales-2',
      name: 'Advanced Sales',
      categoryId: 'cat-sales',
      assessmentQuestions: [question({ id: 'assessment-other-course', type: 'single' })],
    }),
    course({
      id: 'course-ops',
      name: 'Ops Course',
      categoryId: 'cat-ops',
      categoryName: 'Ops',
      assessmentQuestions: [question({ id: 'assessment-ops', type: 'single' })],
    }),
    course({
      id: 'course-draft',
      status: 'draft',
      assessmentQuestions: [question({ id: 'assessment-draft', type: 'single' })],
      publishedAt: null,
    }),
  ];
  const content = new Map<string, { scenes: unknown[]; outlines: unknown[] }>([
    [
      'course-sales',
      {
        scenes: [
          {
            id: 'scene-quiz',
            type: 'quiz',
            content: {
              type: 'quiz',
              questions: [
                question({ id: 'scene-single', type: 'single', answer: ['A'] }),
                question({ id: 'scene-multiple', type: 'multiple', answer: ['A', 'B'] }),
                question({ id: 'scene-short', type: 'short_answer', answer: undefined }),
                question({ id: 'scene-no-answer', type: 'single', answer: [] }),
              ],
            },
          },
        ],
        outlines: [],
      },
    ],
    ['course-sales-2', { scenes: [], outlines: [] }],
    ['course-ops', { scenes: [], outlines: [] }],
    ['course-draft', { scenes: [], outlines: [] }],
  ]);
  const policies: EnterpriseExamPolicy[] = [
    {
      id: 'policy-sales-all',
      title: 'Sales Stage Exam',
      targetRoleId: salesRole.id,
      categoryIds: ['cat-sales'],
      courseIds: [],
      questionCount: 3,
      passThreshold: 80,
      timeLimitMinutes: 45,
      status: 'published',
    },
    {
      id: 'policy-sales-course',
      title: 'Sales Course Exam',
      targetRoleId: salesRole.id,
      categoryIds: ['cat-sales'],
      courseIds: ['course-sales'],
      questionCount: 4,
      passThreshold: 75,
      timeLimitMinutes: null,
      status: 'published',
    },
    {
      id: 'policy-ops',
      title: 'Ops Stage Exam',
      targetRoleId: opsRole.id,
      categoryIds: ['cat-ops'],
      courseIds: [],
      questionCount: 2,
      passThreshold: 80,
      timeLimitMinutes: 30,
      status: 'published',
    },
    {
      id: 'policy-draft',
      title: 'Draft Exam',
      targetRoleId: salesRole.id,
      categoryIds: ['cat-sales'],
      courseIds: [],
      questionCount: 2,
      passThreshold: 80,
      timeLimitMinutes: null,
      status: 'draft',
    },
  ];
  const examAttempts: EnterpriseExamAttempt[] = [
    {
      id: 'attempt-existing',
      examPolicyId: 'policy-sales-course',
      userId: 'learner-1',
      roleSnapshot: 'sales',
      attemptNumber: 1,
      score: 50,
      passed: false,
      threshold: 75,
      duration: 300,
      answers: {},
      details: [],
      questionRefs: [],
      createdAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];

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
      return [
        { id: 'cat-sales', name: 'Sales', sortOrder: 0 },
        { id: 'cat-ops', name: 'Ops', sortOrder: 1 },
      ];
    },
    async createCategory() {
      throw new Error('not used');
    },
    async updateCategory() {
      throw new Error('not used');
    },
    async listAdminCourses() {
      return courses;
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
    async getCourseContent(id) {
      const found = courses.find((candidate) => candidate.id === id);
      if (!found) return null;
      const saved = content.get(id) ?? { scenes: [], outlines: [] };
      return { course: found, scenes: saved.scenes, outlines: saved.outlines };
    },
    async replaceCourseContent(courseId, input) {
      content.set(courseId, input);
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
      const passed = examAttempts.filter((attempt) => attempt.passed).length;
      return {
        courseCompletionRate: 0,
        assessmentPassRate: 0,
        examPassRate: examAttempts.length ? Math.round((passed / examAttempts.length) * 100) : 0,
        learnerCount: 1,
        courseCount: courses.length,
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
        examTitle: 'Sales Course Exam',
        score: attempt.score,
        passed: attempt.passed,
        attemptNumber: attempt.attemptNumber,
        createdAt: attempt.createdAt,
      }));
    },
    async listExamPolicies() {
      return policies;
    },
    async createExamPolicy(input) {
      const policy: EnterpriseExamPolicy = {
        id: `policy-${policies.length + 1}`,
        status: 'draft',
        ...input,
      };
      policies.push(policy);
      return policy;
    },
    async updateExamPolicy(id, patch) {
      const policy = policies.find((candidate) => candidate.id === id);
      if (!policy) return null;
      Object.assign(policy, patch);
      return policy;
    },
    async publishExamPolicy(id) {
      const policy = policies.find((candidate) => candidate.id === id);
      if (!policy) return null;
      policy.status = 'published';
      return policy;
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

describe('Slice-05 stage exam service', () => {
  test('shows only published exams for the current learner role with candidate counts', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.listAvailableExams(salesRole.id)).resolves.toMatchObject([
      { id: 'policy-sales-all', targetRoleId: salesRole.id, candidateQuestionCount: 5 },
      { id: 'policy-sales-course', targetRoleId: salesRole.id, candidateQuestionCount: 4 },
    ]);
    await expect(service.listAvailableExams(opsRole.id)).resolves.toMatchObject([
      { id: 'policy-ops', targetRoleId: opsRole.id, candidateQuestionCount: 1 },
    ]);
  });

  test('starts an exam by drawing only answerable choice questions from selected categories and courses', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    const exam = await service.startStageExam({
      examPolicyId: 'policy-sales-course',
      roleId: salesRole.id,
    });

    expect(exam.questions).toHaveLength(4);
    expect(exam.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'scene-single', type: 'single' }),
        expect.objectContaining({ id: 'scene-multiple', type: 'multiple' }),
        expect.objectContaining({ id: 'assessment-single', type: 'single' }),
        expect.objectContaining({ id: 'assessment-multiple', type: 'multiple' }),
      ]),
    );
    expect(exam.questions.every((question) => !('answer' in question))).toBe(true);
    expect(exam.questionRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ courseId: 'course-sales', questionId: 'scene-single' }),
        expect.objectContaining({ courseId: 'course-sales', questionId: 'assessment-single' }),
      ]),
    );
    expect(exam.questionRefs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ courseId: 'course-sales-2' }),
        expect.objectContaining({ questionId: 'scene-short' }),
        expect.objectContaining({ questionId: 'scene-no-answer' }),
      ]),
    );
  });

  test('rejects role-mismatched learners before starting exams', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.startStageExam({
        examPolicyId: 'policy-sales-course',
        roleId: opsRole.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('submits scores to exam_attempts and exposes the result to dashboard queries', async () => {
    const repository = makeRepository();
    const service = createEnterpriseStorageService(repository);
    const started = await service.startStageExam({
      examPolicyId: 'policy-sales-course',
      roleId: salesRole.id,
    });
    const answers = Object.fromEntries(
      started.questions.map((question) => [
        question.id,
        question.type === 'multiple' ? ['A', 'B'] : 'A',
      ]),
    );

    const result = await service.submitStageExam({
      examPolicyId: 'policy-sales-course',
      userId: 'learner-1',
      roleId: salesRole.id,
      roleSnapshot: salesRole.code,
      answers,
      questionRefs: started.questionRefs as StageExamQuestionRef[],
      durationSeconds: 420,
    });

    expect(result.attempt).toMatchObject({
      attemptNumber: 2,
      score: 100,
      passed: true,
      threshold: 75,
      duration: 420,
      roleSnapshot: 'sales',
      questionRefs: started.questionRefs,
    });
    await expect(repository.listExamAttempts()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.attempt.id,
          score: 100,
          passed: true,
          attemptNumber: 2,
        }),
      ]),
    );
    await expect(service.getDashboard()).resolves.toMatchObject({
      summary: { examAttemptCount: 2, examPassRate: 50 },
    });
  });
});
