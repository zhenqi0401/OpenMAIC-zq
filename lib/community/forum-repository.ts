import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';

import { getDb, runDbTransaction } from '@/lib/storage/db';
import {
  communityModerationAudit,
  courseVisibilityRoles,
  courses,
  forumPosts,
  forumReplies,
  roles,
  users,
} from '@/lib/storage/schema';
import {
  FORUM_REPLY_MAX_DEPTH,
  type ForumPost,
  type ForumPostStatus,
  type ForumReply,
  type ForumReplyStatus,
  type ForumRepository,
} from './forum';

const postSelection = {
  post: forumPosts,
  courseName: courses.name,
  author: users,
  role: roles,
};

const replySelection = { reply: forumReplies, author: users, role: roles };

function toPost(row: {
  post: typeof forumPosts.$inferSelect;
  courseName: string | null;
  author: typeof users.$inferSelect;
  role: typeof roles.$inferSelect;
}): ForumPost {
  return {
    ...row.post,
    scope: row.post.scope as ForumPost['scope'],
    status: row.post.status as ForumPostStatus,
    courseName: row.courseName,
    author: {
      id: row.author.id,
      displayName: row.author.displayName,
      roleCode: row.role.code,
      roleName: row.role.name,
    },
  };
}

function toReply(row: {
  reply: typeof forumReplies.$inferSelect;
  author: typeof users.$inferSelect;
  role: typeof roles.$inferSelect;
}): ForumReply {
  return {
    ...row.reply,
    status: row.reply.status as ForumReplyStatus,
    author: {
      id: row.author.id,
      displayName: row.author.displayName,
      roleCode: row.role.code,
      roleName: row.role.name,
    },
  };
}

function courseAccessClause(roleId: string) {
  return or(
    eq(forumPosts.scope, 'global'),
    and(
      eq(forumPosts.scope, 'course'),
      eq(courses.status, 'published'),
      or(
        eq(courses.visibilityMode, 'all'),
        sql`exists (
          select 1 from ${courseVisibilityRoles}
          where ${courseVisibilityRoles.courseId} = ${forumPosts.courseId}
            and ${courseVisibilityRoles.roleId} = ${roleId}
        )`,
      ),
    ),
  );
}

async function loadPost(id: string): Promise<ForumPost | null> {
  const [row] = await getDb()
    .select(postSelection)
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(courses, eq(forumPosts.courseId, courses.id))
    .where(eq(forumPosts.id, id))
    .limit(1);
  return row ? toPost(row) : null;
}

async function loadReply(id: string): Promise<ForumReply | null> {
  const [row] = await getDb()
    .select(replySelection)
    .from(forumReplies)
    .innerJoin(users, eq(forumReplies.authorId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(forumReplies.id, id))
    .limit(1);
  return row ? toReply(row) : null;
}

export class DrizzleForumRepository implements ForumRepository {
  async listPosts(input: Parameters<ForumRepository['listPosts']>[0]) {
    const where = and(
      or(
        eq(forumPosts.status, 'visible'),
        and(eq(forumPosts.status, 'deleted_by_author'), gt(forumPosts.replyCount, 0)),
      ),
      courseAccessClause(input.roleId),
      input.tenantId
        ? or(
            eq(forumPosts.scope, 'global'),
            eq(courses.scope, 'platform'),
            eq(courses.tenantId, input.tenantId),
          )
        : undefined,
      input.authorId ? eq(forumPosts.authorId, input.authorId) : undefined,
      input.scope ? eq(forumPosts.scope, input.scope) : undefined,
      input.courseId ? eq(forumPosts.courseId, input.courseId) : undefined,
    );
    const orderColumn =
      input.sort === 'activity' ? forumPosts.lastActivityAt : forumPosts.createdAt;
    const rows = await getDb()
      .select(postSelection)
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(courses, eq(forumPosts.courseId, courses.id))
      .where(where)
      .orderBy(desc(forumPosts.pinned), desc(orderColumn), desc(forumPosts.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [totalRow] = await getDb()
      .select({ value: count() })
      .from(forumPosts)
      .leftJoin(courses, eq(forumPosts.courseId, courses.id))
      .where(where);
    return { items: rows.map(toPost), total: totalRow?.value ?? 0 };
  }

  getPost(id: string) {
    return loadPost(id);
  }

  async createPost(input: Parameters<ForumRepository['createPost']>[0]) {
    const now = new Date();
    const [author] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, input.authorId))
      .limit(1);
    if (!author) throw new Error('Forum post author not found');
    const [row] = await getDb()
      .insert(forumPosts)
      .values({ ...input, tenantId: author.tenantId, lastActivityAt: now })
      .returning({ id: forumPosts.id });
    return (await loadPost(row.id))!;
  }

  async updateOwnPost(input: Parameters<ForumRepository['updateOwnPost']>[0]) {
    const [row] = await getDb()
      .update(forumPosts)
      .set({ title: input.title, body: input.body, updatedAt: new Date() })
      .where(
        and(
          eq(forumPosts.id, input.id),
          eq(forumPosts.authorId, input.authorId),
          eq(forumPosts.status, 'visible'),
        ),
      )
      .returning({ id: forumPosts.id });
    return row ? loadPost(row.id) : null;
  }

  async deleteOwnPost(input: Parameters<ForumRepository['deleteOwnPost']>[0]) {
    const now = new Date();
    const [row] = await getDb()
      .update(forumPosts)
      .set({ status: 'deleted_by_author', deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(forumPosts.id, input.id),
          eq(forumPosts.authorId, input.authorId),
          eq(forumPosts.status, 'visible'),
        ),
      )
      .returning({ id: forumPosts.id });
    return row ? loadPost(row.id) : null;
  }

  async listReplies(input: Parameters<ForumRepository['listReplies']>[0]) {
    const rootWhere = and(
      eq(forumReplies.postId, input.postId),
      isNull(forumReplies.parentReplyId),
      eq(forumReplies.depth, 1),
    );
    const rootRows = await getDb()
      .select(replySelection)
      .from(forumReplies)
      .innerJoin(users, eq(forumReplies.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(rootWhere)
      .orderBy(asc(forumReplies.createdAt), asc(forumReplies.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    const rows = [...rootRows];
    let parentIds = rootRows.map(({ reply }) => reply.id);
    for (let depth = 2; depth <= FORUM_REPLY_MAX_DEPTH && parentIds.length > 0; depth += 1) {
      const childRows = await getDb()
        .select(replySelection)
        .from(forumReplies)
        .innerJoin(users, eq(forumReplies.authorId, users.id))
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(
          and(
            eq(forumReplies.postId, input.postId),
            eq(forumReplies.depth, depth),
            inArray(forumReplies.parentReplyId, parentIds),
          ),
        )
        .orderBy(asc(forumReplies.createdAt), asc(forumReplies.id));
      rows.push(...childRows);
      parentIds = childRows.map(({ reply }) => reply.id);
    }

    const [[totalRow], [rootTotalRow]] = await Promise.all([
      getDb()
        .select({ value: count() })
        .from(forumReplies)
        .where(and(eq(forumReplies.postId, input.postId), eq(forumReplies.status, 'visible'))),
      getDb().select({ value: count() }).from(forumReplies).where(rootWhere),
    ]);
    return {
      items: rows.map(toReply),
      total: totalRow?.value ?? 0,
      rootTotal: rootTotalRow?.value ?? 0,
    };
  }

  getReply(id: string) {
    return loadReply(id);
  }

  async createReply(input: Parameters<ForumRepository['createReply']>[0]) {
    const id = await runDbTransaction<string>(async (tx) => {
      const now = new Date();
      const [author] = await tx
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, input.authorId))
        .limit(1);
      if (!author) throw new Error('Forum reply author not found');
      const [reply] = await tx
        .insert(forumReplies)
        .values({ ...input, tenantId: author.tenantId })
        .returning({ id: forumReplies.id });
      await tx
        .update(forumPosts)
        .set({
          replyCount: sql`${forumPosts.replyCount} + 1`,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(forumPosts.id, input.postId));
      return reply.id;
    });
    return (await loadReply(id))!;
  }

  async updateOwnReply(input: Parameters<ForumRepository['updateOwnReply']>[0]) {
    const [row] = await getDb()
      .update(forumReplies)
      .set({ body: input.body, updatedAt: new Date() })
      .where(
        and(
          eq(forumReplies.id, input.id),
          eq(forumReplies.authorId, input.authorId),
          eq(forumReplies.status, 'visible'),
        ),
      )
      .returning({ id: forumReplies.id });
    return row ? loadReply(row.id) : null;
  }

  async deleteOwnReply(input: Parameters<ForumRepository['deleteOwnReply']>[0]) {
    const id = await runDbTransaction<string | null>(async (tx) => {
      const now = new Date();
      const [reply] = await tx
        .update(forumReplies)
        .set({ status: 'deleted_by_author', deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(forumReplies.id, input.id),
            eq(forumReplies.authorId, input.authorId),
            eq(forumReplies.status, 'visible'),
          ),
        )
        .returning({ id: forumReplies.id, postId: forumReplies.postId });
      if (!reply) return null;
      await tx
        .update(forumPosts)
        .set({ replyCount: sql`greatest(${forumPosts.replyCount} - 1, 0)`, updatedAt: now })
        .where(eq(forumPosts.id, reply.postId));
      return reply.id;
    });
    return id ? loadReply(id) : null;
  }

  async moderatePost(input: Parameters<ForumRepository['moderatePost']>[0]) {
    const id = await runDbTransaction<string | null>(async (tx) => {
      const now = new Date();
      const [ownership] = await tx
        .select({ moderatorTenantId: users.tenantId, authorTenantId: forumPosts.tenantId })
        .from(users)
        .innerJoin(forumPosts, eq(forumPosts.id, input.id))
        .where(eq(users.id, input.adminId))
        .limit(1);
      if (!ownership || ownership.moderatorTenantId !== ownership.authorTenantId) return null;
      const statePatch =
        input.action === 'hide'
          ? { status: 'hidden' }
          : input.action === 'delete'
            ? { status: 'deleted_by_admin', deletedAt: now }
            : input.action === 'restore'
              ? { status: 'visible', deletedAt: null }
              : input.action === 'pin'
                ? { pinned: true }
                : input.action === 'unpin'
                  ? { pinned: false }
                  : input.action === 'lock'
                    ? { locked: true }
                    : { locked: false };
      const allowed =
        input.action === 'hide'
          ? eq(forumPosts.status, 'visible')
          : input.action === 'delete'
            ? inArray(forumPosts.status, ['visible', 'hidden'])
            : input.action === 'restore'
              ? inArray(forumPosts.status, ['hidden', 'deleted_by_admin'])
              : eq(forumPosts.status, 'visible');
      const [row] = await tx
        .update(forumPosts)
        .set({
          ...statePatch,
          moderatedBy: input.adminId,
          moderationReason: input.reason ?? null,
          moderatedAt: now,
          updatedAt: now,
        })
        .where(and(eq(forumPosts.id, input.id), allowed))
        .returning({ id: forumPosts.id });
      if (!row) return null;
      await tx.insert(communityModerationAudit).values({
        tenantId: ownership.moderatorTenantId,
        moderatorId: input.adminId,
        targetType: 'forum_post',
        targetId: row.id,
        action: input.action,
        reason: input.reason ?? null,
        createdAt: now,
      });
      return row.id;
    });
    return id ? loadPost(id) : null;
  }

  async moderateReply(input: Parameters<ForumRepository['moderateReply']>[0]) {
    const id = await runDbTransaction<string | null>(async (tx) => {
      const now = new Date();
      const [ownership] = await tx
        .select({ moderatorTenantId: users.tenantId, authorTenantId: forumReplies.tenantId })
        .from(users)
        .innerJoin(forumReplies, eq(forumReplies.id, input.id))
        .where(eq(users.id, input.adminId))
        .limit(1);
      if (!ownership || ownership.moderatorTenantId !== ownership.authorTenantId) return null;
      const [reply] = await tx
        .update(forumReplies)
        .set({
          status:
            input.action === 'hide'
              ? 'hidden'
              : input.action === 'delete'
                ? 'deleted_by_admin'
                : 'visible',
          deletedAt:
            input.action === 'delete' ? now : input.action === 'restore' ? null : undefined,
          moderatedBy: input.adminId,
          moderationReason: input.reason ?? null,
          moderatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(forumReplies.id, input.id),
            input.action === 'hide'
              ? eq(forumReplies.status, 'visible')
              : input.action === 'delete'
                ? inArray(forumReplies.status, ['visible', 'hidden'])
                : inArray(forumReplies.status, ['hidden', 'deleted_by_admin']),
          ),
        )
        .returning({ id: forumReplies.id, postId: forumReplies.postId });
      if (!reply) return null;
      await tx.insert(communityModerationAudit).values({
        tenantId: ownership.moderatorTenantId,
        moderatorId: input.adminId,
        targetType: 'forum_reply',
        targetId: reply.id,
        action: input.action,
        reason: input.reason ?? null,
        createdAt: now,
      });
      await tx
        .update(forumPosts)
        .set({
          replyCount:
            input.action === 'hide' || input.action === 'delete'
              ? sql`greatest(${forumPosts.replyCount} - 1, 0)`
              : sql`${forumPosts.replyCount} + 1`,
          updatedAt: now,
        })
        .where(eq(forumPosts.id, reply.postId));
      return reply.id;
    });
    return id ? loadReply(id) : null;
  }
}

let repository: ForumRepository | null = null;

export function getForumRepository(): ForumRepository {
  if (!repository) repository = new DrizzleForumRepository();
  return repository;
}
