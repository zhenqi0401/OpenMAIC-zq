import { describe, expect, test, vi } from 'vitest';

import type { AuthRole } from '@/lib/auth/service';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import {
  createEnterpriseStorageService,
  type EnterpriseAssessmentAttempt,
  type EnterpriseAssessmentAttemptInput,
  type EnterpriseCourse,
  type EnterpriseCourseProgress,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import type { QuizQuestion } from '@/lib/types/stage';

const learnerRole: AuthRole = {
  id: 'role-learner',
  code: 'learner',
  name: 'Learner',
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
    analysis: 'Use the standard operating process.',
    points: 1,
    ...overrides,
  };
}

function makeCourse(patch: Partial<EnterpriseCourse> = {}): EnterpriseCourse {
  return {
    id: 'course-1',
    name: 'Published Course',
    description: null,
    categoryId: 'cat-1',
    categoryName: 'Default',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [
      question({ id: 'single', type: 'single' }),
      question({ id: 'multi', type: 'multiple', answer: ['A', 'B'] }),
      question({ id: 'short', type: 'short_answer', answer: undefined }),
    ],
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...patch,
  };
}

function makeProgress(completed = true): EnterpriseCourseProgress {
  return {
    userId: 'learner-1',
    courseId: 'course-1',
    sceneIndex: completed ? 2 : 0,
    actionIndex: completed ? 5 : 0,
    completed,
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}

function makeAttempt(
  patch: Partial<EnterpriseAssessmentAttempt> = {},
): EnterpriseAssessmentAttempt {
  return {
    id: `attempt-${patch.attemptNumber ?? 1}`,
    userId: 'learner-1',
    courseId: 'course-1',
    roleSnapshot: 'learner',
    attemptNumber: 1,
    score: 100,
    passed: true,
    threshold: 80,
    answers: { single: 'A', multi: ['A', 'B'] },
    details: [],
    createdAt: new Date('2026-07-01T00:00:00Z'),
    ...patch,
  };
}

function makeRepository(
  options: {
    course?: EnterpriseCourse;
    progress?: EnterpriseCourseProgress | null;
    attempts?: EnterpriseAssessmentAttempt[];
  } = {},
): EnterpriseRepository {
  const course = options.course ?? makeCourse();
  const attempts = [...(options.attempts ?? [])];
  let progress = options.progress === undefined ? makeProgress(true) : options.progress;

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
      return makeCourse({ ...input, status: 'draft' });
    },
    async updateCourse(id, patch) {
      return id === course.id ? { ...course, ...patch } : null;
    },
    async updateCourseVisibility(id, visibility) {
      return id === course.id ? { ...course, ...visibility } : null;
    },
    async publishCourse(id) {
      return id === course.id ? { ...course, status: 'published' } : null;
    },
    async archiveCourse(id) {
      return id === course.id ? { ...course, status: 'archived' } : null;
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
      return progress && progress.userId === userId && progress.courseId === courseId
        ? progress
        : null;
    },
    async upsertCourseProgress(input) {
      progress = { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
      return progress;
    },
    async listCourseAssessmentAttempts(userId, courseId) {
      return attempts.filter(
        (attempt) => attempt.userId === userId && attempt.courseId === courseId,
      );
    },
    async createAssessmentAttempt(input: EnterpriseAssessmentAttemptInput) {
      const attempt = makeAttempt({
        ...input,
        id: `attempt-${input.attemptNumber}`,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      });
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
      return attempts.map((attempt) => ({
        id: attempt.id,
        userId: attempt.userId,
        displayName: 'Learner',
        roleId: learnerRole.id,
        roleCode: learnerRole.code,
        courseId: attempt.courseId,
        courseName: course.name,
        score: attempt.score,
        passed: attempt.passed,
        attemptNumber: attempt.attemptNumber,
        createdAt: attempt.createdAt,
      }));
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

describe('Slice-04 course assessment service', () => {
  test('returns only choice questions for a visible course assessment', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.getCourseAssessment({
        courseId: 'course-1',
        userId: 'learner-1',
        roleId: learnerRole.id,
      }),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      threshold: 80,
      canAttempt: true,
      questions: [{ id: 'single' }, { id: 'multi' }],
    });
  });

  test('stores passed attempts with incrementing attempt numbers and role snapshots', async () => {
    const service = createEnterpriseStorageService(
      makeRepository({ attempts: [makeAttempt({ attemptNumber: 1 })] }),
    );

    await expect(
      service.submitCourseAssessment({
        courseId: 'course-1',
        userId: 'learner-1',
        roleId: learnerRole.id,
        roleSnapshot: learnerRole.code,
        answers: { single: 'A', multi: ['B', 'A'] },
      }),
    ).resolves.toMatchObject({
      attempt: {
        attemptNumber: 2,
        score: 100,
        passed: true,
        roleSnapshot: 'learner',
      },
      requiresRelearning: false,
    });
  });

  test('failed attempts reset progress and block immediate reattempt until relearning completes', async () => {
    const repository = makeRepository();
    const service = createEnterpriseStorageService(repository);

    const failed = await service.submitCourseAssessment({
      courseId: 'course-1',
      userId: 'learner-1',
      roleId: learnerRole.id,
      roleSnapshot: learnerRole.code,
      answers: { single: 'B', multi: ['A', 'B'] },
    });

    expect(failed).toMatchObject({
      attempt: { score: 50, passed: false },
      requiresRelearning: true,
    });
    await expect(repository.getCourseProgress('learner-1', 'course-1')).resolves.toMatchObject({
      sceneIndex: 0,
      actionIndex: 0,
      completed: false,
    });

    await expect(
      service.submitCourseAssessment({
        courseId: 'course-1',
        userId: 'learner-1',
        roleId: learnerRole.id,
        roleSnapshot: learnerRole.code,
        answers: { single: 'A', multi: ['A', 'B'] },
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Course learning must be completed before assessment',
    });
  });

  test('regenerates post-course assessment questions with AI instead of extracting quiz scenes', async () => {
    const service = createEnterpriseStorageService(
      makeRepository({
        course: makeCourse({ assessmentQuestions: [] }),
      }),
    );
    const aiCall = vi.fn(async () =>
      JSON.stringify([
        {
          id: 'ai-generated',
          type: 'single',
          question: 'Which action best matches the generated course content?',
          options: ['Follow the standard process', 'Skip the process'],
          correctAnswer: 'Follow the standard process',
          analysis: 'The course emphasizes following the standard process.',
          points: 10,
        },
        {
          id: 'short',
          type: 'short_answer',
          question: 'Explain the course',
        },
      ]),
    );

    await expect(
      service.regenerateCourseAssessment('course-1', {
        aiCall,
        languageDirective: 'Use Simplified Chinese.',
      }),
    ).resolves.toMatchObject({
      assessmentQuestions: [{ id: 'ai-generated', type: 'single', answer: ['A'] }],
    });
    expect(aiCall).toHaveBeenCalledTimes(1);
    expect(aiCall.mock.calls[0]?.[1]).toContain('Published Course');
  });
});
