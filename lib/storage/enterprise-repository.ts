import { and, asc, count, eq, gte, lte } from 'drizzle-orm';

import { hashInviteCode, type AuthRole } from '@/lib/auth/service';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import type { DashboardSummary, HostQueryFilters } from '@/lib/host-api/types';
import { getDb, runDbTransaction } from './db';
import {
  assessmentAttempts,
  courseCategories,
  courseDanmaku,
  courseProgress,
  courses,
  courseAudioBlobs,
  courseVisibilityRoles,
  examAttempts,
  examPolicies,
  examPolicyCourses,
  forumPosts,
  hostApiKeys,
  inviteCodes,
  mediaFiles,
  outlines,
  roles,
  roleLearningPathCourses,
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
  type DeleteExamPolicyRepositoryResult,
  type EnterpriseInviteCode,
  type EnterpriseMediaBlob,
  type EnterpriseMediaFile,
  type EnterpriseProgressDetail,
  type EnterpriseRepository,
  type ReplaceCourseContentInput,
  type RoleLearningPathCourse,
  type EnterpriseLearner,
} from './enterprise-service';
import type { PreparedEnterpriseCourseImport } from '@/lib/import/enterprise-course-import';

function toRole(role: typeof roles.$inferSelect): AuthRole {
  return {
    id: role.id,
    tenantId: role.tenantId,
    code: role.code,
    name: role.name,
    isAdmin: role.isAdmin,
  };
}

function toCategory(category: typeof courseCategories.$inferSelect): EnterpriseCategory {
  return {
    id: category.id,
    tenantId: category.tenantId,
    scope: category.scope as EnterpriseCategory['scope'],
    managementMode: category.scope === 'platform' ? 'read_only' : 'editable',
    categoryKey: category.categoryKey,
    isSystem: category.categoryKey !== null,
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
    tenantId: inviteCode.tenantId,
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
    hasPoster: mediaFile.posterBlob !== null,
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
    tenantId: policy.tenantId,
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

function toCourse(
  row: CourseRow,
  visibleRoleIds: string[],
  learnerCount: number = 0,
  sceneCount: number = 0,
): EnterpriseCourse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scope: row.scope as EnterpriseCourse['scope'],
    managementMode: row.scope === 'platform' ? 'read_only' : 'editable',
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
    learnerCount,
    sceneCount,
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

export function calculateCourseCompletionRate(rows: Array<{ completed: boolean }>): number {
  if (rows.length === 0) return 0;
  const completed = rows.filter((row) => row.completed).length;
  return Math.round((completed / rows.length) * 100);
}

export class DrizzleEnterpriseRepository implements EnterpriseRepository {
  async listRoles(): Promise<AuthRole[]> {
    const rows = await getDb().select().from(roles);
    return rows.map(toRole);
  }

  async createRole(input: {
    tenantId: string;
    code: string;
    name: string;
    isAdmin?: boolean;
  }): Promise<AuthRole> {
    const [role] = await getDb()
      .insert(roles)
      .values({
        tenantId: input.tenantId,
        code: input.code,
        name: input.name,
        isAdmin: input.isAdmin ?? false,
      })
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

  async getRoleUsage(roleId: string): Promise<{
    users: number;
    inviteCodes: number;
    examPolicies: number;
    learningPathCourses?: number;
  }> {
    const [[userUsage], [inviteCodeUsage], [examPolicyUsage], [pathUsage]] = await Promise.all([
      getDb().select({ value: count() }).from(users).where(eq(users.roleId, roleId)),
      getDb().select({ value: count() }).from(inviteCodes).where(eq(inviteCodes.roleId, roleId)),
      getDb()
        .select({ value: count() })
        .from(examPolicies)
        .where(eq(examPolicies.targetRoleId, roleId)),
      getDb()
        .select({ value: count() })
        .from(roleLearningPathCourses)
        .where(eq(roleLearningPathCourses.roleId, roleId)),
    ]);
    return {
      users: userUsage?.value ?? 0,
      inviteCodes: inviteCodeUsage?.value ?? 0,
      examPolicies: examPolicyUsage?.value ?? 0,
      learningPathCourses: pathUsage?.value ?? 0,
    };
  }

  async listRoleLearningPath(roleId: string): Promise<RoleLearningPathCourse[]> {
    const rows = await getDb()
      .select({ path: roleLearningPathCourses, course: courses })
      .from(roleLearningPathCourses)
      .innerJoin(courses, eq(roleLearningPathCourses.courseId, courses.id))
      .where(eq(roleLearningPathCourses.roleId, roleId))
      .orderBy(asc(roleLearningPathCourses.position));
    const roleIds = await loadVisibleRoleIds(rows.map((row) => row.course.id));
    return rows.map(({ path, course }) => ({
      courseId: path.courseId,
      position: path.position,
      course: toCourse(course, roleIds.get(course.id) ?? []),
    }));
  }

  async listTenantLearners(tenantId: string): Promise<EnterpriseLearner[]> {
    const rows = await getDb()
      .select({ user: users, role: roles })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(eq(users.tenantId, tenantId), eq(roles.isAdmin, false), eq(users.status, 'active')),
      );
    return rows.map(({ user, role }) => ({
      id: user.id,
      displayName: user.displayName,
      roleId: role.id,
      roleCode: role.code,
    }));
  }

  async replaceRoleLearningPath(
    roleId: string,
    tenantId: string,
    courseIds: string[],
  ): Promise<RoleLearningPathCourse[]> {
    return runDbTransaction(async (tx) => {
      await tx.delete(roleLearningPathCourses).where(eq(roleLearningPathCourses.roleId, roleId));
      if (courseIds.length > 0) {
        await tx
          .insert(roleLearningPathCourses)
          .values(
            courseIds.map((courseId, position) => ({ roleId, tenantId, courseId, position })),
          );
      }
      const rows = await tx
        .select({ path: roleLearningPathCourses, course: courses })
        .from(roleLearningPathCourses)
        .innerJoin(courses, eq(roleLearningPathCourses.courseId, courses.id))
        .where(eq(roleLearningPathCourses.roleId, roleId))
        .orderBy(asc(roleLearningPathCourses.position));
      const roleIds = await loadVisibleRoleIds(rows.map((row) => row.course.id));
      return rows.map(({ path, course }) => ({
        courseId: path.courseId,
        position: path.position,
        course: toCourse(course, roleIds.get(course.id) ?? []),
      }));
    });
  }

  async deleteRole(id: string): Promise<AuthRole | null> {
    const [role] = await getDb().delete(roles).where(eq(roles.id, id)).returning();
    return role ? toRole(role) : null;
  }

  async listInviteCodes(): Promise<EnterpriseInviteCode[]> {
    const rows = await getDb().select().from(inviteCodes);
    return rows.map(toInviteCode);
  }

  async createInviteCode(input: {
    tenantId: string;
    code: string;
    roleId: string;
    enabled?: boolean;
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<EnterpriseInviteCode> {
    const [inviteCode] = await getDb()
      .insert(inviteCodes)
      .values({
        tenantId: input.tenantId,
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

  async deleteInviteCode(id: string): Promise<EnterpriseInviteCode | null> {
    const [inviteCode] = await getDb()
      .delete(inviteCodes)
      .where(eq(inviteCodes.id, id))
      .returning();
    return inviteCode ? toInviteCode(inviteCode) : null;
  }

  async listCategories(): Promise<EnterpriseCategory[]> {
    const rows = await getDb()
      .select()
      .from(courseCategories)
      .orderBy(
        asc(courseCategories.sortOrder),
        asc(courseCategories.name),
        asc(courseCategories.id),
      );
    return rows.map(toCategory);
  }

  async createCategory(input: {
    tenantId: string;
    name: string;
    sortOrder?: number;
  }): Promise<EnterpriseCategory> {
    const [category] = await getDb()
      .insert(courseCategories)
      .values({
        tenantId: input.tenantId,
        scope: 'tenant',
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      })
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
    const learnerCounts = getDb()
      .select({
        courseId: courseProgress.courseId,
        learnerCount: count(courseProgress.userId).as('learner_count'),
      })
      .from(courseProgress)
      .innerJoin(users, eq(courseProgress.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.isAdmin, false))
      .groupBy(courseProgress.courseId)
      .as('course_learner_counts');
    const sceneCounts = getDb()
      .select({
        courseId: scenes.courseId,
        sceneCount: count(scenes.id).as('scene_count'),
      })
      .from(scenes)
      .groupBy(scenes.courseId)
      .as('course_scene_counts');
    const rows = await getDb()
      .select({
        course: courses,
        categoryName: courseCategories.name,
        learnerCount: learnerCounts.learnerCount,
        sceneCount: sceneCounts.sceneCount,
      })
      .from(courses)
      .leftJoin(courseCategories, eq(courses.categoryId, courseCategories.id))
      .leftJoin(learnerCounts, eq(courses.id, learnerCounts.courseId))
      .leftJoin(sceneCounts, eq(courses.id, sceneCounts.courseId));
    const roleIds = await loadVisibleRoleIds(rows.map((row) => row.course.id));
    return rows.map((row) =>
      toCourse(
        { ...row.course, categoryName: row.categoryName },
        roleIds.get(row.course.id) ?? [],
        Number(row.learnerCount ?? 0),
        Number(row.sceneCount ?? 0),
      ),
    );
  }

  async createCourse(input: CreateCourseInput): Promise<EnterpriseCourse> {
    const [course] = await getDb()
      .insert(courses)
      .values({
        tenantId: input.tenantId,
        scope: 'tenant',
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

  async importEnterpriseCourse(
    input: PreparedEnterpriseCourseImport & {
      tenantId: string;
      categoryId: string;
      createdBy?: string | null;
    },
  ): Promise<EnterpriseCourse> {
    return runDbTransaction(async (tx) => {
      const [category] = await tx
        .select()
        .from(courseCategories)
        .where(eq(courseCategories.id, input.categoryId))
        .limit(1);
      if (!category) {
        throw new Error('Course category not found');
      }
      const stageName =
        typeof input.stage.name === 'string' ? input.stage.name : 'Imported Classroom';
      const description =
        typeof input.stage.description === 'string' ? input.stage.description : null;
      const [course] = await tx
        .insert(courses)
        .values({
          tenantId: input.tenantId,
          scope: 'tenant',
          name: stageName,
          description,
          categoryId: input.categoryId,
          createdBy: input.createdBy ?? null,
          status: 'draft',
          stageSnapshot: input.stage,
          generationStatus: 'ready',
          generationComplete: true,
          assessmentQuestions: [],
        })
        .returning();

      if (input.scenes.length > 0) {
        await tx.insert(scenes).values(
          input.scenes.map((scene, index) => ({
            courseId: course.id,
            sceneKey: typeof scene.id === 'string' ? scene.id : `scene-${index + 1}`,
            type: typeof scene.type === 'string' ? scene.type : 'slide',
            title: typeof scene.title === 'string' ? scene.title : `Scene ${index + 1}`,
            sceneOrder: index,
            sceneData: scene,
            content: scene.content ?? scene,
            actions: scene.actions ?? null,
            whiteboards: scene.whiteboards ?? null,
          })),
        );
      }
      await tx.insert(outlines).values({
        courseId: course.id,
        outline: input.outlines,
        generationStatus: 'ready',
        generationComplete: true,
      });

      const mediaBinaries = input.binaries.filter((binary) => binary.kind !== 'audio');
      if (mediaBinaries.length > 0) {
        await tx.insert(mediaFiles).values(
          mediaBinaries.map((binary) => ({
            courseId: course.id,
            mediaId: binary.mediaId,
            mediaType: binary.kind,
            mimeType: binary.mimeType,
            sizeBytes: binary.data.byteLength,
            prompt: binary.prompt ?? null,
            params: {},
            blob: Buffer.from(binary.data),
            posterBlob: binary.posterData ? Buffer.from(binary.posterData) : null,
          })),
        );
      }
      const audioBinaries = input.binaries.filter((binary) => binary.kind === 'audio');
      if (audioBinaries.length > 0) {
        await tx.insert(courseAudioBlobs).values(
          audioBinaries.map((binary) => ({
            courseId: course.id,
            audioId: binary.mediaId,
            mimeType: binary.mimeType,
            sizeBytes: binary.data.byteLength,
            voice: binary.voice ?? null,
            blob: Buffer.from(binary.data),
          })),
        );
      }
      return toCourse({ ...course, categoryName: category.name }, []);
    });
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

  async deleteCourse(id: string): Promise<EnterpriseCourse | null> {
    const deletedCourse = await runDbTransaction<typeof courses.$inferSelect | null>(async (tx) => {
      const [course] = await tx.select().from(courses).where(eq(courses.id, id)).limit(1);
      if (!course) return null;

      await tx.delete(mediaFiles).where(eq(mediaFiles.courseId, id));
      await tx.delete(assessmentAttempts).where(eq(assessmentAttempts.courseId, id));
      await tx.delete(courseProgress).where(eq(courseProgress.courseId, id));
      await tx.delete(examPolicyCourses).where(eq(examPolicyCourses.courseId, id));
      await tx.delete(courseVisibilityRoles).where(eq(courseVisibilityRoles.courseId, id));
      await tx.delete(courseAudioBlobs).where(eq(courseAudioBlobs.courseId, id));
      await tx.delete(courseDanmaku).where(eq(courseDanmaku.courseId, id));
      await tx
        .update(forumPosts)
        .set({ status: 'archived', courseId: null, updatedAt: new Date() })
        .where(eq(forumPosts.courseId, id));
      await tx.delete(outlines).where(eq(outlines.courseId, id));
      await tx.delete(scenes).where(eq(scenes.courseId, id));
      await tx.delete(courses).where(eq(courses.id, id));

      return course;
    });

    return deletedCourse ? toCourse(deletedCourse, []) : null;
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
      scenes: sceneRows.sort((a, b) => a.sceneOrder - b.sceneOrder).map((row) => row.sceneData),
      outlines: outlineRows.flatMap((row) =>
        Array.isArray(row.outline) ? row.outline : [row.outline],
      ),
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
    let ignoredStaleIncompleteUpdate = false;
    await runDbTransaction(async (tx) => {
      const [lockedCourse] = await tx
        .select({ generationComplete: courses.generationComplete })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for('update');

      // Completion is monotonic. A per-scene request that started before the
      // final completion request must not regress either the ready flag or the
      // fully-materialized scene snapshot when it arrives late.
      if (lockedCourse?.generationComplete && input.generationComplete === false) {
        ignoredStaleIncompleteUpdate = true;
        return;
      }

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
      generationStatus: ignoredStaleIncompleteUpdate ? 'ready' : input.generationStatus,
      generationComplete: ignoredStaleIncompleteUpdate ? true : input.generationComplete,
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

  async markCourseStarted(input: {
    tenantId?: string;
    userId: string;
    courseId: string;
  }): Promise<EnterpriseCourseProgress> {
    const now = new Date();
    const [progress] = await getDb()
      .insert(courseProgress)
      .values({
        tenantId: input.tenantId!,
        userId: input.userId,
        courseId: input.courseId,
        sceneIndex: 0,
        actionIndex: 0,
        completed: false,
        completedAt: null,
        startedAt: now,
        lastViewedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courseProgress.userId, courseProgress.courseId],
        set: { lastViewedAt: now, updatedAt: now },
      })
      .returning();
    return progress;
  }

  async upsertCourseProgress(input: EnterpriseCourseProgress): Promise<EnterpriseCourseProgress> {
    const [progress] = await getDb()
      .insert(courseProgress)
      .values({
        tenantId: input.tenantId!,
        userId: input.userId,
        courseId: input.courseId,
        sceneIndex: input.sceneIndex,
        actionIndex: input.actionIndex,
        completed: input.completed,
        completedAt: input.completed ? new Date() : null,
        startedAt: input.startedAt ?? new Date(),
        lastViewedAt: input.lastViewedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [courseProgress.userId, courseProgress.courseId],
        set: {
          sceneIndex: input.sceneIndex,
          actionIndex: input.actionIndex,
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
          lastViewedAt: input.lastViewedAt ?? new Date(),
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
        tenantId: input.tenantId!,
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
        (!filters?.tenantId || row.users.tenantId === filters.tenantId) &&
        (!filters?.roleId || row.roles.id === filters.roleId) &&
        (!filters?.userId || row.users.id === filters.userId),
    );
    const activeCourses = (
      filters?.courseId ? courseRows.filter((row) => row.id === filters.courseId) : courseRows
    ).filter(
      (row) =>
        row.status === 'published' &&
        (!filters?.tenantId || row.scope === 'platform' || row.tenantId === filters.tenantId),
    );
    const activeProgressRows = filterDashboardRowsForPublishedCourses(activeCourses, progressRows);
    const activeAssessmentRows = filterDashboardRowsForPublishedCourses(
      activeCourses,
      assessmentRows,
    );
    const assessmentPassed = activeAssessmentRows.filter((row) => row.passed).length;
    const examPassed = examRows.filter((row) => row.passed).length;
    return {
      courseCompletionRate: calculateCourseCompletionRate(activeProgressRows),
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
      filters?.tenantId ? eq(courseProgress.tenantId, filters.tenantId) : undefined,
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
        .filter((row) => row.course.status === 'published' && !row.role.isAdmin)
        .map((row) => ({
          userId: row.user.id,
          displayName: row.user.displayName,
          roleId: row.role.id,
          roleCode: row.role.code,
          courseId: row.course.id,
          courseName: row.course.name,
          completed: row.progress.completed,
          startedAt: row.progress.startedAt,
          lastViewedAt: row.progress.lastViewedAt,
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
    const tenantRows = filters?.tenantId
      ? rows.filter((row) => row.attempt.tenantId === filters.tenantId)
      : rows;
    return filterHostRowsForQuery(
      tenantRows.map((row) => ({
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
    const tenantRows = filters?.tenantId
      ? rows.filter((row) => row.attempt.tenantId === filters.tenantId)
      : rows;
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
    const details = tenantRows
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
      const [targetRole] = await tx
        .select({ tenantId: roles.tenantId })
        .from(roles)
        .where(eq(roles.id, input.targetRoleId))
        .limit(1);
      if (!targetRole) throw new Error('Target role not found');
      const [created] = await tx
        .insert(examPolicies)
        .values({
          tenantId: targetRole.tenantId,
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

  async deleteExamPolicy(id: string): Promise<DeleteExamPolicyRepositoryResult> {
    return runDbTransaction<DeleteExamPolicyRepositoryResult>(async (tx) => {
      const courseIds = (
        await tx.select().from(examPolicyCourses).where(eq(examPolicyCourses.examPolicyId, id))
      ).map((mapping) => mapping.courseId);
      const [deleted] = await tx
        .delete(examPolicies)
        .where(and(eq(examPolicies.id, id), eq(examPolicies.status, 'draft')))
        .returning();
      if (deleted) {
        return { outcome: 'deleted', policy: toExamPolicy(deleted, courseIds) };
      }

      const [existing] = await tx.select().from(examPolicies).where(eq(examPolicies.id, id));
      if (!existing) return { outcome: 'not_found' };
      return { outcome: 'not_draft', policy: toExamPolicy(existing, courseIds) };
    });
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
    const [user] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!user) throw new Error('Exam user not found');
    const [attempt] = await getDb()
      .insert(examAttempts)
      .values({
        tenantId: user.tenantId,
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
    return key
      ? {
          keyId: key.keyId,
          tenantId: key.tenantId,
          secretHash: key.secretHash,
          enabled: key.enabled,
        }
      : null;
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
        tenantId: input.tenantId ?? null,
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

  async getMediaFileBlob(
    courseId: string,
    mediaId: string,
    variant: 'media' | 'poster' = 'media',
  ): Promise<EnterpriseMediaBlob | null> {
    const [mediaFile] = await getDb()
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.courseId, courseId), eq(mediaFiles.mediaId, mediaId)))
      .limit(1);
    const selectedBlob = variant === 'poster' ? mediaFile?.posterBlob : mediaFile?.blob;
    return mediaFile && selectedBlob
      ? {
          courseId,
          mediaId,
          mediaType: mediaFile.mediaType,
          mimeType: variant === 'poster' ? 'image/jpeg' : mediaFile.mimeType,
          sizeBytes: selectedBlob.byteLength,
          blob: selectedBlob,
        }
      : null;
  }

  async createCourseAudioBlob(input: {
    tenantId?: string | null;
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
        tenantId: input.tenantId ?? null,
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
