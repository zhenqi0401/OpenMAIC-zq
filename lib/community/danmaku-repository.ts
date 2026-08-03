import { and, asc, eq, gt, gte, inArray, or } from 'drizzle-orm';

import { getDb, runDbTransaction } from '@/lib/storage/db';
import { communityModerationAudit, courseDanmaku, roles, users } from '@/lib/storage/schema';
import type { AdminDanmaku, DanmakuRecord, DanmakuRepository, DanmakuStatus } from './danmaku';

function toRecord(row: typeof courseDanmaku.$inferSelect): DanmakuRecord {
  return {
    ...row,
    inputSource: row.inputSource as DanmakuRecord['inputSource'],
    status: row.status as DanmakuStatus,
  };
}

function cursorClause(after: { createdAt: Date; id: string } | undefined) {
  if (!after) return undefined;
  return or(
    gt(courseDanmaku.createdAt, after.createdAt),
    and(eq(courseDanmaku.createdAt, after.createdAt), gt(courseDanmaku.id, after.id)),
  );
}

async function getAdminDanmaku(id: string): Promise<AdminDanmaku | null> {
  const [row] = await getDb()
    .select({ danmaku: courseDanmaku, author: users, role: roles })
    .from(courseDanmaku)
    .innerJoin(users, eq(courseDanmaku.authorId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(courseDanmaku.id, id))
    .limit(1);
  return row
    ? {
        ...toRecord(row.danmaku),
        author: {
          id: row.author.id,
          displayName: row.author.displayName,
          status: row.author.status,
          roleId: row.role.id,
          roleCode: row.role.code,
        },
      }
    : null;
}

export class DrizzleDanmakuRepository implements DanmakuRepository {
  async listVisible(input: Parameters<DanmakuRepository['listVisible']>[0]) {
    const rows = await getDb()
      .select()
      .from(courseDanmaku)
      .where(
        and(
          eq(courseDanmaku.courseId, input.courseId),
          eq(courseDanmaku.sceneKey, input.sceneKey),
          eq(courseDanmaku.status, 'visible'),
          cursorClause(input.after),
        ),
      )
      .orderBy(asc(courseDanmaku.createdAt), asc(courseDanmaku.id))
      .limit(input.limit);
    return rows.map(toRecord);
  }

  async findByRequestId(input: Parameters<DanmakuRepository['findByRequestId']>[0]) {
    const [row] = await getDb()
      .select()
      .from(courseDanmaku)
      .where(
        and(
          eq(courseDanmaku.authorId, input.authorId),
          eq(courseDanmaku.courseId, input.courseId),
          eq(courseDanmaku.clientRequestId, input.clientRequestId),
        ),
      )
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async getAuthorSendWindow(authorId: string, since: Date) {
    const rows = await getDb()
      .select()
      .from(courseDanmaku)
      .where(and(eq(courseDanmaku.authorId, authorId), gte(courseDanmaku.createdAt, since)))
      .orderBy(asc(courseDanmaku.createdAt))
      .limit(20);
    return rows.map(toRecord);
  }

  async create(input: Parameters<DanmakuRepository['create']>[0]) {
    const [author] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, input.authorId))
      .limit(1);
    if (!author) throw new Error('Danmaku author not found');
    const [row] = await getDb()
      .insert(courseDanmaku)
      .values({
        tenantId: author.tenantId,
        courseId: input.courseId,
        sceneKey: input.sceneKey,
        actionId: input.actionId,
        actionOffsetMs: input.actionOffsetMs,
        authorId: input.authorId,
        content: input.content,
        inputSource: input.inputSource,
        clientRequestId: input.clientRequestId ?? null,
      })
      .returning();
    return toRecord(row);
  }

  async softDeleteByAuthor(input: Parameters<DanmakuRepository['softDeleteByAuthor']>[0]) {
    const now = new Date();
    const [row] = await getDb()
      .update(courseDanmaku)
      .set({ status: 'deleted_by_author', deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(courseDanmaku.id, input.id),
          eq(courseDanmaku.courseId, input.courseId),
          eq(courseDanmaku.authorId, input.authorId),
          inArray(courseDanmaku.status, ['visible', 'hidden']),
        ),
      )
      .returning();
    return row ? toRecord(row) : null;
  }

  async listAdmin(input: Parameters<DanmakuRepository['listAdmin']>[0]) {
    const rows = await getDb()
      .select({ danmaku: courseDanmaku, author: users, role: roles })
      .from(courseDanmaku)
      .innerJoin(users, eq(courseDanmaku.authorId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          input.courseId ? eq(courseDanmaku.courseId, input.courseId) : undefined,
          input.tenantId ? eq(courseDanmaku.tenantId, input.tenantId) : undefined,
          input.sceneKey ? eq(courseDanmaku.sceneKey, input.sceneKey) : undefined,
          input.authorId ? eq(courseDanmaku.authorId, input.authorId) : undefined,
          input.status ? eq(courseDanmaku.status, input.status) : undefined,
          cursorClause(input.after),
        ),
      )
      .orderBy(asc(courseDanmaku.createdAt), asc(courseDanmaku.id))
      .limit(input.limit);
    return rows.map((row) => ({
      ...toRecord(row.danmaku),
      author: {
        id: row.author.id,
        displayName: row.author.displayName,
        status: row.author.status,
        roleId: row.role.id,
        roleCode: row.role.code,
      },
    }));
  }

  async moderate(input: Parameters<DanmakuRepository['moderate']>[0]) {
    const id = await runDbTransaction<string | null>(async (tx) => {
      const now = new Date();
      const [ownership] = await tx
        .select({ moderatorTenantId: users.tenantId, authorTenantId: courseDanmaku.tenantId })
        .from(users)
        .innerJoin(courseDanmaku, eq(courseDanmaku.id, input.id))
        .where(eq(users.id, input.adminId))
        .limit(1);
      if (!ownership || ownership.moderatorTenantId !== ownership.authorTenantId) return null;
      const status =
        input.action === 'hide'
          ? 'hidden'
          : input.action === 'delete'
            ? 'deleted_by_admin'
            : 'visible';
      const allowedStatuses: DanmakuStatus[] =
        input.action === 'hide'
          ? ['visible']
          : input.action === 'delete'
            ? ['visible', 'hidden']
            : ['hidden', 'deleted_by_admin'];
      const [row] = await tx
        .update(courseDanmaku)
        .set({
          status,
          deletedAt: status === 'deleted_by_admin' ? now : null,
          moderatedBy: input.adminId,
          moderationReason: input.reason ?? null,
          moderatedAt: now,
          updatedAt: now,
        })
        .where(and(eq(courseDanmaku.id, input.id), inArray(courseDanmaku.status, allowedStatuses)))
        .returning({ id: courseDanmaku.id });
      if (!row) return null;
      await tx.insert(communityModerationAudit).values({
        tenantId: ownership.moderatorTenantId,
        moderatorId: input.adminId,
        targetType: 'danmaku',
        targetId: row.id,
        action: input.action,
        reason: input.reason ?? null,
        createdAt: now,
      });
      return row.id;
    });
    return id ? getAdminDanmaku(id) : null;
  }
}

let repository: DanmakuRepository | null = null;

export function getDanmakuRepository(): DanmakuRepository {
  if (!repository) repository = new DrizzleDanmakuRepository();
  return repository;
}
