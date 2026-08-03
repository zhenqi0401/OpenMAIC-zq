import type { EnterpriseCourse, EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';
import {
  paginateAdminItems,
  toAdminPagination,
  type AdminPagination,
} from '@/lib/admin/admin-query';
import type {
  AdminDataRepository,
  AdminExamAttemptRow,
  AdminUserQuery,
  AdminUserRow,
  CommunityActivityRow,
} from '@/lib/admin/admin-data-repository';

export type AdminCourseContentStatus = 'generating' | 'incomplete' | 'missing_assessment' | 'ready';

export interface AdminCourseListQuery {
  q?: string;
  status: 'all' | 'draft' | 'published' | 'archived' | 'review';
  categoryId?: string;
  visibilityMode: 'any' | 'all' | 'roles';
  page: number;
  pageSize: number;
  sort: 'updatedAt:desc';
}

export interface AdminExamPolicyQuery {
  q?: string;
  status: 'all' | 'draft' | 'published' | 'archived';
  targetRoleId?: string;
  page: number;
  pageSize: number;
}

interface EnterpriseAdminSource {
  listAdminCourses(): Promise<EnterpriseCourse[]>;
  listExamPolicies(): Promise<EnterpriseExamPolicy[]>;
  getDashboard(): Promise<{
    summary: {
      learnerCount: number;
      courseCount: number;
      courseCompletionRate: number;
      examPassRate: number;
      examAttemptCount: number;
    };
  }>;
}

export class AdminManagementError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_REQUEST',
    message: string,
  ) {
    super(message);
    this.name = 'AdminManagementError';
  }
}

function hasAssessment(course: EnterpriseCourse) {
  return Array.isArray(course.assessmentQuestions) && course.assessmentQuestions.length > 0;
}

export function getAdminCourseContentStatus(course: EnterpriseCourse): AdminCourseContentStatus {
  if (course.generationComplete === false) {
    return course.generationStatus === 'generating' ? 'generating' : 'incomplete';
  }
  if (!hasAssessment(course)) return 'missing_assessment';
  return 'ready';
}

function courseForList(course: EnterpriseCourse) {
  return {
    id: course.id,
    scope: course.scope,
    managementMode: course.managementMode,
    name: course.name,
    description: course.description,
    categoryId: course.categoryId,
    categoryName: course.categoryName,
    status: course.status,
    contentStatus: getAdminCourseContentStatus(course),
    visibilityMode: course.visibilityMode,
    visibleRoleIds: course.visibleRoleIds,
    learnerCount: course.learnerCount ?? 0,
    sceneCount: course.sceneCount ?? 0,
    updatedAt: course.updatedAt.toISOString(),
    stageSnapshot: course.stageSnapshot,
    generationStatus: course.generationStatus,
    generationComplete: course.generationComplete,
    assessmentQuestions: course.assessmentQuestions,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    createdAt: course.createdAt.toISOString(),
  };
}

function percentage(passed: number, total: number): number | null {
  return total === 0 ? null : Math.round((passed / total) * 1000) / 10;
}

function average(value: number | null, total: number): number | null {
  return total === 0 || value === null ? null : Math.round(value * 10) / 10;
}

function changeRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildActivityPoints(
  rows: CommunityActivityRow[],
  range: 'week' | 'month' | 'year',
  now: Date,
  flags: { forum: boolean; danmaku: boolean },
) {
  const end = addUtcDays(startOfUtcDay(now), 1);
  if (range === 'year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const points = Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
      return { date: date.toISOString().slice(0, 7), posts: 0, replies: 0, danmaku: 0 };
    });
    const byDate = new Map(points.map((point) => [point.date, point]));
    for (const row of rows) {
      const point = byDate.get(row.createdAt.toISOString().slice(0, 7));
      if (point) point[row.type] += 1;
    }
    return {
      start,
      end,
      points: points.map((point) => {
        const posts = flags.forum ? point.posts : 0;
        const replies = flags.forum ? point.replies : 0;
        const danmaku = flags.danmaku ? point.danmaku : 0;
        return { ...point, posts, replies, danmaku, interactions: posts + replies + danmaku };
      }),
    };
  }
  const days = range === 'week' ? 7 : 30;
  const start = addUtcDays(end, -days);
  const points = Array.from({ length: days }, (_, offset) => ({
    date: dateKey(addUtcDays(start, offset)),
    posts: 0,
    replies: 0,
    danmaku: 0,
  }));
  const byDate = new Map(points.map((point) => [point.date, point]));
  for (const row of rows) {
    const point = byDate.get(dateKey(row.createdAt));
    if (point) point[row.type] += 1;
  }
  return {
    start,
    end,
    points: points.map((point) => {
      const posts = flags.forum ? point.posts : 0;
      const replies = flags.forum ? point.replies : 0;
      const danmaku = flags.danmaku ? point.danmaku : 0;
      return { ...point, posts, replies, danmaku, interactions: posts + replies + danmaku };
    }),
  };
}

export function createAdminManagementService(input: {
  repository: AdminDataRepository;
  enterprise: EnterpriseAdminSource;
  now?: () => Date;
  flags?: () => { forum: boolean; danmaku: boolean };
}) {
  const now = input.now ?? (() => new Date());
  const flags = input.flags ?? (() => ({ forum: true, danmaku: true }));

  return {
    async queryUsers(query: AdminUserQuery): Promise<{
      users: AdminUserRow[];
      pagination: AdminPagination;
    }> {
      const result = await input.repository.queryUsers(query);
      return {
        users: result.users,
        pagination: toAdminPagination(query.page, query.pageSize, result.total),
      };
    },

    async updateUserStatus(request: {
      userId: string;
      currentUserId: string;
      status: 'active' | 'disabled';
    }) {
      const result = await input.repository.updateUserStatus(request);
      if (result.outcome === 'not_found') {
        throw new AdminManagementError('NOT_FOUND', 'User not found');
      }
      if (result.outcome === 'self_disable') {
        throw new AdminManagementError('CONFLICT', '管理员不能停用当前登录账号');
      }
      if (result.outcome === 'last_admin') {
        throw new AdminManagementError('CONFLICT', '不能停用最后一个有效管理员');
      }
      return result.user;
    },

    async queryCourses(query: AdminCourseListQuery) {
      const normalizedQuery = query.q?.toLocaleLowerCase('zh-CN');
      const all = await input.enterprise.listAdminCourses();
      const filtered = all
        .filter((course) => {
          if (
            normalizedQuery &&
            !course.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery) &&
            !course.description?.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
          ) {
            return false;
          }
          if (query.status === 'review') {
            if (course.generationComplete !== false && hasAssessment(course)) return false;
          } else if (query.status !== 'all' && course.status !== query.status) return false;
          if (query.categoryId && course.categoryId !== query.categoryId) return false;
          if (query.visibilityMode !== 'any' && course.visibilityMode !== query.visibilityMode) {
            return false;
          }
          return true;
        })
        .sort((left, right) => {
          const date = right.updatedAt.getTime() - left.updatedAt.getTime();
          return date || right.id.localeCompare(left.id);
        });
      const page = paginateAdminItems(filtered, query.page, query.pageSize);
      return { courses: page.items.map(courseForList), pagination: page.pagination };
    },

    async getCoursePreviews(ids: string[]) {
      if (ids.length > 20) {
        throw new AdminManagementError('INVALID_REQUEST', '一次最多预览 20 门课程');
      }
      const unique = [...new Set(ids)];
      if (unique.length !== ids.length) {
        throw new AdminManagementError('INVALID_REQUEST', '课程 ID 不能重复');
      }
      const courses = await input.enterprise.listAdminCourses();
      const allowed = new Set(
        courses
          .filter(
            (course) => unique.includes(course.id) && course.generationStatus !== 'generating',
          )
          .map((course) => course.id),
      );
      const previews = await input.repository.getCoursePreviews([...allowed]);
      const byCourse = new Map(previews.map((preview) => [preview.courseId, preview]));
      return {
        previews: Object.fromEntries(unique.map((id) => [id, byCourse.get(id) ?? null])),
      };
    },

    async reorderCategories(categoryIds: string[]) {
      const ok = await input.repository.reorderCategories(categoryIds);
      if (!ok) {
        throw new AdminManagementError(
          'INVALID_REQUEST',
          'categoryIds 必须包含当前全部分类，且不能重复或包含不存在的 ID',
        );
      }
      return { categoryIds };
    },

    async deleteCategory(id: string) {
      const outcome = await input.repository.deleteCategory(id);
      if (outcome === 'not_found') throw new AdminManagementError('NOT_FOUND', '分类不存在');
      if (outcome === 'in_use') {
        throw new AdminManagementError('CONFLICT', '请先调整相关课程分类');
      }
      return { id };
    },

    async queryExamPolicies(query: AdminExamPolicyQuery) {
      const [policies, courses, stats] = await Promise.all([
        input.enterprise.listExamPolicies(),
        input.enterprise.listAdminCourses(),
        input.repository.getExamAttemptStats(),
      ]);
      const q = query.q?.toLocaleLowerCase('zh-CN');
      const filtered = policies.filter((policy) => {
        if (q && !policy.title.toLocaleLowerCase('zh-CN').includes(q)) return false;
        if (query.status !== 'all' && policy.status !== query.status) return false;
        if (query.targetRoleId && policy.targetRoleId !== query.targetRoleId) return false;
        return true;
      });
      const page = paginateAdminItems(filtered, query.page, query.pageSize);
      const publishedCourses = courses.filter((course) => course.status === 'published');
      const readyCourseCount = publishedCourses.filter(hasAssessment).length;
      return {
        examPolicies: page.items,
        summary: {
          publishedCourseCount: publishedCourses.length,
          readyCourseCount,
          missingQuestionCourseCount: publishedCourses.length - readyCourseCount,
          examAttemptCount: stats.attemptCount,
          passRate: percentage(stats.passedCount, stats.attemptCount),
          averageScore: average(stats.averageScore, stats.attemptCount),
        },
        pagination: page.pagination,
      };
    },

    async getExamPolicyAttempts(policyId: string, page: number, pageSize: number) {
      const [policy, stats, result] = await Promise.all([
        input.repository.getExamPolicy(policyId),
        input.repository.getExamAttemptStats(policyId),
        input.repository.queryExamAttempts({ examPolicyId: policyId, page, pageSize }),
      ]);
      if (!policy) throw new AdminManagementError('NOT_FOUND', '考核不存在');
      return {
        policy: {
          id: policy.id,
          title: policy.title,
          passThreshold: policy.passThreshold,
          questionCount: policy.questionCount,
          timeLimitMinutes: policy.timeLimit,
        },
        summary: {
          participantCount: stats.participantCount,
          attemptCount: stats.attemptCount,
          passRate: percentage(stats.passedCount, stats.attemptCount),
          averageScore: average(stats.averageScore, stats.attemptCount),
        },
        attempts: result.attempts.map((attempt: AdminExamAttemptRow) => ({
          ...attempt,
          submittedAt: attempt.submittedAt.toISOString(),
        })),
        pagination: toAdminPagination(page, pageSize, result.total),
      };
    },

    async getCommunitySummary(range: 'today' | 'week' | 'month') {
      const end = addUtcDays(startOfUtcDay(now()), 1);
      const days = range === 'today' ? 1 : range === 'week' ? 7 : 30;
      const start = addUtcDays(end, -days);
      const previousStart = addUtcDays(start, -days);
      const [current, previous] = await Promise.all([
        input.repository.getCommunityWindowCounts(start, end),
        input.repository.getCommunityWindowCounts(previousStart, start),
      ]);
      const activeFlags = flags();
      const posts = activeFlags.forum ? current.posts : 0;
      const replies = activeFlags.forum ? current.replies : 0;
      const previousPosts = activeFlags.forum ? previous.posts : 0;
      const previousReplies = activeFlags.forum ? previous.replies : 0;
      return {
        posts: { count: posts, changeRate: changeRate(posts, previousPosts) },
        replies: { count: replies, changeRate: changeRate(replies, previousReplies) },
        moderationActions: {
          count: current.moderationActions,
          changeRate: changeRate(current.moderationActions, previous.moderationActions),
        },
      };
    },

    async getDashboard(range: 'week' | 'month' | 'year') {
      const currentTime = now();
      const activeFlags = flags();
      const provisional = buildActivityPoints([], range, currentTime, activeFlags);
      const [dashboard, courses, policies, health, activity] = await Promise.all([
        input.enterprise.getDashboard(),
        input.enterprise.listAdminCourses(),
        input.enterprise.listExamPolicies(),
        input.repository.getConfigurationHealth(currentTime),
        input.repository.listCommunityActivity(provisional.start, provisional.end),
      ]);
      const activityResult = buildActivityPoints(activity, range, currentTime, activeFlags);
      const totals = activityResult.points.reduce(
        (result, point) => ({
          interactions: result.interactions + point.interactions,
          posts: result.posts + point.posts,
          replies: result.replies + point.replies,
          danmaku: result.danmaku + point.danmaku,
        }),
        { interactions: 0, posts: 0, replies: 0, danmaku: 0 },
      );
      const actionableCourses = courses.filter(
        (course) =>
          course.status !== 'archived' &&
          !(course.status === 'draft' && course.generationStatus === 'draft') &&
          course.generationStatus !== 'generating',
      );
      const incompleteCourses = actionableCourses.filter(
        (course) => course.generationComplete === false,
      );
      const missingAssessmentCourses = actionableCourses.filter((course) => !hasAssessment(course));
      const underfilledPolicies = policies.filter(
        (policy) =>
          policy.status === 'published' &&
          (policy.candidateQuestionCount ?? 0) < policy.questionCount,
      );
      const items = [
        incompleteCourses.length
          ? {
              id: 'course-content',
              type: 'course_content' as const,
              severity: 'high' as const,
              title: '课程内容未完成',
              description: '存在未处于正常生成过程且内容尚未完成的课程。',
              count: incompleteCourses.length,
              href: '/admin?module=courses&status=review',
              actionLabel: '查看课程',
            }
          : null,
        missingAssessmentCourses.length
          ? {
              id: 'course-assessment',
              type: 'course_assessment' as const,
              severity: 'medium' as const,
              title: '课程缺少课后测评',
              description: '存在尚未配置课后测评题的课程。',
              count: missingAssessmentCourses.length,
              href: '/admin?module=courses&status=review',
              actionLabel: '查看课程',
            }
          : null,
        underfilledPolicies.length
          ? {
              id: 'exam-question-pool',
              type: 'exam_question_pool' as const,
              severity: 'high' as const,
              title: '考核题库不足',
              description: '已发布考核的可抽题数少于配置题数。',
              count: underfilledPolicies.length,
              href: '/admin?module=exams&status=published',
              actionLabel: '查看考核',
            }
          : null,
        health.assignableRoleCount === 0
          ? {
              id: 'roles-missing',
              type: 'roles_missing' as const,
              severity: 'medium' as const,
              title: '角色配置缺失',
              description: '当前没有可分配的非管理员角色。',
              count: 1,
              href: '/admin?module=access&section=roles',
              actionLabel: '配置角色',
            }
          : null,
        health.validInviteCodeCount === 0
          ? {
              id: 'invite-codes-missing',
              type: 'invite_codes_missing' as const,
              severity: 'info' as const,
              title: '注册入口不可用',
              description: '当前没有启用且未过期的邀请码。',
              count: 1,
              href: '/admin?module=access&section=invites',
              actionLabel: '配置邀请码',
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        summary: {
          learnerCount: dashboard.summary.learnerCount,
          activeCourseCount: dashboard.summary.courseCount,
          courseCompletionRate: dashboard.summary.courseCompletionRate,
          examPassRate:
            dashboard.summary.examAttemptCount === 0 ? null : dashboard.summary.examPassRate,
          examAttemptCount: dashboard.summary.examAttemptCount,
        },
        communityActivity: { totals, points: activityResult.points },
        pending: { total: items.reduce((sum, item) => sum + item.count, 0), items },
      };
    },
  };
}
