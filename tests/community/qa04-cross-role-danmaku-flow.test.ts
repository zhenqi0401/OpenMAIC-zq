import { describe, expect, test, vi } from 'vitest';

import {
  createDanmakuService,
  type AdminDanmaku,
  type DanmakuRepository,
} from '@/lib/community/danmaku';
import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';

const now = new Date('2026-07-16T01:00:00.000Z');

describe('QA-04 cross-role historical danmaku acceptance', () => {
  test('learner A sends, learner B replays, restricted learner is denied, and admin hides it', async () => {
    const records: AdminDanmaku[] = [];
    const repository: DanmakuRepository = {
      listVisible: vi.fn(async ({ courseId, sceneKey }) =>
        records.filter(
          (item) =>
            item.courseId === courseId && item.sceneKey === sceneKey && item.status === 'visible',
        ),
      ),
      findByRequestId: vi.fn(async () => null),
      getAuthorSendWindow: vi.fn(async () => []),
      create: vi.fn(async (input) => {
        const created: AdminDanmaku = {
          id: `danmaku-${records.length + 1}`,
          ...input,
          inputSource: input.inputSource ?? 'text',
          clientRequestId: input.clientRequestId ?? null,
          status: 'visible',
          deletedAt: null,
          moderatedBy: null,
          moderationReason: null,
          moderatedAt: null,
          createdAt: now,
          updatedAt: now,
          author: {
            id: input.authorId,
            displayName: 'Learner A',
            status: 'active',
            roleId: 'role-learner',
            roleCode: 'learner',
          },
        };
        records.push(created);
        return created;
      }),
      softDeleteByAuthor: vi.fn(async () => null),
      listAdmin: vi.fn(async () => records),
      moderate: vi.fn(async ({ id, action, adminId, reason }) => {
        const item = records.find((candidate) => candidate.id === id);
        if (!item) return null;
        item.status =
          action === 'hide' ? 'hidden' : action === 'delete' ? 'deleted_by_admin' : 'visible';
        item.moderatedBy = adminId;
        item.moderationReason = reason ?? null;
        item.moderatedAt = now;
        item.updatedAt = now;
        return item;
      }),
    };
    const courses = {
      getCourseContent: vi.fn(async () => ({
        course: {
          id: 'course-1',
          name: 'Course',
          status: 'published',
          visibilityMode: 'roles',
          visibleRoleIds: ['role-learner'],
        },
        scenes: [{ id: 'scene-1', actions: [{ id: 'action-1', type: 'speech' }] }],
        outlines: [],
      })),
    } as unknown as Pick<EnterpriseRepository, 'getCourseContent'>;
    const service = createDanmakuService(repository, courses, () => now);

    const sent = await service.create({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      actionId: 'action-1',
      actionOffsetMs: 800,
      authorId: 'learner-a',
      roleId: 'role-learner',
      content: '学员 A 的历史弹幕',
      clientRequestId: 'qa-learner-a-1',
    });
    expect(sent.created).toBe(true);
    expect(sent.danmaku).not.toHaveProperty('authorId');

    const learnerBReplay = await service.listVisible({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      roleId: 'role-learner',
      limit: 50,
    });
    expect(learnerBReplay.items).toEqual([
      expect.objectContaining({ content: '学员 A 的历史弹幕', actionOffsetMs: 800 }),
    ]);

    await expect(
      service.listVisible({
        courseId: 'course-1',
        sceneKey: 'scene-1',
        roleId: 'role-without-course-access',
        limit: 50,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await service.moderate({
      id: records[0].id,
      action: 'hide',
      adminId: 'admin-1',
      reason: 'QA moderation',
    });
    const afterAdminHide = await service.listVisible({
      courseId: 'course-1',
      sceneKey: 'scene-1',
      roleId: 'role-learner',
      limit: 50,
    });
    expect(afterAdminHide.items).toEqual([]);
    expect(records[0]).toMatchObject({
      status: 'hidden',
      moderatedBy: 'admin-1',
      moderationReason: 'QA moderation',
    });
  });
});
