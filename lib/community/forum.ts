import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';
import {
  CommunityGovernanceError,
  normalizeCommunityText,
  normalizeModerationReason,
  type CommunityRateLimiter,
} from './governance-shared';

export const FORUM_TITLE_MAX_LENGTH = 160;
export const FORUM_POST_MAX_LENGTH = 10_000;
export const FORUM_REPLY_MAX_LENGTH = 5_000;
export const FORUM_REPLY_MAX_DEPTH = 5;
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
  parentReplyId: string | null;
  depth: number;
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
    tenantId?: string;
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
  }): Promise<{ items: ForumReply[]; total: number; rootTotal: number }>;
  getReply(id: string): Promise<ForumReply | null>;
  createReply(input: {
    postId: string;
    authorId: string;
    parentReplyId: string | null;
    depth: number;
    body: string;
  }): Promise<ForumReply>;
  updateOwnReply(input: { id: string; authorId: string; body: string }): Promise<ForumReply | null>;
  deleteOwnReply(input: { id: string; authorId: string }): Promise<ForumReply | null>;
  moderatePost(input: {
    id: string;
    action: 'hide' | 'restore' | 'delete' | 'pin' | 'unpin' | 'lock' | 'unlock';
    adminId: string;
    reason?: string;
  }): Promise<ForumPost | null>;
  moderateReply(input: {
    id: string;
    action: 'hide' | 'restore' | 'delete';
    adminId: string;
    reason?: string;
  }): Promise<ForumReply | null>;
}

export class ForumServiceError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_REQUEST'
      | 'RATE_LIMITED'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ForumServiceError';
  }
}

function normalizeRequired(value: string, field: string, maxLength: number): string {
  try {
    return normalizeCommunityText(value, field, maxLength);
  } catch (error) {
    if (error instanceof CommunityGovernanceError) {
      throw new ForumServiceError('INVALID_REQUEST', error.message);
    }
    throw error;
  }
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

function redactUnavailableReply(reply: ForumReply): ForumReply {
  return reply.status === 'visible' ? reply : { ...reply, body: '' };
}

function assertCourseVisible(
  content: Awaited<ReturnType<Pick<EnterpriseRepository, 'getCourseContent'>['getCourseContent']>>,
  roleId: string,
  tenantId?: string,
) {
  if (!content || content.course.status !== 'published') {
    throw new ForumServiceError('NOT_FOUND', 'Course not found');
  }
  if (
    (tenantId && content.course.scope !== 'platform' && content.course.tenantId !== tenantId) ||
    (content.course.visibilityMode === 'roles' && !content.course.visibleRoleIds.includes(roleId))
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
  rateLimiter?: CommunityRateLimiter,
) {
  async function consumeRateLimit(
    actorId: string,
    actionKind: 'forum_post' | 'forum_reply',
    content: string,
  ) {
    if (!rateLimiter) return;
    try {
      await rateLimiter.consume({ actorId, actionKind, content });
    } catch (error) {
      if (error instanceof CommunityGovernanceError && error.code === 'RATE_LIMITED') {
        throw new ForumServiceError('RATE_LIMITED', error.message);
      }
      throw error;
    }
  }

  async function assertPostAccess(post: ForumPost, roleId: string, tenantId?: string) {
    assertPublicPost(post);
    if (post.scope === 'course') {
      if (!post.courseId) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertCourseVisible(await courses.getCourseContent(post.courseId), roleId, tenantId);
    }
    return post;
  }

  return {
    async listPosts(input: Parameters<ForumRepository['listPosts']>[0]) {
      const result = await repository.listPosts(input);
      return { ...result, items: result.items.map(redactDeletedPost) };
    },

    async getPost(input: { id: string; roleId: string; tenantId?: string }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      return redactDeletedPost(await assertPostAccess(post, input.roleId, input.tenantId));
    },

    async createPost(input: {
      authorId: string;
      roleId: string;
      tenantId?: string;
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
        await assertCourseVisible(
          await courses.getCourseContent(courseId),
          input.roleId,
          input.tenantId,
        );
      }
      const title = normalizeRequired(input.title, 'title', FORUM_TITLE_MAX_LENGTH);
      const body = normalizeRequired(input.body, 'body', FORUM_POST_MAX_LENGTH);
      await consumeRateLimit(input.authorId, 'forum_post', `${title}\n${body}`);
      return repository.createPost({
        authorId: input.authorId,
        scope: input.scope,
        courseId,
        title,
        body,
      });
    },

    async updateOwnPost(input: {
      id: string;
      authorId: string;
      roleId: string;
      tenantId?: string;
      title: string;
      body: string;
    }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
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

    async deleteOwnPost(input: {
      id: string;
      authorId: string;
      roleId: string;
      tenantId?: string;
    }) {
      const post = await repository.getPost(input.id);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
      if (post.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can delete this post');
      }
      const deleted = await repository.deleteOwnPost(input);
      if (!deleted) throw new ForumServiceError('CONFLICT', 'Post can no longer be deleted');
      return deleted;
    },

    async listReplies(input: {
      postId: string;
      roleId: string;
      tenantId?: string;
      page: number;
      pageSize: number;
    }) {
      const post = await repository.getPost(input.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
      const result = await repository.listReplies(input);
      return { ...result, items: result.items.map(redactUnavailableReply) };
    },

    async createReply(input: {
      postId: string;
      authorId: string;
      roleId: string;
      tenantId?: string;
      body: string;
      parentReplyId?: string | null;
    }) {
      const post = await repository.getPost(input.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
      if (post.locked) throw new ForumServiceError('CONFLICT', 'Post is closed to new replies');
      if (post.status !== 'visible') {
        throw new ForumServiceError('CONFLICT', 'Deleted posts cannot receive new replies');
      }
      const parentReplyId = input.parentReplyId?.trim() || null;
      let depth = 1;
      if (parentReplyId) {
        const parent = await repository.getReply(parentReplyId);
        if (!parent) throw new ForumServiceError('NOT_FOUND', 'Parent reply not found');
        if (parent.postId !== input.postId) {
          throw new ForumServiceError(
            'INVALID_REQUEST',
            'Parent reply must belong to the same post',
          );
        }
        if (parent.status !== 'visible') {
          throw new ForumServiceError('CONFLICT', 'Unavailable replies cannot receive replies');
        }
        if (parent.depth >= FORUM_REPLY_MAX_DEPTH) {
          throw new ForumServiceError(
            'CONFLICT',
            `Replies support at most ${FORUM_REPLY_MAX_DEPTH} levels`,
          );
        }
        depth = parent.depth + 1;
      }
      const body = normalizeRequired(input.body, 'body', FORUM_REPLY_MAX_LENGTH);
      await consumeRateLimit(input.authorId, 'forum_reply', body);
      return repository.createReply({
        postId: input.postId,
        authorId: input.authorId,
        parentReplyId,
        depth,
        body,
      });
    },

    async updateOwnReply(input: {
      id: string;
      authorId: string;
      roleId: string;
      tenantId?: string;
      body: string;
    }) {
      const reply = await repository.getReply(input.id);
      if (!reply) throw new ForumServiceError('NOT_FOUND', 'Reply not found');
      const post = await repository.getPost(reply.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
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

    async deleteOwnReply(input: {
      id: string;
      authorId: string;
      roleId: string;
      tenantId?: string;
    }) {
      const reply = await repository.getReply(input.id);
      if (!reply) throw new ForumServiceError('NOT_FOUND', 'Reply not found');
      const post = await repository.getPost(reply.postId);
      if (!post) throw new ForumServiceError('NOT_FOUND', 'Post not found');
      await assertPostAccess(post, input.roleId, input.tenantId);
      if (reply.authorId !== input.authorId) {
        throw new ForumServiceError('FORBIDDEN', 'Only the author can delete this reply');
      }
      const deleted = await repository.deleteOwnReply(input);
      if (!deleted) throw new ForumServiceError('CONFLICT', 'Reply can no longer be deleted');
      return deleted;
    },

    async moderatePost(input: Parameters<ForumRepository['moderatePost']>[0]) {
      let reason: string | undefined;
      try {
        reason = normalizeModerationReason(input.reason);
      } catch (error) {
        if (error instanceof CommunityGovernanceError) {
          throw new ForumServiceError('INVALID_REQUEST', error.message);
        }
        throw error;
      }
      const post = await repository.moderatePost({ ...input, reason });
      if (!post) throw new ForumServiceError('CONFLICT', 'Post action is not valid');
      return post;
    },

    async moderateReply(input: Parameters<ForumRepository['moderateReply']>[0]) {
      let reason: string | undefined;
      try {
        reason = normalizeModerationReason(input.reason);
      } catch (error) {
        if (error instanceof CommunityGovernanceError) {
          throw new ForumServiceError('INVALID_REQUEST', error.message);
        }
        throw error;
      }
      const reply = await repository.moderateReply({ ...input, reason });
      if (!reply) throw new ForumServiceError('CONFLICT', 'Reply action is not valid');
      return reply;
    },
  };
}
