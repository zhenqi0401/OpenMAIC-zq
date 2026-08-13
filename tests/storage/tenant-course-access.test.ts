import { describe, expect, test, vi } from 'vitest';

import {
  createEnterpriseStorageService,
  EnterpriseStorageServiceError,
  type EnterpriseCourse,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import type { TenantAccessContext } from '@/lib/auth/types';

const now = new Date('2026-08-03T00:00:00Z');

function course(
  id: string,
  input: Partial<EnterpriseCourse> & Pick<EnterpriseCourse, 'scope' | 'tenantId'>,
): EnterpriseCourse {
  return {
    id,
    name: id,
    description: null,
    categoryId: `category-${id}`,
    categoryName: 'Category',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    managementMode: input.scope === 'platform' ? 'read_only' : 'editable',
    ...input,
  };
}

const platform = course('platform', { scope: 'platform', tenantId: null });
const tenantA = course('tenant-a-course', { scope: 'tenant', tenantId: 'tenant-a' });
const tenantB = course('tenant-b-course', { scope: 'tenant', tenantId: 'tenant-b' });

function summary(value: EnterpriseCourse): EnterpriseCourse {
  const { stageSnapshot: _stageSnapshot, assessmentQuestions, ...rest } = value;
  return { ...rest, assessmentQuestions: [], assessmentQuestionCount: assessmentQuestions.length };
}

function repository() {
  const courses = [platform, tenantA, tenantB];
  return {
    listAdminCourses: vi.fn(async () => courses),
    listCourseSummaries: vi.fn(async () => courses.map(summary)),
    getCourseContent: vi.fn(async (id: string) => {
      const found = courses.find((item) => item.id === id);
      return found ? { course: found, scenes: [], outlines: [] } : null;
    }),
    listMediaFiles: vi.fn(async () => []),
    listCourseAudioBlobs: vi.fn(async () => []),
    getCourseProgress: vi.fn(async () => null),
    listCourseAssessmentAttempts: vi.fn(async () => []),
    updateCourse: vi.fn(async (id: string) => courses.find((item) => item.id === id) ?? null),
  } as unknown as EnterpriseRepository;
}

const learnerA: TenantAccessContext = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  roleId: 'role-a',
  isAdmin: false,
};
const adminA = { ...learnerA, isAdmin: true };

describe('tenant course authorization boundary', () => {
  test('learners see platform courses and their own tenant courses, never another tenant', async () => {
    const service = createEnterpriseStorageService(repository());

    await expect(service.listVisibleCourses(learnerA)).resolves.toMatchObject([
      { id: 'platform', managementMode: 'read_only' },
      { id: 'tenant-a-course', managementMode: 'editable' },
    ]);
    await expect(service.getVisibleCourse('tenant-b-course', learnerA)).resolves.toBeNull();
  });

  test('lightweight summaries keep tenant and role visibility checks before user-meta lookup', async () => {
    const restrictedOwn = course('tenant-a-restricted', {
      scope: 'tenant',
      tenantId: 'tenant-a',
      visibilityMode: 'roles',
      visibleRoleIds: ['role-other'],
    });
    const restrictedOther = course('tenant-b-restricted', {
      scope: 'tenant',
      tenantId: 'tenant-b',
      visibilityMode: 'roles',
      visibleRoleIds: ['role-a'],
    });
    const repo = repository();
    vi.mocked(repo.listCourseSummaries!).mockResolvedValue([
      summary(platform),
      summary(tenantA),
      summary(tenantB),
      summary(restrictedOwn),
      summary(restrictedOther),
    ]);
    const getLearnerCourseMeta = vi.fn(async () => new Map());
    Object.assign(repo, { getLearnerCourseMeta });
    const service = createEnterpriseStorageService(repo);

    await expect(service.listVisibleCourses(learnerA)).resolves.toMatchObject([
      { id: 'platform' },
      { id: 'tenant-a-course' },
    ]);
    expect(getLearnerCourseMeta).toHaveBeenCalledWith('user-a', [
      'platform',
      'tenant-a-course',
    ]);
  });

  test('tenant admin summaries contain platform and own-tenant courses only', async () => {
    const repo = repository();
    const service = createEnterpriseStorageService(repo, adminA);

    await expect(service.listCourseSummaries()).resolves.toMatchObject([
      { id: 'platform', managementMode: 'read_only' },
      { id: 'tenant-a-course', managementMode: 'editable' },
    ]);
  });

  test('tenant admins receive 403 for platform writes and 404 for another tenant', async () => {
    const repo = repository();
    const service = createEnterpriseStorageService(repo);

    await expect(
      service.updateCourse('platform', { name: 'changed' }, adminA),
    ).rejects.toMatchObject(new EnterpriseStorageServiceError('FORBIDDEN', '平台精品课程只读'));
    await expect(
      service.updateCourse('tenant-b-course', { name: 'changed' }, adminA),
    ).rejects.toMatchObject(new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found'));
    expect(repo.updateCourse).not.toHaveBeenCalled();
  });
});
