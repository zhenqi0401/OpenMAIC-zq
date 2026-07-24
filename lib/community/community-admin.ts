import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';

import { getDb } from '@/lib/storage/db';
import {
  communityModerationAudit,
  courseDanmaku,
  courses,
  forumPosts,
  forumReplies,
  roles,
  users,
} from '@/lib/storage/schema';

export const COMMUNITY_ADMIN_DEFAULT_PAGE_SIZE = 20;
export const COMMUNITY_ADMIN_MAX_PAGE_SIZE = 50;

export type CommunityAdminContentType = 'danmaku' | 'posts' | 'replies' | 'audit';

export interface CommunityAdminFilters {
  type: CommunityAdminContentType;
  authorId?: string;
  courseId?: string;
  status?: string;
  keyword?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

function contentFilter(column: typeof courseDanmaku.content, keyword: string | undefined) {
  return keyword ? ilike(column, `%${keyword}%`) : undefined;
}

export function parseCommunityAdminFilters(search: URLSearchParams): CommunityAdminFilters {
  const type = search.get('type') ?? 'danmaku';
  if (!['danmaku', 'posts', 'replies', 'audit'].includes(type)) {
    throw new Error('Invalid community content type');
  }
  const page = search.has('page') ? Number(search.get('page')) : 1;
  const pageSize = search.has('pageSize')
    ? Number(search.get('pageSize'))
    : COMMUNITY_ADMIN_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) throw new Error('page must be a positive integer');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > COMMUNITY_ADMIN_MAX_PAGE_SIZE) {
    throw new Error(`pageSize must be between 1 and ${COMMUNITY_ADMIN_MAX_PAGE_SIZE}`);
  }
  const parseDate = (name: string) => {
    const value = search.get(name);
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date`);
    return date;
  };
  const clean = (name: string) => search.get(name)?.trim() || undefined;
  const filters = {
    type: type as CommunityAdminContentType,
    authorId: clean('authorId'),
    courseId: clean('courseId'),
    status: clean('status'),
    keyword: clean('keyword'),
    from: parseDate('from'),
    to: parseDate('to'),
    page,
    pageSize,
  };
  const allowedStatuses: Record<CommunityAdminContentType, readonly string[]> = {
    danmaku: ['visible', 'hidden', 'deleted_by_author', 'deleted_by_admin'],
    posts: ['visible', 'hidden', 'deleted_by_author', 'deleted_by_admin', 'archived'],
    replies: ['visible', 'hidden', 'deleted_by_author', 'deleted_by_admin'],
    audit: ['danmaku', 'forum_post', 'forum_reply'],
  };
  if (filters.status && !allowedStatuses[filters.type].includes(filters.status)) {
    throw new Error(`Invalid status for ${filters.type}`);
  }
  if (filters.from && filters.to && filters.from.getTime() > filters.to.getTime()) {
    throw new Error('from must not be later than to');
  }
  return filters;
}

export class CommunityAdminRepository {
  async list(input: CommunityAdminFilters) {
    if (input.type === 'danmaku') return this.listDanmaku(input);
    if (input.type === 'posts') return this.listPosts(input);
    if (input.type === 'replies') return this.listReplies(input);
    return this.listAudit(input);
  }

  private async listDanmaku(input: CommunityAdminFilters) {
    const where = and(
      input.authorId ? eq(courseDanmaku.authorId, input.authorId) : undefined,
      input.courseId ? eq(courseDanmaku.courseId, input.courseId) : undefined,
      input.status ? eq(courseDanmaku.status, input.status) : undefined,
      contentFilter(courseDanmaku.content, input.keyword),
      input.from ? gte(courseDanmaku.createdAt, input.from) : undefined,
      input.to ? lte(courseDanmaku.createdAt, input.to) : undefined,
    );
    const rows = await getDb()
      .select({ content: courseDanmaku, author: users, role: roles, courseName: courses.name })
      .from(courseDanmaku)
      .innerJoin(users, eq(courseDanmaku.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(courses, eq(courseDanmaku.courseId, courses.id))
      .where(where)
      .orderBy(desc(courseDanmaku.createdAt), desc(courseDanmaku.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [total] = await getDb().select({ value: count() }).from(courseDanmaku).where(where);
    return {
      items: rows.map((row) => ({
        ...row.content,
        courseName: row.courseName,
        author: {
          id: row.author.id,
          displayName: row.author.displayName,
          roleCode: row.role.code,
          roleName: row.role.name,
        },
      })),
      total: total?.value ?? 0,
    };
  }

  private async listPosts(input: CommunityAdminFilters) {
    const where = and(
      input.authorId ? eq(forumPosts.authorId, input.authorId) : undefined,
      input.courseId ? eq(forumPosts.courseId, input.courseId) : undefined,
      input.status ? eq(forumPosts.status, input.status) : undefined,
      input.keyword
        ? or(
            ilike(forumPosts.title, `%${input.keyword}%`),
            ilike(forumPosts.body, `%${input.keyword}%`),
          )
        : undefined,
      input.from ? gte(forumPosts.createdAt, input.from) : undefined,
      input.to ? lte(forumPosts.createdAt, input.to) : undefined,
    );
    const db = getDb();
    const rows = await db
      .select({ content: forumPosts, author: users, role: roles, courseName: courses.name })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(courses, eq(forumPosts.courseId, courses.id))
      .where(where)
      .orderBy(desc(forumPosts.createdAt), desc(forumPosts.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const postIds = rows.map((row) => row.content.id);
    const auditRows = postIds.length
      ? await db
          .selectDistinctOn([communityModerationAudit.targetId], {
            audit: communityModerationAudit,
            moderator: users,
          })
          .from(communityModerationAudit)
          .innerJoin(users, eq(communityModerationAudit.moderatorId, users.id))
          .where(
            and(
              eq(communityModerationAudit.targetType, 'forum_post'),
              inArray(communityModerationAudit.targetId, postIds),
            ),
          )
          .orderBy(
            communityModerationAudit.targetId,
            desc(communityModerationAudit.createdAt),
            desc(communityModerationAudit.id),
          )
      : [];
    const latestAuditByPost = new Map<
      string,
      {
        audit: (typeof auditRows)[number]['audit'];
        moderator: (typeof auditRows)[number]['moderator'];
      }
    >();
    for (const row of auditRows) {
      if (!latestAuditByPost.has(row.audit.targetId)) {
        latestAuditByPost.set(row.audit.targetId, row);
      }
    }
    const [total] = await db.select({ value: count() }).from(forumPosts).where(where);
    return {
      items: rows.map((row) => {
        const latestAudit = latestAuditByPost.get(row.content.id);
        return {
          ...row.content,
          courseName: row.courseName,
          author: {
            id: row.author.id,
            displayName: row.author.displayName,
            roleCode: row.role.code,
            roleName: row.role.name,
          },
          ...(latestAudit
            ? {
                action: latestAudit.audit.action,
                reason: latestAudit.audit.reason,
                moderator: {
                  id: latestAudit.moderator.id,
                  displayName: latestAudit.moderator.displayName,
                },
              }
            : {}),
        };
      }),
      total: total?.value ?? 0,
    };
  }

  private async listReplies(input: CommunityAdminFilters) {
    const where = and(
      input.authorId ? eq(forumReplies.authorId, input.authorId) : undefined,
      input.courseId ? eq(forumPosts.courseId, input.courseId) : undefined,
      input.status ? eq(forumReplies.status, input.status) : undefined,
      input.keyword ? ilike(forumReplies.body, `%${input.keyword}%`) : undefined,
      input.from ? gte(forumReplies.createdAt, input.from) : undefined,
      input.to ? lte(forumReplies.createdAt, input.to) : undefined,
    );
    const rows = await getDb()
      .select({
        content: forumReplies,
        postTitle: forumPosts.title,
        courseId: forumPosts.courseId,
        courseName: courses.name,
        author: users,
        role: roles,
      })
      .from(forumReplies)
      .innerJoin(forumPosts, eq(forumReplies.postId, forumPosts.id))
      .innerJoin(users, eq(forumReplies.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(courses, eq(forumPosts.courseId, courses.id))
      .where(where)
      .orderBy(desc(forumReplies.createdAt), desc(forumReplies.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [total] = await getDb()
      .select({ value: count() })
      .from(forumReplies)
      .innerJoin(forumPosts, eq(forumReplies.postId, forumPosts.id))
      .where(where);
    return {
      items: rows.map((row) => ({
        ...row.content,
        postTitle: row.postTitle,
        courseId: row.courseId,
        courseName: row.courseName,
        author: {
          id: row.author.id,
          displayName: row.author.displayName,
          roleCode: row.role.code,
          roleName: row.role.name,
        },
      })),
      total: total?.value ?? 0,
    };
  }

  private async listAudit(input: CommunityAdminFilters) {
    const where = and(
      input.authorId ? eq(communityModerationAudit.moderatorId, input.authorId) : undefined,
      input.status ? eq(communityModerationAudit.targetType, input.status) : undefined,
      input.keyword
        ? or(
            ilike(communityModerationAudit.action, `%${input.keyword}%`),
            ilike(communityModerationAudit.reason, `%${input.keyword}%`),
          )
        : undefined,
      input.from ? gte(communityModerationAudit.createdAt, input.from) : undefined,
      input.to ? lte(communityModerationAudit.createdAt, input.to) : undefined,
    );
    const rows = await getDb()
      .select({ audit: communityModerationAudit, moderator: users })
      .from(communityModerationAudit)
      .innerJoin(users, eq(communityModerationAudit.moderatorId, users.id))
      .where(where)
      .orderBy(desc(communityModerationAudit.createdAt), desc(communityModerationAudit.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [total] = await getDb()
      .select({ value: count() })
      .from(communityModerationAudit)
      .where(where);
    return {
      items: rows.map((row) => ({
        ...row.audit,
        moderator: { id: row.moderator.id, displayName: row.moderator.displayName },
      })),
      total: total?.value ?? 0,
    };
  }
}

let repository: CommunityAdminRepository | null = null;

export function getCommunityAdminRepository() {
  if (!repository) repository = new CommunityAdminRepository();
  return repository;
}
