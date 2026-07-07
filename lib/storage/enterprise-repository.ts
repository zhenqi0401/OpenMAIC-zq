import { and, eq, gte, lte } from 'drizzle-orm';

import { hashInviteCode, type AuthRole } from '@/lib/auth/service';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import type { DashboardSummary, HostQueryFilters } from '@/lib/host-api/types';
import { getDb, runDbTransaction } from './db';
import {
  assessmentAttempts,
  courseCategories,
  courseProgress,
  courses,
  courseAudioBlobs,
  courseVisibilityRoles,
  examAttempts,
  examPolicies,
  examPolicyCourses,
  hostApiKeys,
  inviteCodes,
  mediaFiles,
  outlines,
  roles,
  scenes,
  users,
} from './schema';
import {
  type CourseStatus,
  type CourseVisibilityMode,
  type CreateCourseInput,
  type CreateMediaFileInput,
  type EnterpriseAssessmentAttempt,
  type EnterpriseAssessmentAttemptInput,
  type EnterpriseAttemptDetail,
  type EnterpriseAudioBlob,
  type EnterpriseCategory,
  type EnterpriseCourse,
  type EnterpriseCourseContent,
  type EnterpriseCourseProgress,
  type EnterpriseExamAttempt,
  type EnterpriseExamAttemptInput,
  type EnterpriseExamPolicy,
  type EnterpriseInviteCode,
  type EnterpriseMediaBlob,
  type EnterpriseMediaFile,
  type EnterpriseProgressDetail,
  type EnterpriseRepository,
  type ReplaceCourseContentInput,
} from './enterprise-service';

function toRole(role: typeof roles.$inferSelect): AuthRole {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    isAdmin: role.isAdmin,
  };
}

function toCategory(category: typeof courseCategories.$inferSelect): EnterpriseCategory {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInviteCode(inviteCode: typeof inviteCodes.$inferSelect): EnterpriseInviteCode {
  return {
    id: inviteCode.id,
    roleId: inviteCode.roleId,
    enabled: inviteCode.enabled,
    expiresAt: inviteCode.expiresAt,
    createdAt: inviteCode.createdAt,
  };
}

function toMediaFile(mediaFile: typeof mediaFiles.$inferSelect): EnterpriseMediaFile {
  return {
    id: mediaFile.id,
    courseId: mediaFile.courseId,
    sceneId: mediaFile.sceneId,
    sceneKey: mediaFile.sceneKey,
    mediaId: mediaFile.mediaId,
    mediaType: mediaFile.mediaType,
    mimeType: mediaFile.mimeType,
    sizeBytes: mediaFile.sizeBytes,
    prompt: mediaFile.prompt,
    params: mediaFile.params,
    createdAt: mediaFile.createdAt,
    updatedAt: mediaFile.updatedAt,
  };
}

function toAudioBlob(audio: typeof courseAudioBlobs.$inferSelect): EnterpriseAudioBlob {
  return {
    courseId: audio.courseId,
    sceneKey: audio.sceneKey,
    audioId: audio.audioId,
    mimeType: audio.mimeType,
    sizeBytes: audio.sizeBytes,
    text: audio.text,
    voice: audio.voice,
    blob: audio.blob,
    createdAt: audio.createdAt,
  };
}

function toAssessmentAttempt(
  attempt: typeof assessmentAttempts.$inferSelect,
): EnterpriseAssessmentAttempt {
  return {
    id: attempt.id,
    userId: attempt.userId,
    courseId: attempt.courseId,
    roleSnapshot: attempt.roleSnapshot,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    passed: attempt.passed,
    threshold: attempt.threshold,
    answers: attempt.answers as EnterpriseAssessmentAttempt['answers'],
    details: attempt.details as EnterpriseAssessmentAttempt['details'],
    createdAt: attempt.createdAt,
  };
}

function toExamAttempt(attempt: typeof examAttempts.$inferSelect): EnterpriseExamAttempt {
  return {
    id: attempt.id,
    examPolicyId: attempt.examPolicyId,
    userId: attempt.userId,
    roleSnapshot: attempt.roleSnapshot,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    passed: attempt.passed,
    threshold: attempt.threshold,
    duration: attempt.duration,
    answers: attempt.answers as EnterpriseExamAttempt['answers'],
    details: attempt.details as EnterpriseExamAttempt['details'],
    questionRefs: attempt.questionRefs as EnterpriseExamAttempt['questionRefs'],
    createdAt: attempt.createdAt,
  };
}

function toExamPolicy(
  policy: typeof examPolicies.$inferSelect,
  courseIds: string[],
): EnterpriseExamPolicy {
  return {
    id: policy.id,
    title: policy.title,
    targetRoleId: policy.targetRoleId,
    categoryIds: policy.categoryIds,
    courseIds,
    questionCount: policy.questionCount,
    passThreshold: policy.passThreshold,
    timeLimitMinutes: policy.timeLimit,
    status: policy.status as EnterpriseExamPolicy['status'],
  };
}

type CourseRow = typeof courses.$inferSelect & { categoryName?: string | null };

async function loadVisibleRoleIds(courseIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (courseIds.length === 0) return result;
  const rows = await getDb().select().from(courseVisibilityRoles);
  for (const row of rows) {
    if (!courseIds.includes(row.courseId)) continue;
    const current = result.get(row.courseId) ?? [];
    current.push(row.roleId);
    result.set(row.courseId, current);
  }
  return result;
}

function toCourse(row: CourseRow, visibleRoleIds: string[]): EnterpriseCourse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? null,
    status: row.status as CourseStatus,
    visibilityMode: row.visibilityMode as CourseVisibilityMode,
    visibleRoleIds,
    stageSnapshot: row.stageSnapshot,
    generationStatus: row.generationStatus,
    generationComplete: row.generationComplete,
    assessmentQuestions: row.assessmentQuestions,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function dateFilters(filters?: HostQueryFilters) {
  const clauses = [];
  if (filters?.from) clauses.push(gte(courseProgress.updatedAt, new Date(filters.from)));
  if (filters?.to) clauses.push(lte(courseProgress.updatedAt, new Date(filters.to)));
  return clauses;
}

interface HostFilterableRow {
  courseId?: string | null;
  roleId?: string | null;
  userId?: string | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
}

export function filterHostRowsForQuery<T extends HostFilterableRow>(
  rows: T[],
  filters?: HostQueryFilters,
  dateField: 'updatedAt' | 'createdAt' = 'updatedAt',
): T[] {
  if (!filters) return rows;

  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() : null;

  return rows.filter((row) => {
    if (filters.courseId && row.courseId !== filters.courseId) return false;
    if (filters.roleId && row.roleId !== filters.roleId) return false;
    if (filters.userId && row.userId !== filters.userId) return false;

    const rowDate = row[dateField] ?? row.updatedAt ?? row.createdAt ?? null;
    if (!rowDate) return from === null && to === null;

    const timestamp = rowDate.getTime();
    if (from !== null && timestamp < from) return false;
    if (to !== null && timestamp > to) return false;
    return true;
  });
}

export function filterDashboardRowsForPublishedCourses<
  T extends { courseId?: string | null },
  C extends { id: string; status: string },
>(courseRows: C[], rows: T[]): T[] {
  const publishedCourseIds = new Set(
    courseRows.filter((course) => course.status === 'published').map((course) => course.id),
  );
  return rows.filter((row) => !!row.courseId && publishedCourseIds.has(row.courseId));
}

export class DrizzleEnterpriseRepository implements EnterpriseRepository {
  async listRoles(): Promise<AuthRole[]> {
    const rows = await getDb().select().from(roles);
    return rows.map(toRole);
  }

  async createRole(input: { code: string; name: string; isAdmin?: boolean }): Promise<AuthRole> {
    const [role] = await getDb()
      .insert(roles)
      .values({ code: input.code, name: input.name, isAdmin: input.isAdmin ?? false })
      .returning();
    return toRole(role);
  }

  async updateRole(
    id: string,
    patch: { code?: string; name?: string; isAdmin?: boolean },
  ): Promise<AuthRole | null> {
    const [role] = await getDb()
      .update(roles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return role ? toRole(role) : null;
  }

  async listInviteCodes(): Promise<EnterpriseInviteCode[]> {
    const rows = await getDb().select().from(inviteCodes);
    return rows.map(toInviteCode);
  }

  async createInviteCode(input: {
    code: string;
    roleId: string;
    enabled?: boolean;
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<EnterpriseInviteCode> {
    const [inviteCode] = await getDb()
      .insert(inviteCodes)
      .values({
        codeHash: hashInviteCode(input.code),
        roleId: input.roleId,
        enabled: input.enabled ?? true,
        expiresAt: input.expiresAt ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return toInviteCode(inviteCode);
  }

  async updateInviteCode(
    id: string,
    patch: { enabled?: boolean; expiresAt?: Date | null; roleId?: string },
  ): Promise<EnterpriseInviteCode | null> {
    const [inviteCode] = await getDb()
      .update(inviteCodes)
      .set(patch)
      .where(eq(inviteCodes.id, id))
      .returning();
    return inviteCode ? toInviteCode(inviteCode) : null;
  }

  async listCategories(): Promise<EnterpriseCategory[]> {
    const rows = await getDb().select().from(courseCategories);
    return rows.map(toCategory);
  }

  async createCategory(input: { name: string; sortOrder?: number }): Promise<EnterpriseCategory> {
    const [category] = await getDb()
      .insert(courseCategories)
      .values({ name: input.name, sortOrder: input.sortOrder ?? 0 })
      .returning();
    return toCategory(category);
  }

  async updateCategory(
    id: string,
    patch: { name?: string; sortOrder?: number },
  ): Promise<EnterpriseCategory | null> {
    const [category] = await getDb()
      .update(courseCategories)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(courseCategories.id, id))
      .returning();
    return category ? toCategory(category) : null;
  }

  async listAdminCourses(): Promise<EnterpriseCourse[]> {
    const rows = await getDb()
      .select({ course: courses, categoryName: courseCategories.name })
      .from(courses)
      .leftJoin(courseCategories, eq(courses.categoryId, courseCategories.id));
    const roleIds = await loadVisibleRoleIds(rows.map((row) => row.course.id));
    return rows.map((row) =>
      toCourse({ ...row.course, categoryName: row.categoryName }, roleIds.get(row.course.id) ?? []),
    );
  }

  async createCourse(input: CreateCourseInput): Promise<EnterpriseCourse> {
    const [course] = await getDb()
      .insert(courses)
      .values({
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId,
        createdBy: input.createdBy ?? null,
        assessmentQuestions: input.assessmentQuestions ?? [],
        stageSnapshot: recordOrEmpty(input.stageSnapshot),
        generationStatus: input.generationStatus ?? 'draft',
        generationComplete: input.generationComplete ?? false,
      })
      .returning();
    return toCourse(course, []);
  }

  async updateCourse(
    id: string,
    patch: { name?: string; description?: string | null; categoryId?: string },
  ): Promise<EnterpriseCourse | null> {
    const [course] = await getDb()
      .update(courses)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    if (!course) return null;
    const roleIds = await loadVisibleRoleIds([id]);
    return toCourse(course, roleIds.get(id) ?? []);
  }

  async updateCourseVisibility(
    id: string,
    visibility: { visibilityMode: CourseVisibilityMode; visibleRoleIds: string[] },
  ): Promise<EnterpriseCourse | null> {
    const [course] = await getDb()
      .update(courses)
      .set({ visibilityMode: visibility.visibilityMode, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    if (!course) return null;

    await getDb().delete(courseVisibilityRoles).where(eq(courseVisibilityRoles.courseId, id));
    if (visibility.visibilityMode === 'roles' && visibility.visibleRoleIds.length > 0) {
      await getDb()
        .insert(courseVisibilityRoles)
        .values(visibility.visibleRoleIds.map((roleId) => ({ courseId: id, roleId })));
    }
    return toCourse(course, visibility.visibilityMode === 'roles' ? visibility.visibleRoleIds : []);
  }

  async publishCourse(id: string): Promise<EnterpriseCourse | null> {
    const [course] = await getDb()
      .update(courses)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    if (!course) return null;
    const roleIds = await loadVisibleRoleIds([id]);
    return toCourse(course, roleIds.get(id) ?? []);
  }

  async archiveCourse(id: string): Promise<EnterpriseCourse | null> {
    const [course] = await getDb()
      .update(courses)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    if (!course) return null;
    const roleIds = await loadVisibleRoleIds([id]);
    return toCourse(course, roleIds.get(id) ?? []);
  }

  async getCourseContent(id: string): Promise<EnterpriseCourseContent | null> {
    const allCourses = await this.listAdminCourses();
    const course = allCourses.find((candidate) => candidate.id === id);
    if (!course) return null;
    const [sceneRows, outlineRows] = await Promise.all([
      getDb().select().from(scenes).where(eq(scenes.courseId, id)),
      getDb().select().from(outlines).where(eq(outlines.courseId, id)),
    ]);
    return {
      course,
      stage: course.stageSnapshot,
      scenes: sceneRows
        .sort((a, b) => a.sceneOrder - b.sceneOrder)
        .map((row) => row.sceneData),
      outlines: outlineRows.flatMap((row) => (Array.isArray(row.outline) ? row.outline : [row.outline])),
      mediaManifest: [],
      audioManifest: [],
    };
  }

  async replaceCourseContent(
    courseId: string,
    input: ReplaceCourseContentInput,
  ): Promise<{
    courseId: string;
    scenes: unknown[];
    outlines: unknown[];
    stage?: unknown;
    generationStatus?: string;
    generationComplete?: boolean;
  }> {
    await runDbTransaction(async (tx) => {
      const courseUpdate: Partial<typeof courses.$inferInsert> = { updatedAt: new Date() };
      let shouldUpdateCourse = false;
      if (input.stage !== undefined) {
        courseUpdate.stageSnapshot = recordOrEmpty(input.stage);
        shouldUpdateCourse = true;
      }
      if (input.generationStatus !== undefined) {
        courseUpdate.generationStatus = input.generationStatus;
        shouldUpdateCourse = true;
      }
      if (input.generationComplete !== undefined) {
        courseUpdate.generationComplete = input.generationComplete;
        shouldUpdateCourse = true;
      }
      if (shouldUpdateCourse) {
        await tx.update(courses).set(courseUpdate).where(eq(courses.id, courseId));
      }

      await tx.delete(scenes).where(eq(scenes.courseId, courseId));
      await tx.delete(outlines).where(eq(outlines.courseId, courseId));

      if (input.scenes.length > 0) {
        await tx.insert(scenes).values(
          input.scenes.map((scene, index) => {
            const record =
              scene && typeof scene === 'object' ? (scene as Record<string, unknown>) : {};
            return {
              courseId,
              sceneKey: typeof record.id === 'string' ? record.id : `scene-${index + 1}`,
              type: typeof record.type === 'string' ? record.type : 'slide',
              title: typeof record.title === 'string' ? record.title : `Scene ${index + 1}`,
              sceneOrder: index,
              sceneData: scene,
              content: record.agents
                ? {
                    ...(record.content && typeof record.content === 'object' ? record.content : {}),
                    agents: record.agents,
                  }
                : (record.content ?? scene),
              actions: record.actions ?? null,
              whiteboards: record.whiteboards ?? null,
            };
          }),
        );
      }

      if (input.outlines.length > 0) {
        await tx.insert(outlines).values({
          courseId,
          outline: input.outlines,
          generationStatus: input.generationStatus ?? 'draft',
          generationComplete: input.generationComplete ?? false,
        });
      }
    });

    return {
      courseId,
      scenes: input.scenes,
      outlines: input.outlines,
      stage: input.stage,
      generationStatus: input.generationStatus,
      generationComplete: input.generationComplete,
    };
  }

  async updateCourseAssessmentQuestions(
    courseId: string,
    questions: unknown[],
  ): Promise<EnterpriseCourse | null> {
    const [course] = await getDb()
      .update(courses)
      .set({ assessmentQuestions: questions, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();
    if (!course) return null;
    const roleIds = await loadVisibleRoleIds([courseId]);
    return toCourse(course, roleIds.get(courseId) ?? []);
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<EnterpriseCourseProgress | null> {
    const [progress] = await getDb()
      .select()
      .from(courseProgress)
      .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, courseId)))
      .limit(1);
    return progress ?? null;
  }

  async upsertCourseProgress(input: EnterpriseCourseProgress): Promise<EnterpriseCourseProgress> {
    const [progress] = await getDb()
      .insert(courseProgress)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        sceneIndex: input.sceneIndex,
        actionIndex: input.actionIndex,
        completed: input.completed,
        completedAt: input.completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [courseProgress.userId, courseProgress.courseId],
        set: {
          sceneIndex: input.sceneIndex,
          actionIndex: input.actionIndex,
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return progress;
  }

  async listCourseAssessmentAttempts(
    userId: string,
    courseId: string,
  ): Promise<EnterpriseAssessmentAttempt[]> {
    const rows = await getDb()
      .select()
      .from(assessmentAttempts)
      .where(and(eq(assessmentAttempts.userId, userId), eq(assessmentAttempts.courseId, courseId)));
    return rows.map(toAssessmentAttempt);
  }

  async createAssessmentAttempt(
    input: EnterpriseAssessmentAttemptInput,
  ): Promise<EnterpriseAssessmentAttempt> {
    const [attempt] = await getDb()
      .insert(assessmentAttempts)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        roleSnapshot: input.roleSnapshot,
        attemptNumber: input.attemptNumber,
        score: input.score,
        passed: input.passed,
        threshold: input.threshold,
        answers: input.answers,
        details: input.details,
      })
      .returning();
    return toAssessmentAttempt(attempt);
  }

  async getDashboardSummary(filters?: HostQueryFilters): Promise<DashboardSummary> {
    const [progressRows, assessmentRows, examRows, learnerRows, courseRows] = await Promise.all([
      this.listCourseProgress(filters),
      this.listAssessmentAttempts(filters),
      this.listExamAttempts(filters),
      getDb().select().from(users).innerJoin(roles, eq(users.roleId, roles.id)),
      getDb().select().from(courses),
    ]);
    const learners = learnerRows.filter(
      (row) =>
        !row.roles.isAdmin &&
        (!filters?.roleId || row.roles.id === filters.roleId) &&
        (!filters?.userId || row.users.id === filters.userId),
    );
    const activeCourses = (filters?.courseId
      ? courseRows.filter((row) => row.id === filters.courseId)
      : courseRows
    ).filter((row) => row.status === 'published');
    const activeProgressRows = filterDashboardRowsForPublishedCourses(activeCourses, progressRows);
    const activeAssessmentRows = filterDashboardRowsForPublishedCourses(
      activeCourses,
      assessmentRows,
    );
    const completed = activeProgressRows.filter((row) => row.completed).length;
    const assessmentPassed = activeAssessmentRows.filter((row) => row.passed).length;
    const examPassed = examRows.filter((row) => row.passed).length;
    return {
      courseCompletionRate: activeProgressRows.length
        ? Math.round((completed / activeProgressRows.length) * 100)
        : 0,
      assessmentPassRate: activeAssessmentRows.length
        ? Math.round((assessmentPassed / activeAssessmentRows.length) * 100)
        : 0,
      examPassRate: examRows.length ? Math.round((examPassed / examRows.length) * 100) : 0,
      learnerCount: learners.length,
      courseCount: activeCourses.length,
      assessmentAttemptCount: activeAssessmentRows.length,
      examAttemptCount: examRows.length,
    };
  }

  async listCourseProgress(filters?: HostQueryFilters): Promise<EnterpriseProgressDetail[]> {
    const clauses = [
      filters?.courseId ? eq(courseProgress.courseId, filters.courseId) : undefined,
      filters?.userId ? eq(courseProgress.userId, filters.userId) : undefined,
      ...dateFilters(filters),
    ].filter(Boolean);
    const rows = await getDb()
      .select({
        progress: courseProgress,
        user: users,
        role: roles,
        course: courses,
      })
      .from(courseProgress)
      .innerJoin(users, eq(courseProgress.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(courses, eq(courseProgress.courseId, courses.id))
      .where(clauses.length ? and(...clauses) : undefined);
    return filterHostRowsForQuery(
      rows
        .filter((row) => row.course.status === 'published')
        .map((row) => ({
        userId: row.user.id,
        displayName: row.user.displayName,
        roleId: row.role.id,
        roleCode: row.role.code,
        courseId: row.course.id,
        courseName: row.course.name,
        completed: row.progress.completed,
        updatedAt: row.progress.updatedAt,
      })),
      filters,
    );
  }

  async listAssessmentAttempts(filters?: HostQueryFilters): Promise<EnterpriseAttemptDetail[]> {
    const rows = await getDb()
      .select({
        attempt: assessmentAttempts,
        user: users,
        role: roles,
        course: courses,
      })
      .from(assessmentAttempts)
      .innerJoin(users, eq(assessmentAttempts.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(courses, eq(assessmentAttempts.courseId, courses.id));
    return filterHostRowsForQuery(
      rows.map((row) => ({
        id: row.attempt.id,
        userId: row.user.id,
        displayName: row.user.displayName,
        roleId: row.role.id,
        roleCode: row.role.code,
        courseId: row.course.id,
        courseName: row.course.name,
        score: row.attempt.score,
        passed: row.attempt.passed,
        attemptNumber: row.attempt.attemptNumber,
        createdAt: row.attempt.createdAt,
      })),
      filters,
      'createdAt',
    );
  }

  async listExamAttempts(filters?: HostQueryFilters): Promise<EnterpriseAttemptDetail[]> {
    const rows = await getDb()
      .select({ attempt: examAttempts, user: users, role: roles, policy: examPolicies })
      .from(examAttempts)
      .innerJoin(users, eq(examAttempts.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(examPolicies, eq(examAttempts.examPolicyId, examPolicies.id));
    const allowedPolicyIds = filters?.courseId
      ? new Set(
          (
            await getDb()
              .select()
              .from(examPolicyCourses)
              .where(eq(examPolicyCourses.courseId, filters.courseId))
          ).map((mapping) => mapping.examPolicyId),
        )
      : null;
    const queryFilters = allowedPolicyIds ? { ...filters, courseId: undefined } : filters;
    const details = rows
      .filter((row) => !allowedPolicyIds || allowedPolicyIds.has(row.attempt.examPolicyId))
      .map((row) => ({
        id: row.attempt.id,
        userId: row.user.id,
        displayName: row.user.displayName,
        roleId: row.role.id,
        roleCode: row.role.code,
        examPolicyId: row.attempt.examPolicyId,
        examTitle: row.policy.title,
        score: row.attempt.score,
        passed: row.attempt.passed,
        attemptNumber: row.attempt.attemptNumber,
        createdAt: row.attempt.createdAt,
      }));
    return filterHostRowsForQuery(details, queryFilters, 'createdAt');
  }

  async listExamPolicies(): Promise<EnterpriseExamPolicy[]> {
    const [policies, policyCourses] = await Promise.all([
      getDb().select().from(examPolicies),
      getDb().select().from(examPolicyCourses),
    ]);
    return policies.map((policy) =>
      toExamPolicy(
        policy,
        policyCourses
          .filter((mapping) => mapping.examPolicyId === policy.id)
          .map((mapping) => mapping.courseId),
      ),
    );
  }

  async createExamPolicy(input: {
    title: string;
    targetRoleId: string;
    categoryIds: string[];
    courseIds: string[];
    questionCount: number;
    passThreshold: number;
    timeLimitMinutes?: number | null;
  }): Promise<EnterpriseExamPolicy> {
    const policy = await runDbTransaction<typeof examPolicies.$inferSelect>(async (tx) => {
      const [created] = await tx
        .insert(examPolicies)
        .values({
          title: input.title,
          targetRoleId: input.targetRoleId,
          categoryIds: input.categoryIds,
          questionCount: input.questionCount,
          passThreshold: input.passThreshold,
          timeLimit: input.timeLimitMinutes ?? null,
        })
        .returning();
      if (input.courseIds.length > 0) {
        await tx
          .insert(examPolicyCourses)
          .values(input.courseIds.map((courseId) => ({ examPolicyId: created.id, courseId })));
      }
      return created;
    });
    return toExamPolicy(policy, input.courseIds);
  }

  async updateExamPolicy(
    id: string,
    patch: {
      title?: string;
      targetRoleId?: string;
      categoryIds?: string[];
      courseIds?: string[];
      questionCount?: number;
      passThreshold?: number;
      timeLimitMinutes?: number | null;
      status?: EnterpriseExamPolicy['status'];
    },
  ): Promise<EnterpriseExamPolicy | null> {
    const [policy] = await getDb()
      .update(examPolicies)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.targetRoleId !== undefined ? { targetRoleId: patch.targetRoleId } : {}),
        ...(patch.categoryIds !== undefined ? { categoryIds: patch.categoryIds } : {}),
        ...(patch.questionCount !== undefined ? { questionCount: patch.questionCount } : {}),
        ...(patch.passThreshold !== undefined ? { passThreshold: patch.passThreshold } : {}),
        ...(patch.timeLimitMinutes !== undefined ? { timeLimit: patch.timeLimitMinutes } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(examPolicies.id, id))
      .returning();
    if (!policy) return null;

    if (patch.courseIds) {
      await getDb().delete(examPolicyCourses).where(eq(examPolicyCourses.examPolicyId, id));
      if (patch.courseIds.length > 0) {
        await getDb()
          .insert(examPolicyCourses)
          .values(patch.courseIds.map((courseId) => ({ examPolicyId: id, courseId })));
      }
    }

    const courseIds =
      patch.courseIds ??
      (
        await getDb().select().from(examPolicyCourses).where(eq(examPolicyCourses.examPolicyId, id))
      ).map((mapping) => mapping.courseId);
    return toExamPolicy(policy, courseIds);
  }

  async publishExamPolicy(id: string): Promise<EnterpriseExamPolicy | null> {
    return this.updateExamPolicy(id, { status: 'published' });
  }

  async listExamAttemptsForUser(
    examPolicyId: string,
    userId: string,
  ): Promise<EnterpriseExamAttempt[]> {
    const rows = await getDb()
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examPolicyId, examPolicyId), eq(examAttempts.userId, userId)));
    return rows.map(toExamAttempt);
  }

  async createExamAttempt(input: EnterpriseExamAttemptInput): Promise<EnterpriseExamAttempt> {
    const [attempt] = await getDb()
      .insert(examAttempts)
      .values({
        examPolicyId: input.examPolicyId,
        userId: input.userId,
        roleSnapshot: input.roleSnapshot,
        attemptNumber: input.attemptNumber,
        score: input.score,
        passed: input.passed,
        threshold: input.threshold,
        duration: input.duration,
        answers: input.answers,
        details: input.details,
        questionRefs: input.questionRefs,
      })
      .returning();
    return toExamAttempt(attempt);
  }

  async findHostApiKey(keyId: string): Promise<StoredHostApiKey | null> {
    const [key] = await getDb()
      .select()
      .from(hostApiKeys)
      .where(eq(hostApiKeys.keyId, keyId))
      .limit(1);
    return key ? { keyId: key.keyId, secretHash: key.secretHash, enabled: key.enabled } : null;
  }

  async touchHostApiKey(keyId: string): Promise<void> {
    await getDb()
      .update(hostApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(hostApiKeys.keyId, keyId));
  }

  async createMediaFile(input: CreateMediaFileInput): Promise<EnterpriseMediaFile> {
    const [mediaFile] = await getDb()
      .insert(mediaFiles)
      .values({
        courseId: input.courseId ?? null,
        sceneId: input.sceneId ?? null,
        sceneKey: input.sceneKey ?? null,
        mediaId: input.mediaId,
        mediaType: input.mediaType,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
        blob: input.blob,
        posterBlob: input.posterBlob ?? null,
      })
      .returning();
    return toMediaFile(mediaFile);
  }

  async listMediaFiles(filters?: {
    courseId?: string;
    sceneId?: string;
  }): Promise<EnterpriseMediaFile[]> {
    const clauses = [
      filters?.courseId ? eq(mediaFiles.courseId, filters.courseId) : undefined,
      filters?.sceneId ? eq(mediaFiles.sceneId, filters.sceneId) : undefined,
    ].filter(Boolean);
    const rows = await getDb()
      .select()
      .from(mediaFiles)
      .where(clauses.length ? and(...clauses) : undefined);
    return rows.map(toMediaFile);
  }

  async getMediaFileBlob(courseId: string, mediaId: string): Promise<EnterpriseMediaBlob | null> {
    const [mediaFile] = await getDb()
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.courseId, courseId), eq(mediaFiles.mediaId, mediaId)))
      .limit(1);
    return mediaFile
      ? {
          courseId,
          mediaId,
          mediaType: mediaFile.mediaType,
          mimeType: mediaFile.mimeType,
          sizeBytes: mediaFile.sizeBytes,
          blob: mediaFile.blob,
        }
      : null;
  }

  async createCourseAudioBlob(input: {
    courseId: string;
    sceneKey?: string | null;
    audioId: string;
    mimeType?: string | null;
    sizeBytes?: number;
    text?: string | null;
    voice?: string | null;
    blob: Buffer;
  }): Promise<EnterpriseAudioBlob> {
    const [audio] = await getDb()
      .insert(courseAudioBlobs)
      .values({
        courseId: input.courseId,
        sceneKey: input.sceneKey ?? null,
        audioId: input.audioId,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? input.blob.byteLength,
        text: input.text ?? null,
        voice: input.voice ?? null,
        blob: input.blob,
      })
      .returning();
    return toAudioBlob(audio);
  }

  async listCourseAudioBlobs(courseId: string): Promise<EnterpriseAudioBlob[]> {
    const rows = await getDb()
      .select()
      .from(courseAudioBlobs)
      .where(eq(courseAudioBlobs.courseId, courseId));
    return rows.map(toAudioBlob);
  }

  async getCourseAudioBlob(courseId: string, audioId: string): Promise<EnterpriseAudioBlob | null> {
    const [audio] = await getDb()
      .select()
      .from(courseAudioBlobs)
      .where(and(eq(courseAudioBlobs.courseId, courseId), eq(courseAudioBlobs.audioId, audioId)))
      .limit(1);
    return audio ? toAudioBlob(audio) : null;
  }
}

let repository: EnterpriseRepository | null = null;

export function getEnterpriseRepository(): EnterpriseRepository {
  if (!repository) repository = new DrizzleEnterpriseRepository();
  return repository;
}
