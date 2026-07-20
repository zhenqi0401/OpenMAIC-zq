import { describe, expect, test, vi } from 'vitest';

import {
  createForumService,
  FORUM_POST_MAX_LENGTH,
  FORUM_REPLY_MAX_DEPTH,
  type ForumPost,
  type ForumReply,
  type ForumRepository,
} from '@/lib/community/forum';
import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';

const now = new Date('2026-07-15T08:00:00.000Z');
const author = { id: 'user-1', displayName: 'User', roleCode: 'learner', roleName: 'Learner' };

function post(patch: Partial<ForumPost> = {}): ForumPost {
  return {
    id: 'post-1',
    authorId: 'user-1',
    scope: 'global',
    courseId: null,
    courseName: null,
    title: 'Title',
    body: 'Body',
    status: 'visible',
    pinned: false,
    locked: false,
    replyCount: 0,
    lastActivityAt: now,
    deletedAt: null,
    moderatedBy: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt: now,
    updatedAt: now,
    author,
    ...patch,
  };
}

function reply(patch: Partial<ForumReply> = {}): ForumReply {
  return {
    id: 'reply-1',
    postId: 'post-1',
    authorId: 'user-1',
    parentReplyId: null,
    depth: 1,
    body: 'Reply',
    status: 'visible',
    deletedAt: null,
    moderatedBy: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt: now,
    updatedAt: now,
    author,
    ...patch,
  };
}

function setup(course: { status?: 'published' | 'draft' | 'archived'; visible?: boolean } = {}) {
  const repository: ForumRepository = {
    listPosts: vi.fn(async () => ({ items: [], total: 0 })),
    getPost: vi.fn(async () => post()),
    createPost: vi.fn(async (input) => post({ ...input })),
    updateOwnPost: vi.fn(async (input) => post({ ...input })),
    deleteOwnPost: vi.fn(async () => post({ status: 'deleted_by_author' })),
    listReplies: vi.fn(async () => ({ items: [reply()], total: 1, rootTotal: 1 })),
    getReply: vi.fn(async () => reply()),
    createReply: vi.fn(async (input) => reply({ ...input })),
    updateOwnReply: vi.fn(async (input) => reply({ ...input })),
    deleteOwnReply: vi.fn(async () => reply({ status: 'deleted_by_author' })),
    moderatePost: vi.fn(async (input) =>
      post({
        status: input.action === 'hide' ? 'hidden' : 'visible',
        pinned: input.action === 'pin',
        locked: input.action === 'lock',
      }),
    ),
    moderateReply: vi.fn(async (input) =>
      reply({ status: input.action === 'hide' ? 'hidden' : 'visible' }),
    ),
  };
  const courses = {
    getCourseContent: vi.fn(async () => ({
      course: {
        id: 'course-1',
        status: course.status ?? 'published',
        visibilityMode: 'roles',
        visibleRoleIds: course.visible === false ? [] : ['role-1'],
      },
      scenes: [],
      outlines: [],
    })),
  } as unknown as Pick<EnterpriseRepository, 'getCourseContent'>;
  return { repository, courses, service: createForumService(repository, courses) };
}

describe('FOR-02 posts and FOR-04 course permission inheritance', () => {
  test('creates global and accessible course posts using the session author', async () => {
    const { service, repository } = setup();
    await service.createPost({
      authorId: 'session-user',
      roleId: 'role-1',
      scope: 'course',
      courseId: 'course-1',
      title: '  Course title ',
      body: ' Course body ',
    });
    expect(repository.createPost).toHaveBeenCalledWith({
      authorId: 'session-user',
      scope: 'course',
      courseId: 'course-1',
      title: 'Course title',
      body: 'Course body',
    });
  });

  test.each([
    [{ status: 'draft' as const }, 'draft'],
    [{ status: 'archived' as const }, 'archived'],
    [{ visible: false }, 'role restricted'],
  ])('does not expose or create posts for a %s course', async (options, _label) => {
    const { service, repository } = setup(options);
    vi.mocked(repository.getPost).mockResolvedValue(
      post({ scope: 'course', courseId: 'course-1' }),
    );
    await expect(service.getPost({ id: 'post-1', roleId: 'role-1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.createPost({
        authorId: 'user-1',
        roleId: 'role-1',
        scope: 'course',
        courseId: 'course-1',
        title: 'Title',
        body: 'Body',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('validates scope and bounded content', async () => {
    const { service } = setup();
    await expect(
      service.createPost({
        authorId: 'user-1',
        roleId: 'role-1',
        scope: 'global',
        courseId: 'course-1',
        title: 'Title',
        body: 'Body',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      service.createPost({
        authorId: 'user-1',
        roleId: 'role-1',
        scope: 'global',
        title: 'Title',
        body: 'x'.repeat(FORUM_POST_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  test('only allows the author to edit or soft-delete a post', async () => {
    const { service, repository } = setup();
    await expect(
      service.updateOwnPost({
        id: 'post-1',
        authorId: 'attacker',
        roleId: 'role-1',
        title: 'Changed',
        body: 'Changed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.updateOwnPost).not.toHaveBeenCalled();

    await service.deleteOwnPost({ id: 'post-1', authorId: 'user-1', roleId: 'role-1' });
    expect(repository.deleteOwnPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'user-1' }),
    );
  });

  test('redacts an author-deleted thread while preserving its structure', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getPost).mockResolvedValue(post({ status: 'deleted_by_author' }));
    const deleted = await service.getPost({ id: 'post-1', roleId: 'role-1' });
    expect(deleted).toMatchObject({ title: '原帖已由作者删除', body: '' });

    vi.mocked(repository.listPosts).mockResolvedValue({
      items: [post({ status: 'deleted_by_author', replyCount: 1 })],
      total: 1,
    });
    const list = await service.listPosts({
      roleId: 'role-1',
      sort: 'latest',
      page: 1,
      pageSize: 20,
    });
    expect(list.items[0]).toMatchObject({ title: '原帖已由作者删除', body: '' });
  });
});

describe('FOR-03 five-level reply trees', () => {
  test('creates a top-level reply and rejects new replies once a post is locked', async () => {
    const { service, repository } = setup();
    await service.createReply({
      postId: 'post-1',
      authorId: 'session-user',
      roleId: 'role-1',
      body: ' Reply ',
    });
    expect(repository.createReply).toHaveBeenCalledWith({
      postId: 'post-1',
      authorId: 'session-user',
      parentReplyId: null,
      depth: 1,
      body: 'Reply',
    });

    vi.mocked(repository.getPost).mockResolvedValue(post({ locked: true }));
    await expect(
      service.createReply({
        postId: 'post-1',
        authorId: 'user-1',
        roleId: 'role-1',
        body: 'Reply',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('derives sibling depth from the direct parent', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getReply).mockResolvedValue(reply({ id: 'parent-1', depth: 1 }));

    for (const body of ['First child', 'Second child']) {
      await service.createReply({
        postId: 'post-1',
        authorId: 'session-user',
        roleId: 'role-1',
        parentReplyId: 'parent-1',
        body,
      });
    }

    expect(repository.createReply).toHaveBeenNthCalledWith(1, {
      postId: 'post-1',
      authorId: 'session-user',
      parentReplyId: 'parent-1',
      depth: 2,
      body: 'First child',
    });
    expect(repository.createReply).toHaveBeenNthCalledWith(2, {
      postId: 'post-1',
      authorId: 'session-user',
      parentReplyId: 'parent-1',
      depth: 2,
      body: 'Second child',
    });
  });

  test('allows level five and rejects replies below it', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getReply).mockResolvedValueOnce(
      reply({ id: 'level-4', depth: FORUM_REPLY_MAX_DEPTH - 1 }),
    );
    await service.createReply({
      postId: 'post-1',
      authorId: 'session-user',
      roleId: 'role-1',
      parentReplyId: 'level-4',
      body: 'Level five',
    });
    expect(repository.createReply).toHaveBeenCalledWith(
      expect.objectContaining({ parentReplyId: 'level-4', depth: FORUM_REPLY_MAX_DEPTH }),
    );

    vi.mocked(repository.getReply).mockResolvedValueOnce(
      reply({ id: 'level-5', depth: FORUM_REPLY_MAX_DEPTH }),
    );
    await expect(
      service.createReply({
        postId: 'post-1',
        authorId: 'session-user',
        roleId: 'role-1',
        parentReplyId: 'level-5',
        body: 'Level six',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(repository.createReply).toHaveBeenCalledTimes(1);
  });

  test('rejects cross-post and unavailable parents', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getReply).mockResolvedValueOnce(null);
    await expect(
      service.createReply({
        postId: 'post-1',
        authorId: 'session-user',
        roleId: 'role-1',
        parentReplyId: 'missing-parent',
        body: 'Missing parent',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    vi.mocked(repository.getReply).mockResolvedValueOnce(
      reply({ id: 'other-parent', postId: 'post-2' }),
    );
    await expect(
      service.createReply({
        postId: 'post-1',
        authorId: 'session-user',
        roleId: 'role-1',
        parentReplyId: 'other-parent',
        body: 'Cross post',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });

    vi.mocked(repository.getReply).mockResolvedValueOnce(
      reply({ id: 'deleted-parent', status: 'deleted_by_author' }),
    );
    await expect(
      service.createReply({
        postId: 'post-1',
        authorId: 'session-user',
        roleId: 'role-1',
        parentReplyId: 'deleted-parent',
        body: 'Unavailable parent',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(repository.createReply).not.toHaveBeenCalled();
  });

  test('redacts unavailable nodes without changing their tree coordinates', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.listReplies).mockResolvedValue({
      items: [
        reply({
          id: 'hidden-child',
          parentReplyId: 'root-1',
          depth: 2,
          status: 'hidden',
          body: 'Moderated body',
        }),
      ],
      total: 0,
      rootTotal: 1,
    });

    const result = await service.listReplies({
      postId: 'post-1',
      roleId: 'role-1',
      page: 1,
      pageSize: 20,
    });
    expect(result).toMatchObject({ total: 0, rootTotal: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'hidden-child',
      parentReplyId: 'root-1',
      depth: 2,
      body: '',
    });
  });

  test('only allows the reply author to edit and delete', async () => {
    const { service, repository } = setup();
    await expect(
      service.updateOwnReply({
        id: 'reply-1',
        authorId: 'attacker',
        roleId: 'role-1',
        body: 'Changed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.updateOwnReply).not.toHaveBeenCalled();
  });
});

describe('FOR-05 administrator actions', () => {
  test('passes the authenticated administrator and trimmed reason to all post states', async () => {
    const { service, repository } = setup();
    for (const action of ['hide', 'restore', 'delete', 'pin', 'unpin', 'lock', 'unlock'] as const) {
      await service.moderatePost({ id: 'post-1', action, adminId: 'admin-1', reason: ' abuse ' });
    }
    expect(repository.moderatePost).toHaveBeenLastCalledWith({
      id: 'post-1',
      action: 'unlock',
      adminId: 'admin-1',
      reason: 'abuse',
    });
  });

  test('supports hiding, deleting and restoring replies', async () => {
    const { service, repository } = setup();
    await service.moderateReply({ id: 'reply-1', action: 'hide', adminId: 'admin-1' });
    await service.moderateReply({ id: 'reply-1', action: 'restore', adminId: 'admin-1' });
    await service.moderateReply({ id: 'reply-1', action: 'delete', adminId: 'admin-1' });
    expect(repository.moderateReply).toHaveBeenCalledTimes(3);
  });
});
