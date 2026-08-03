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

function repository() {
  const courses = [platform, tenantA, tenantB];
  return {
    listAdminCourses: vi.fn(async () => courses),
    getCourseContent: vi.fn(async (id: string) => {
      const found = courses.find((item) => item.id === id);
      return found ? { course: found, scenes: [], outlines: [] } : null;
    }),
    listMediaFiles: vi.fn(async () => []),
    listCourseAudioBlobs: vi.fn(async () => []),
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
