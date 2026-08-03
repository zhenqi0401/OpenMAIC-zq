import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { getDb, runDbTransaction } from '@/lib/storage/db';
import {
  communityModerationAudit,
  courseCategories,
  courseDanmaku,
  courseScenes,
  courses,
  examAttempts,
  examPolicies,
  forumPosts,
  forumReplies,
  inviteCodes,
  roles,
  users,
} from '@/lib/storage/schema';

export interface AdminUserQuery {
  q?: string;
  roleId?: string;
  status: 'all' | 'active' | 'disabled';
  page: number;
  pageSize: number;
}

export interface AdminUserRow {
  id: string;
  phone: string | null;
  hostUserId: string | null;
  displayName: string;
  status: string;
  role: { id: string; code: string; name: string; isAdmin: boolean };
}

export type UpdateUserStatusResult =
  | { outcome: 'updated'; user: AdminUserRow }
  | { outcome: 'not_found' }
  | { outcome: 'self_disable' }
  | { outcome: 'last_admin' };

export interface AdminCoursePreview {
  courseId: string;
  sceneKey: string;
  canvas: unknown;
}

export interface AdminExamAttemptRow {
  id: string;
  userId: string;
  displayName: string;
  roleName: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: Date;
}

export interface ExamAttemptStats {
  participantCount: number;
  attemptCount: number;
  passedCount: number;
  averageScore: number | null;
}

export interface CommunityWindowCounts {
  posts: number;
  replies: number;
  danmaku: number;
  moderationActions: number;
}

export interface CommunityActivityRow {
  type: 'posts' | 'replies' | 'danmaku';
  createdAt: Date;
}

const moderationActions = ['hide', 'restore', 'delete', 'pin', 'unpin', 'lock', 'unlock'];

function toUserRow(record: { user: typeof users.$inferSelect; role: typeof roles.$inferSelect }) {
  return {
    id: record.user.id,
    phone: record.user.phone,
    hostUserId: record.user.hostUserId,
    displayName: record.user.displayName,
    status: record.user.status,
    role: {
      id: record.role.id,
      code: record.role.code,
      name: record.role.name,
      isAdmin: record.role.isAdmin,
    },
  } satisfies AdminUserRow;
}

export class AdminDataRepository {
  constructor(private readonly tenantId?: string) {}

  async queryUsers(input: AdminUserQuery) {
    const where = and(
      this.tenantId ? eq(users.tenantId, this.tenantId) : undefined,
      input.q
        ? or(
            ilike(users.displayName, `%${input.q}%`),
            ilike(users.phone, `%${input.q}%`),
            ilike(users.hostUserId, `%${input.q}%`),
          )
        : undefined,
      input.roleId ? eq(users.roleId, input.roleId) : undefined,
      input.status === 'all' ? undefined : eq(users.status, input.status),
    );
    const [records, totalRows] = await Promise.all([
      getDb()
        .select({ user: users, role: roles })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(where)
        .orderBy(desc(users.updatedAt), desc(users.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      getDb().select({ value: count() }).from(users).where(where),
    ]);
    return { users: records.map(toUserRow), total: totalRows[0]?.value ?? 0 };
  }

  async updateUserStatus(input: {
    userId: string;
    currentUserId: string;
    status: 'active' | 'disabled';
  }): Promise<UpdateUserStatusResult> {
    return getDb().transaction(async (tx) => {
      // Serialize administrator status changes through the shared role rows. Locking only the
      // target user lets two concurrent requests both observe two active administrators and
      // disable both of them.
      await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.isAdmin, true),
            this.tenantId ? eq(roles.tenantId, this.tenantId) : undefined,
          ),
        )
        .orderBy(asc(roles.id))
        .for('update');
      const [record] = await tx
        .select({ user: users, role: roles })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(
          and(
            eq(users.id, input.userId),
            this.tenantId ? eq(users.tenantId, this.tenantId) : undefined,
          ),
        )
        .for('update')
        .limit(1);
      if (!record) return { outcome: 'not_found' } as const;
      if (input.status === 'disabled' && input.userId === input.currentUserId) {
        return { outcome: 'self_disable' } as const;
      }
      if (input.status === 'disabled' && record.role.isAdmin && record.user.status === 'active') {
        const [activeAdmin] = await tx
          .select({ value: count() })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(
            and(
              eq(users.status, 'active'),
              eq(roles.isAdmin, true),
              this.tenantId ? eq(users.tenantId, this.tenantId) : undefined,
            ),
          );
        if ((activeAdmin?.value ?? 0) <= 1) return { outcome: 'last_admin' } as const;
      }
      const [updated] = await tx
        .update(users)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            eq(users.id, input.userId),
            this.tenantId ? eq(users.tenantId, this.tenantId) : undefined,
          ),
        )
        .returning();
      return { outcome: 'updated', user: toUserRow({ user: updated, role: record.role }) } as const;
    });
  }

  async getCoursePreviews(courseIds: string[]): Promise<AdminCoursePreview[]> {
    if (courseIds.length === 0) return [];
    const rows = await getDb()
      .select({
        courseId: courseScenes.courseId,
        sceneKey: courseScenes.sceneKey,
        canvas: courseScenes.content,
        sceneOrder: courseScenes.sceneOrder,
      })
      .from(courseScenes)
      .innerJoin(courses, eq(courseScenes.courseId, courses.id))
      .where(
        and(
          inArray(courseScenes.courseId, courseIds),
          eq(courseScenes.type, 'slide'),
          this.tenantId
            ? or(eq(courses.scope, 'platform'), eq(courses.tenantId, this.tenantId))
            : undefined,
        ),
      )
      .orderBy(asc(courseScenes.courseId), asc(courseScenes.sceneOrder), asc(courseScenes.id));
    const firstByCourse = new Map<string, AdminCoursePreview>();
    for (const row of rows) {
      if (!firstByCourse.has(row.courseId)) {
        firstByCourse.set(row.courseId, {
          courseId: row.courseId,
          sceneKey: row.sceneKey,
          canvas:
            row.canvas && typeof row.canvas === 'object' && 'canvas' in row.canvas
              ? row.canvas.canvas
              : row.canvas,
        });
      }
    }
    return [...firstByCourse.values()];
  }

  async reorderCategories(categoryIds: string[]): Promise<boolean> {
    return runDbTransaction<boolean>(async (tx) => {
      const current = await tx
        .select({ id: courseCategories.id })
        .from(courseCategories)
        .where(
          this.tenantId
            ? and(
                eq(courseCategories.scope, 'tenant'),
                eq(courseCategories.tenantId, this.tenantId),
              )
            : undefined,
        )
        .for('update');
      const currentIds = new Set(current.map((row) => row.id));
      if (
        categoryIds.length !== currentIds.size ||
        new Set(categoryIds).size !== categoryIds.length ||
        categoryIds.some((id) => !currentIds.has(id))
      ) {
        return false;
      }
      const now = new Date();
      for (const [sortOrder, id] of categoryIds.entries()) {
        await tx
          .update(courseCategories)
          .set({ sortOrder, updatedAt: now })
          .where(
            and(
              eq(courseCategories.id, id),
              this.tenantId ? eq(courseCategories.tenantId, this.tenantId) : undefined,
            ),
          );
      }
      return true;
    });
  }

  async deleteCategory(id: string): Promise<'deleted' | 'not_found' | 'in_use'> {
    return runDbTransaction(async (tx) => {
      const [category] = await tx
        .select({ id: courseCategories.id })
        .from(courseCategories)
        .where(
          and(
            eq(courseCategories.id, id),
            this.tenantId ? eq(courseCategories.tenantId, this.tenantId) : undefined,
            this.tenantId ? eq(courseCategories.scope, 'tenant') : undefined,
          ),
        )
        .for('update')
        .limit(1);
      if (!category) return 'not_found' as const;
      const [usage] = await tx
        .select({ value: count() })
        .from(courses)
        .where(eq(courses.categoryId, id));
      if ((usage?.value ?? 0) > 0) return 'in_use' as const;
      await tx.delete(courseCategories).where(eq(courseCategories.id, id));
      return 'deleted' as const;
    });
  }

  async getExamAttemptStats(examPolicyId?: string): Promise<ExamAttemptStats> {
    const where = and(
      examPolicyId ? eq(examAttempts.examPolicyId, examPolicyId) : undefined,
      this.tenantId ? eq(examAttempts.tenantId, this.tenantId) : undefined,
    );
    const [row] = await getDb()
      .select({
        participantCount: countDistinct(examAttempts.userId),
        attemptCount: count(),
        passedCount: sql<number>`count(*) filter (where ${examAttempts.passed} = true)`,
        averageScore: sql<string | null>`avg(${examAttempts.score})`,
      })
      .from(examAttempts)
      .where(where);
    return {
      participantCount: Number(row?.participantCount ?? 0),
      attemptCount: Number(row?.attemptCount ?? 0),
      passedCount: Number(row?.passedCount ?? 0),
      averageScore: row?.averageScore === null ? null : Number(row?.averageScore ?? 0),
    };
  }

  async queryExamAttempts(input: { examPolicyId: string; page: number; pageSize: number }) {
    const where = and(
      eq(examAttempts.examPolicyId, input.examPolicyId),
      this.tenantId ? eq(examAttempts.tenantId, this.tenantId) : undefined,
    );
    const [rows, totalRows] = await Promise.all([
      getDb()
        .select({ attempt: examAttempts, user: users, role: roles })
        .from(examAttempts)
        .innerJoin(users, eq(examAttempts.userId, users.id))
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(where)
        .orderBy(desc(examAttempts.createdAt), desc(examAttempts.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      getDb().select({ value: count() }).from(examAttempts).where(where),
    ]);
    return {
      attempts: rows.map(
        (row): AdminExamAttemptRow => ({
          id: row.attempt.id,
          userId: row.user.id,
          displayName: row.user.displayName,
          roleName: row.role.name,
          score: row.attempt.score,
          passed: row.attempt.passed,
          attemptNumber: row.attempt.attemptNumber,
          submittedAt: row.attempt.createdAt,
        }),
      ),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async getCommunityWindowCounts(start: Date, end: Date): Promise<CommunityWindowCounts> {
    const [[posts], [replies], [danmaku], [actions]] = await Promise.all([
      getDb()
        .select({ value: count() })
        .from(forumPosts)
        .where(
          and(
            gte(forumPosts.createdAt, start),
            lt(forumPosts.createdAt, end),
            this.tenantId ? eq(forumPosts.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ value: count() })
        .from(forumReplies)
        .where(
          and(
            gte(forumReplies.createdAt, start),
            lt(forumReplies.createdAt, end),
            this.tenantId ? eq(forumReplies.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ value: count() })
        .from(courseDanmaku)
        .where(
          and(
            gte(courseDanmaku.createdAt, start),
            lt(courseDanmaku.createdAt, end),
            this.tenantId ? eq(courseDanmaku.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ value: count() })
        .from(communityModerationAudit)
        .where(
          and(
            gte(communityModerationAudit.createdAt, start),
            lt(communityModerationAudit.createdAt, end),
            inArray(communityModerationAudit.action, moderationActions),
            this.tenantId ? eq(communityModerationAudit.tenantId, this.tenantId) : undefined,
          ),
        ),
    ]);
    return {
      posts: posts?.value ?? 0,
      replies: replies?.value ?? 0,
      danmaku: danmaku?.value ?? 0,
      moderationActions: actions?.value ?? 0,
    };
  }

  async listCommunityActivity(start: Date, end: Date): Promise<CommunityActivityRow[]> {
    const [postRows, replyRows, danmakuRows] = await Promise.all([
      getDb()
        .select({ createdAt: forumPosts.createdAt })
        .from(forumPosts)
        .where(
          and(
            gte(forumPosts.createdAt, start),
            lt(forumPosts.createdAt, end),
            this.tenantId ? eq(forumPosts.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ createdAt: forumReplies.createdAt })
        .from(forumReplies)
        .where(
          and(
            gte(forumReplies.createdAt, start),
            lt(forumReplies.createdAt, end),
            this.tenantId ? eq(forumReplies.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ createdAt: courseDanmaku.createdAt })
        .from(courseDanmaku)
        .where(
          and(
            gte(courseDanmaku.createdAt, start),
            lt(courseDanmaku.createdAt, end),
            this.tenantId ? eq(courseDanmaku.tenantId, this.tenantId) : undefined,
          ),
        ),
    ]);
    return [
      ...postRows.map((row) => ({ type: 'posts' as const, createdAt: row.createdAt })),
      ...replyRows.map((row) => ({ type: 'replies' as const, createdAt: row.createdAt })),
      ...danmakuRows.map((row) => ({ type: 'danmaku' as const, createdAt: row.createdAt })),
    ];
  }

  async getConfigurationHealth(now: Date) {
    const [[assignableRoles], [validInvites]] = await Promise.all([
      getDb()
        .select({ value: count() })
        .from(roles)
        .where(
          and(
            eq(roles.isAdmin, false),
            this.tenantId ? eq(roles.tenantId, this.tenantId) : undefined,
          ),
        ),
      getDb()
        .select({ value: count() })
        .from(inviteCodes)
        .where(
          and(
            eq(inviteCodes.enabled, true),
            or(isNull(inviteCodes.expiresAt), gte(inviteCodes.expiresAt, now)),
            this.tenantId ? eq(inviteCodes.tenantId, this.tenantId) : undefined,
          ),
        ),
    ]);
    return {
      assignableRoleCount: assignableRoles?.value ?? 0,
      validInviteCodeCount: validInvites?.value ?? 0,
    };
  }

  async getExamPolicy(id: string) {
    const [policy] = await getDb()
      .select()
      .from(examPolicies)
      .where(
        and(
          eq(examPolicies.id, id),
          this.tenantId ? eq(examPolicies.tenantId, this.tenantId) : undefined,
        ),
      )
      .limit(1);
    return policy ?? null;
  }
}

let repository: AdminDataRepository | null = null;

export function getAdminDataRepository(tenantId?: string) {
  if (tenantId) return new AdminDataRepository(tenantId);
  if (!repository) repository = new AdminDataRepository();
  return repository;
}
