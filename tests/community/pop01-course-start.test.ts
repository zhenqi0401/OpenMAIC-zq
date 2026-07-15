import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult } from '@/lib/auth/service';
import type {
  EnterpriseCourseProgress,
  EnterpriseRepository,
} from '@/lib/storage/enterprise-service';

const mocks = vi.hoisted(() => ({
  current: null as AuthResult | null,
  repository: null as EnterpriseRepository | null,
}));

vi.mock('@/lib/auth/current-session', () => ({
  getCurrentAuthResult: async () => mocks.current,
}));

vi.mock('@/lib/storage/enterprise-repository', () => ({
  getEnterpriseRepository: () => mocks.repository,
}));

import { POST } from '@/app/api/courses/[id]/start/route';

const learnerRole = { id: 'role-learner', code: 'learner', name: 'Learner', isAdmin: false };
const adminRole = { id: 'role-admin', code: 'admin', name: 'Admin', isAdmin: true };

function auth(role: typeof learnerRole | typeof adminRole): AuthResult {
  return {
    user: {
      id: role.isAdmin ? 'admin-1' : 'learner-1',
      phone: null,
      passwordHash: null,
      hostUserId: null,
      roleId: role.id,
      status: 'active',
      displayName: role.name,
    },
    role,
    identity: {
      userId: role.isAdmin ? 'admin-1' : 'learner-1',
      roleId: role.id,
      roleCode: role.code,
      isAdmin: role.isAdmin,
      authSource: 'password',
    },
  };
}

function makeRepository(options: { visible?: boolean; completed?: boolean } = {}) {
  const visible = options.visible ?? true;
  let progress: EnterpriseCourseProgress | null = options.completed
    ? {
        userId: 'learner-1',
        courseId: 'course-1',
        sceneIndex: 4,
        actionIndex: 8,
        completed: true,
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }
    : null;
  const markCourseStarted = vi.fn(async ({ userId, courseId }) => {
    progress = progress ?? {
      userId,
      courseId,
      sceneIndex: 0,
      actionIndex: 0,
      completed: false,
    };
    return { ...progress, updatedAt: new Date('2026-07-15T00:00:00Z') };
  });

  const repository = {
    async getCourseContent(id: string) {
      if (id !== 'course-1') return null;
      return {
        course: {
          id,
          name: 'Course',
          description: null,
          categoryId: 'cat-1',
          categoryName: 'Default',
          status: 'published' as const,
          visibilityMode: 'roles' as const,
          visibleRoleIds: visible ? [learnerRole.id] : [],
          assessmentQuestions: [],
          publishedAt: new Date('2026-07-01T00:00:00Z'),
          createdAt: new Date('2026-07-01T00:00:00Z'),
          updatedAt: new Date('2026-07-01T00:00:00Z'),
        },
        scenes: [],
        outlines: [],
      };
    },
    markCourseStarted,
  } as unknown as EnterpriseRepository;

  return { repository, markCourseStarted };
}

async function postStart() {
  return POST(new Request('http://localhost/api/courses/course-1/start', { method: 'POST' }), {
    params: Promise.resolve({ id: 'course-1' }),
  });
}

describe('POP-01 course start route', () => {
  beforeEach(() => {
    mocks.current = auth(learnerRole);
    mocks.repository = null;
  });

  test('requires an authenticated session', async () => {
    mocks.current = null;
    const response = await postStart();
    expect(response.status).toBe(401);
  });

  test('does not record administrator previews', async () => {
    const { repository, markCourseStarted } = makeRepository();
    mocks.current = auth(adminRole);
    mocks.repository = repository;

    const response = await postStart();

    expect(response.status).toBe(403);
    expect(markCourseStarted).not.toHaveBeenCalled();
  });

  test('rejects a course outside the learner role visibility', async () => {
    const { repository, markCourseStarted } = makeRepository({ visible: false });
    mocks.repository = repository;

    const response = await postStart();

    expect(response.status).toBe(404);
    expect(markCourseStarted).not.toHaveBeenCalled();
  });

  test('is idempotent and does not lower an existing completion state', async () => {
    const { repository, markCourseStarted } = makeRepository({ completed: true });
    mocks.repository = repository;

    const first = await postStart();
    const second = await postStart();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(markCourseStarted).toHaveBeenCalledTimes(2);
    expect(secondBody.progress).toMatchObject({
      sceneIndex: 4,
      actionIndex: 8,
      completed: true,
    });
  });
});
