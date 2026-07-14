import { describe, expect, test } from 'vitest';

import {
  createEnterpriseStorageService,
  type EnterpriseCourse,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import type { StoredHostApiKey } from '@/lib/host-api/access';

const learnerRole = { id: 'role-learner', code: 'learner', name: 'Learner', isAdmin: false };

function makeCourse(patch: Partial<EnterpriseCourse> = {}): EnterpriseCourse {
  return {
    id: 'course-1',
    name: 'Draft Course',
    description: null,
    categoryId: 'cat-1',
    categoryName: 'Default',
    status: 'draft',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...patch,
  };
}

function makeRepository(course: EnterpriseCourse = makeCourse()): EnterpriseRepository {
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
    async getRoleUsage() {
      return { users: 0, inviteCodes: 0, examPolicies: 0 };
    },
    async deleteRole() {
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
    async deleteInviteCode() {
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
      return id === course.id
        ? { ...course, status: 'published', publishedAt: new Date('2026-07-01T01:00:00Z') }
        : null;
    },
    async archiveCourse(id) {
      return id === course.id ? { ...course, status: 'archived' } : null;
    },
    async deleteCourse(id) {
      return id === course.id ? course : null;
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
    async getCourseProgress() {
      return null;
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
        learnerCount: 0,
        courseCount: 1,
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
    async deleteExamPolicy() {
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

describe('Slice-03 course publishing service', () => {
  test('rejects role-scoped visibility without at least one role', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.updateCourseVisibility('course-1', {
        visibilityMode: 'roles',
        visibleRoleIds: [],
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'At least one role is required for role visibility',
    });
  });

  test('rejects publishing a role-scoped course before roles are selected', async () => {
    const service = createEnterpriseStorageService(
      makeRepository(makeCourse({ visibilityMode: 'roles', visibleRoleIds: [] })),
    );

    await expect(service.publishCourse('course-1')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'At least one role is required before publishing a role-visible course',
    });
  });

  test('returns an assessment mismatch warning when course content changes after questions exist', async () => {
    const service = createEnterpriseStorageService(
      makeRepository(makeCourse({ assessmentQuestions: [{ id: 'q1' }] })),
    );

    await expect(
      service.replaceCourseContent('course-1', {
        scenes: [{ id: 'scene-1' }],
        outlines: [{ id: 'outline-1' }],
      }),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      assessmentMismatchWarning: true,
    });
  });
});
