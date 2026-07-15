import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createDanmakuService,
  DANMAKU_MAX_CONTENT_LENGTH,
  type DanmakuRecord,
  type DanmakuRepository,
} from '@/lib/community/danmaku';
import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';

const createdAt = new Date('2026-07-15T00:00:00.000Z');

function record(patch: Partial<DanmakuRecord> = {}): DanmakuRecord {
  return {
    id: 'dmk-1',
    courseId: 'course-1',
    sceneKey: 'scene-1',
    actionId: 'action-1',
    actionOffsetMs: 1200,
    authorId: 'user-1',
    content: 'hello',
    inputSource: 'text',
    status: 'visible',
    clientRequestId: null,
    deletedAt: null,
    moderatedBy: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...patch,
  };
}

function setup(options: { status?: 'published' | 'draft'; visible?: boolean } = {}) {
  const repository: DanmakuRepository = {
    listVisible: vi.fn(async () => [record(), record({ id: 'stale', actionId: 'removed' })]),
    findByRequestId: vi.fn(async () => null),
    getAuthorSendWindow: vi.fn(async () => []),
    create: vi.fn(async (input) =>
      record({ ...input, clientRequestId: input.clientRequestId ?? null }),
    ),
    softDeleteByAuthor: vi.fn(async (input) =>
      record({ id: input.id, status: 'deleted_by_author' }),
    ),
    listAdmin: vi.fn(async () => []),
    moderate: vi.fn(
      async (input) =>
        record({
          id: input.id,
          status:
            input.action === 'delete'
              ? 'deleted_by_admin'
              : input.action === 'hide'
                ? 'hidden'
                : 'visible',
          authorId: 'user-1',
        }) as never,
    ),
  };
  const courses = {
    getCourseContent: vi.fn(async () => ({
      course: {
        id: 'course-1',
        name: 'Course',
        description: null,
        categoryId: 'category-1',
        categoryName: null,
        status: options.status ?? ('published' as const),
        visibilityMode: 'roles' as const,
        visibleRoleIds: options.visible === false ? [] : ['role-1'],
        assessmentQuestions: [],
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
      scenes: [{ id: 'scene-1', actions: [{ id: 'action-1', type: 'speech' }] }],
      outlines: [],
    })),
  } as unknown as Pick<EnterpriseRepository, 'getCourseContent'>;
  return {
    repository,
    courses,
    service: createDanmakuService(repository, courses, () => new Date('2026-07-15T00:01:00Z')),
  };
}

describe('DMK-02 history and course permission', () => {
  test('returns only visible, currently anchored public fields and a bounded cursor page', async () => {
    const { service, repository } = setup();
    const result = await service.listVisible({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      roleId: 'role-1',
      limit: 2,
    });

    expect(repository.listVisible).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'course-1', sceneKey: 'scene-1', limit: 2 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
    expect(result.items[0]).not.toHaveProperty('authorId');
    expect(result.items[0]).not.toHaveProperty('status');
  });

  test.each([
    [{ status: 'draft' as const }, 'draft course'],
    [{ visible: false }, 'role-restricted course'],
  ])('does not expose a %s', async (options) => {
    const { service, repository } = setup(options);
    await expect(
      service.listVisible({
        courseId: 'course-1',
        sceneKey: 'scene-1',
        roleId: 'role-1',
        limit: 50,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.listVisible).not.toHaveBeenCalled();
  });
});

describe('DMK-03 create validation, identity, idempotency and rate limit', () => {
  let base: ReturnType<typeof setup>;

  beforeEach(() => {
    base = setup();
  });

  test('persists the authenticated author after verifying scene/action ownership', async () => {
    const result = await base.service.create({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      actionId: 'action-1',
      actionOffsetMs: 1200,
      authorId: 'session-user',
      roleId: 'role-1',
      content: '  hello  ',
      inputSource: 'voice',
      clientRequestId: 'request-1',
    });
    expect(base.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user', content: 'hello', inputSource: 'voice' }),
    );
    expect(result.danmaku).not.toHaveProperty('authorId');
  });

  test('rejects an action that does not belong to the submitted scene', async () => {
    await expect(
      base.service.create({
        courseId: 'course-1',
        sceneKey: 'scene-1',
        actionId: 'forged-action',
        actionOffsetMs: 0,
        authorId: 'user-1',
        roleId: 'role-1',
        content: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(base.repository.create).not.toHaveBeenCalled();
  });

  test('rejects empty and overlong content', async () => {
    for (const content of ['   ', 'x'.repeat(DANMAKU_MAX_CONTENT_LENGTH + 1)]) {
      await expect(
        base.service.create({
          courseId: 'course-1',
          sceneKey: 'scene-1',
          actionId: 'action-1',
          actionOffsetMs: 0,
          authorId: 'user-1',
          roleId: 'role-1',
          content,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    }
  });

  test('replays an idempotency key without another insert or rate-limit rejection', async () => {
    vi.mocked(base.repository.findByRequestId).mockResolvedValue(
      record({ clientRequestId: 'same-request' }),
    );
    const result = await base.service.create({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      actionId: 'action-1',
      actionOffsetMs: 1200,
      authorId: 'user-1',
      roleId: 'role-1',
      content: 'hello',
      clientRequestId: 'same-request',
    });
    expect(result.created).toBe(false);
    expect(base.repository.getAuthorSendWindow).not.toHaveBeenCalled();
    expect(base.repository.create).not.toHaveBeenCalled();
  });

  test('enforces the server-side consecutive send interval', async () => {
    vi.mocked(base.repository.getAuthorSendWindow).mockResolvedValue([
      record({ createdAt: new Date('2026-07-15T00:00:59Z') }),
    ]);
    await expect(
      base.service.create({
        courseId: 'course-1',
        sceneKey: 'scene-1',
        actionId: 'action-1',
        actionOffsetMs: 0,
        authorId: 'user-1',
        roleId: 'role-1',
        content: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('DMK-04 author and administrator operations', () => {
  test('scopes author deletion to course and session author', async () => {
    const { service, repository } = setup();
    await service.deleteOwn({
      id: 'dmk-1',
      courseId: 'course-1',
      authorId: 'session-user',
      roleId: 'role-1',
    });
    expect(repository.softDeleteByAuthor).toHaveBeenCalledWith({
      id: 'dmk-1',
      courseId: 'course-1',
      authorId: 'session-user',
      roleId: 'role-1',
    });
  });

  test('passes administrator identity and reason to hide, restore and delete', async () => {
    const { service, repository } = setup();
    for (const action of ['hide', 'restore', 'delete'] as const) {
      await service.moderate({ id: 'dmk-1', action, adminId: 'admin-1', reason: ' abuse ' });
    }
    expect(repository.moderate).toHaveBeenCalledTimes(3);
    expect(repository.moderate).toHaveBeenLastCalledWith({
      id: 'dmk-1',
      action: 'delete',
      adminId: 'admin-1',
      reason: 'abuse',
    });
  });
});
