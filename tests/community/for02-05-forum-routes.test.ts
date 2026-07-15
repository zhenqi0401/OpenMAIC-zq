import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AuthResult } from '@/lib/auth/service';

const mocks = vi.hoisted(() => ({
  current: null as AuthResult | null,
  admin: null as AuthResult | Response | null,
  service: {
    listPosts: vi.fn(),
    getPost: vi.fn(),
    createPost: vi.fn(),
    updateOwnPost: vi.fn(),
    deleteOwnPost: vi.fn(),
    listReplies: vi.fn(),
    createReply: vi.fn(),
    updateOwnReply: vi.fn(),
    deleteOwnReply: vi.fn(),
    moderatePost: vi.fn(),
    moderateReply: vi.fn(),
  },
}));

vi.mock('@/lib/auth/current-session', () => ({
  getCurrentAuthResult: async () => mocks.current,
  requireCurrentAdmin: async () => mocks.admin,
}));

vi.mock('@/lib/community/forum-route-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/community/forum-route-utils')>();
  return { ...original, getForumService: () => mocks.service };
});

import { PATCH as moderatePost } from '@/app/api/admin/forum/posts/[postId]/route';
import { PATCH as moderateReply } from '@/app/api/admin/forum/replies/[replyId]/route';
import { GET as listPosts, POST as createPost } from '@/app/api/forum/posts/route';
import {
  DELETE as deletePost,
  GET as getPost,
  PATCH as updatePost,
} from '@/app/api/forum/posts/[postId]/route';
import {
  GET as listReplies,
  POST as createReply,
} from '@/app/api/forum/posts/[postId]/replies/route';
import {
  DELETE as deleteReply,
  PATCH as updateReply,
} from '@/app/api/forum/replies/[replyId]/route';

const learner: AuthResult = {
  user: {
    id: 'session-user',
    phone: null,
    passwordHash: null,
    hostUserId: null,
    roleId: 'role-1',
    status: 'active',
    displayName: 'Learner',
  },
  role: { id: 'role-1', code: 'learner', name: 'Learner', isAdmin: false },
  identity: {
    userId: 'session-user',
    roleId: 'role-1',
    roleCode: 'learner',
    isAdmin: false,
    authSource: 'password',
  },
};

const admin: AuthResult = {
  ...learner,
  user: { ...learner.user, id: 'admin-1', roleId: 'admin-role' },
  role: { id: 'admin-role', code: 'admin', name: 'Admin', isAdmin: true },
  identity: {
    userId: 'admin-1',
    roleId: 'admin-role',
    roleCode: 'admin',
    isAdmin: true,
    authSource: 'password',
  },
};

describe('FOR learner routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current = learner;
    mocks.admin = admin;
    mocks.service.listPosts.mockResolvedValue({ items: [], total: 0 });
    mocks.service.getPost.mockResolvedValue({ id: 'post-1' });
    mocks.service.createPost.mockResolvedValue({ id: 'post-1' });
    mocks.service.updateOwnPost.mockResolvedValue({ id: 'post-1' });
    mocks.service.deleteOwnPost.mockResolvedValue({ id: 'post-1' });
    mocks.service.listReplies.mockResolvedValue({ items: [], total: 0 });
    mocks.service.createReply.mockResolvedValue({ id: 'reply-1' });
    mocks.service.updateOwnReply.mockResolvedValue({ id: 'reply-1' });
    mocks.service.deleteOwnReply.mockResolvedValue({ id: 'reply-1' });
  });

  test('requires authentication and forwards role-aware list filters', async () => {
    mocks.current = null;
    expect((await listPosts(new Request('http://localhost/api/forum/posts'))).status).toBe(401);

    mocks.current = learner;
    const response = await listPosts(
      new Request(
        'http://localhost/api/forum/posts?scope=course&courseId=course-1&mine=true&sort=activity&page=2&pageSize=10',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.service.listPosts).toHaveBeenCalledWith({
      roleId: 'role-1',
      authorId: 'session-user',
      scope: 'course',
      courseId: 'course-1',
      sort: 'activity',
      page: 2,
      pageSize: 10,
    });
  });

  test('derives post authorship from the session and ignores a forged authorId', async () => {
    const response = await createPost(
      new Request('http://localhost/api/forum/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'course',
          courseId: 'course-1',
          title: 'Title',
          body: 'Body',
          authorId: 'forged-user',
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.service.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user', roleId: 'role-1' }),
    );
  });

  test('supports detail, author update and author soft-delete routes', async () => {
    const context = { params: Promise.resolve({ postId: 'post-1' }) };
    expect((await getPost(new Request('http://localhost'), context)).status).toBe(200);
    await updatePost(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Changed', body: 'Changed', authorId: 'forged' }),
      }),
      context,
    );
    await deletePost(new Request('http://localhost', { method: 'DELETE' }), context);
    expect(mocks.service.updateOwnPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user' }),
    );
    expect(mocks.service.deleteOwnPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user' }),
    );
  });

  test('supports only one-level reply list/create/update/delete', async () => {
    const postContext = { params: Promise.resolve({ postId: 'post-1' }) };
    expect(
      (
        await listReplies(
          new Request('http://localhost/api/forum/posts/post-1/replies?pageSize=10'),
          postContext,
        )
      ).status,
    ).toBe(200);

    const nested = await createReply(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Reply', parentReplyId: 'reply-0' }),
      }),
      postContext,
    );
    expect(nested.status).toBe(400);

    await createReply(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Reply', authorId: 'forged' }),
      }),
      postContext,
    );
    expect(mocks.service.createReply).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'session-user' }),
    );

    const replyContext = { params: Promise.resolve({ replyId: 'reply-1' }) };
    await updateReply(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Changed' }),
      }),
      replyContext,
    );
    await deleteReply(new Request('http://localhost', { method: 'DELETE' }), replyContext);
    expect(mocks.service.updateOwnReply).toHaveBeenCalled();
    expect(mocks.service.deleteOwnReply).toHaveBeenCalled();
  });
});

describe('FOR administrator routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin = admin;
    mocks.service.moderatePost.mockResolvedValue({ id: 'post-1' });
    mocks.service.moderateReply.mockResolvedValue({ id: 'reply-1' });
  });

  test('requires administrator permission', async () => {
    mocks.admin = new Response(null, { status: 403 });
    const response = await moderatePost(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hide' }),
      }),
      { params: Promise.resolve({ postId: 'post-1' }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.service.moderatePost).not.toHaveBeenCalled();
  });

  test('uses the session administrator for post and reply moderation', async () => {
    const postResponse = await moderatePost(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'lock', reason: 'off topic' }),
      }),
      { params: Promise.resolve({ postId: 'post-1' }) },
    );
    expect(postResponse.status).toBe(200);
    expect(mocks.service.moderatePost).toHaveBeenCalledWith({
      id: 'post-1',
      action: 'lock',
      adminId: 'admin-1',
      reason: 'off topic',
    });

    await moderateReply(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hide' }),
      }),
      { params: Promise.resolve({ replyId: 'reply-1' }) },
    );
    expect(mocks.service.moderateReply).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 'admin-1', action: 'hide' }),
    );
  });
});
