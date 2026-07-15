import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';

export const FORUM_TITLE_MAX_LENGTH = 160;
export const FORUM_POST_MAX_LENGTH = 10_000;
export const FORUM_REPLY_MAX_LENGTH = 5_000;
export const FORUM_DEFAULT_PAGE_SIZE = 20;
export const FORUM_MAX_PAGE_SIZE = 50;

export type ForumScope = 'global' | 'course';
export type ForumPostStatus =
  | 'visible'
  | 'hidden'
  | 'deleted_by_author'
  | 'deleted_by_admin'
  | 'archived';
export type ForumReplyStatus = 'visible' | 'hidden' | 'deleted_by_author' | 'deleted_by_admin';
export type ForumSort = 'latest' | 'activity';

export interface ForumAuthor {
  id: string;
  displayName: string;
  roleCode: string;
  roleName: string;
}

export interface ForumPost {
  id: string;
  authorId: string;
  scope: ForumScope;
  courseId: string | null;
  courseName: string | null;
  title: string;
  body: string;
  status: ForumPostStatus;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  lastActivityAt: Date;
  deletedAt: Date | null;
  moderatedBy: string | null;
  moderationReason: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: ForumAuthor;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  status: ForumReplyStatus;
  deletedAt: Date | null;
  moderatedBy: string | null;
  moderationReason: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: ForumAuthor;
}

export interface ForumRepository {
  listPosts(input: {
    roleId: string;
    authorId?: string;
    scope?: ForumScope;
    courseId?: string;
    sort: ForumSort;
    page: number;
    pageSize: number;
  }): Promise<{ items: ForumPost[]; total: number }>;
  getPost(id: string): Promise<ForumPost | null>;
  createPost(input: {
    authorId: string;
    scope: ForumScope;
    courseId: string | null;
    title: string;
    body: string;
  }): Promise<ForumPost>;
  updateOwnPost(input: {
    id: string;
    authorId: string;
    title: string;
    body: string;
  }): Promise<ForumPost | null>;
  deleteOwnPost(input: { id: string; authorId: string }): Promise<ForumPost | null>;
  listReplies(input: {
    postId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ForumReply[]; total: number }>;
  getReply(id: string): Promise<ForumReply | null>;
  createReply(input: { postId: string; authorId: string; body: string }): Promise<ForumReply>;
  updateOwnReply(input: { id: string; authorId: string; body: string }): Promise<ForumReply | null>;
  deleteOwnReply(input: { id: string; authorId: string }): Promise<ForumReply | null>;
  moderatePost(input: {
    id: string;
    action: 'hide' | 'restore' | 'pin' | 'unpin' | 'lock' | 'unlock';
    adminId: string;
    reason?: string;
  }): Promise<ForumPost | null>;
  moderateReply(input: {
    id: string;
    action: 'hide' | 'restore';
    adminId: string;
    reason?: string;
  }): Promise<ForumReply | null>;
}

export class ForumServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_REQUEST' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ForumServiceError';
  }
}

function normalizeRequired(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ForumServiceError(
      'INVALID_REQUEST',
      `${field} must be between 1 and ${maxLength} characters`,
    );
  }
  return normalized;
}

function assertPublicPost(post: ForumPost): void {
  if (!['visible', 'deleted_by_author'].includes(post.status)) {
    throw new ForumServiceError('NOT_FOUND', 'Post not found');
  }
}

function redactDeletedPost(post: ForumPost): ForumPost {
  return post.status === 'deleted_by_author'
    ? { ...post, title: '原帖已由作者删除', body: '' }
    : post;
}

function redactDeletedReply(reply: ForumReply): ForumReply {
  return reply.status === 'deleted_by_author' ? { ...reply, body: '' } : reply;
}

function assertCourseVisible(
  content: Awaited<ReturnType<Pick<EnterpriseRepository, 'getCourseContent'>['getCourseContent']>>,
  roleId: string,
) {
  if (!content || content.course.status !== 'published') {
    throw new ForumServiceError('NOT_FOUND', 'Course not found');
  }
  if (
    content.course.visibilityMode === 'roles' &&
    !content.course.visibleRoleIds.includes(roleId)
  ) {
    throw new ForumServiceError('NOT_FOUND', 'Course not found');
  }
  return content;
}

export function parseForumPagination(search: URLSearchParams) {
  const page = search.has('page') ? Number(search.get('page')) : 1;
  const pageSize = search.has('pageSize')
    ? Number(search.get('pageSize'))
    : FORUM_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) {
    throw new ForumServiceError('INVALID_REQUEST', 'page must be a positive integer');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > FORUM_MAX_PAGE_SIZE) {
    throw new ForumServiceError(
      'INVALID_REQUEST',
      `pageSize must be between 1 and ${FORUM_MAX_PAGE_SIZE}`,
    );
  }
  return { page, pageSize };
}

export function createForumService(
  repository: ForumRepository,
  courses: Pick<EnterpriseRepository, 'getCourseContent'>,
) {
  async function assertPostAccess(post: ForumPost, roleId: string) {
    assertPublicPost(post);
    if (post.scope === 'course') {
      if (!post.courseId) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertCourseVisible(await courses.getCourseContent(post.courseId), roleId);
    }
    return post;
  }

  return {
    async listPosts(input: Parameters<ForumRepository['listPosts']>[0]) {
      const result = await repository.listPosts(input);
      return { ...result, items: result.items.map(redactDeletedPost) };
    },

    async getPost(input: { id: string; roleId: string }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      return redactDeletedPost(await assertPostAccess(post, input.roleId));
    },

    async createPost(input: {
      authorId: string;
      roleId: string;
      scope: ForumScope;
      courseId?: string | null;
      title: string;
      body: string;
    }) {
      if (input.scope !== 'global' && input.scope !== 'course') {
        throw new ForumServiceError('INVALID_REQUEST', 'scope must be global or course');
      }
      const courseId = input.courseId?.trim() || null;
      if (input.scope === 'global' && courseId) {
        throw new ForumServiceError('INVALID_REQUEST', 'Global posts cannot reference a course');
      }
      if (input.scope === 'course') {
        if (!courseId) throw new ForumServiceError('INVALID_REQUEST', 'courseId is required');
        await assertCourseVisible(await courses.getCourseContent(courseId), input.roleId);
      }
      return repository.createPost({
        authorId: input.authorId,
        scope: input.scope,
        courseId,
        title: normalizeRequired(input.title, 'title', FORUM_TITLE_MAX_LENGTH),
        body: normalizeRequired(input.body, 'body', FORUM_POST_MAX_LENGTH),
      });
    },

    async updateOwnPost(input: {
      id: string;
      authorId: string;
      roleId: string;
      title: string;
      body: string;
    }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      if (post.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can edit this post');
      }
      const updated = await repository.updateOwnPost({
        id: input.id,
        authorId: input.authorId,
        title: normalizeRequired(input.title, 'title', FORUM_TITLE_MAX_LENGTH),
        body: normalizeRequired(input.body, 'body', FORUM_POST_MAX_LENGTH),
      });
      if (!updated) throw new ForumServiceError('CONFLICT', 'Post can no longer be edited');
      return updated;
    },

    async deleteOwnPost(input: { id: string; authorId: string; roleId: string }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      if (post.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can delete this post');
      }
      const deleted = await repository.deleteOwnPost(input);
      if (!deleted) throw new ForumServiceError('CONFLICT', 'Post can no longer be deleted');
      return deleted;
    },

    async listReplies(input: { postId: string; roleId: string; page: number; pageSize: number }) {
      const post = await repository.getPost(input.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      const result = await repository.listReplies(input);
      return { ...result, items: result.items.map(redactDeletedReply) };
    },

    async createReply(input: { postId: string; authorId: string; roleId: string; body: string }) {
      const post = await repository.getPost(input.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      if (post.locked) throw new ForumServiceError('CONFLICT', 'Post is closed to new replies');
      if (post.status !== 'visible') {
        throw new ForumServiceError('CONFLICT', 'Deleted posts cannot receive new replies');
      }
      return repository.createReply({
        postId: input.postId,
        authorId: input.authorId,
        body: normalizeRequired(input.body, 'body', FORUM_REPLY_MAX_LENGTH),
      });
    },

    async updateOwnReply(input: { id: string; authorId: string; roleId: string; body: string }) {
      const reply = await repository.getReply(input.id);
      if (!reply) throw new ForumServiceError('NOT_FOUND', 'Reply not found');
      const post = await repository.getPost(reply.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      if (reply.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can edit this reply');
      }
      const updated = await repository.updateOwnReply({
        id: input.id,
        authorId: input.authorId,
        body: normalizeRequired(input.body, 'body', FORUM_REPLY_MAX_LENGTH),
      });
      if (!updated) throw new ForumServiceError('CONFLICT', 'Reply can no longer be edited');
      return updated;
    },

    async deleteOwnReply(input: { id: string; authorId: string; roleId: string }) {
      const reply = await repository.getReply(input.id);
      if (!reply) throw new ForumServiceError('NOT_FOUND', 'Reply not found');
      const post = await repository.getPost(reply.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId);
      if (reply.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can delete this reply');
      }
      const deleted = await repository.deleteOwnReply(input);
      if (!deleted) throw new ForumServiceError('CONFLICT', 'Reply can no longer be deleted');
      return deleted;
    },

    async moderatePost(input: Parameters<ForumRepository['moderatePost']>[0]) {
      const post = await repository.moderatePost({
        ...input,
        reason: input.reason?.trim() || undefined,
      });
      if (!post) throw new ForumServiceError('CONFLICT', 'Post action is not valid');
      return post;
    },

    async moderateReply(input: Parameters<ForumRepository['moderateReply']>[0]) {
      const reply = await repository.moderateReply({
        ...input,
        reason: input.reason?.trim() || undefined,
      });
      if (!reply) throw new ForumServiceError('CONFLICT', 'Reply action is not valid');
      return reply;
    },
  };
}
