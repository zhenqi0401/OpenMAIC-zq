import { describe, expect, it, vi } from 'vitest';
import type { AdminDataRepository } from '@/lib/admin/admin-data-repository';
import {
  AdminManagementError,
  createAdminManagementService,
  getAdminCourseContentStatus,
} from '@/lib/admin/admin-management';
import type { EnterpriseCourse, EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';

const baseDate = new Date('2026-07-23T00:00:00.000Z');

function course(patch: Partial<EnterpriseCourse> = {}): EnterpriseCourse {
  return {
    id: 'course-1',
    name: '安全培训',
    description: '入门课程',
    categoryId: 'cat-1',
    categoryName: '基础课程',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    stageSnapshot: {},
    generationStatus: 'ready',
    generationComplete: true,
    assessmentQuestions: [{ id: 'q-1' }],
    learnerCount: 12,
    publishedAt: baseDate,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...patch,
  };
}

function policy(patch: Partial<EnterpriseExamPolicy> = {}): EnterpriseExamPolicy {
  return {
    id: 'policy-1',
    title: '安全考核',
    targetRoleId: 'role-learner',
    categoryIds: ['cat-1'],
    courseIds: [],
    questionCount: 10,
    passThreshold: 80,
    timeLimitMinutes: 30,
    status: 'published',
    candidateQuestionCount: 10,
    ...patch,
  };
}

function setup(options?: {
  courses?: EnterpriseCourse[];
  policies?: EnterpriseExamPolicy[];
  forum?: boolean;
  danmaku?: boolean;
}) {
  const repository = {
    queryUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    updateUserStatus: vi.fn(),
    getCoursePreviews: vi.fn().mockResolvedValue([]),
    reorderCategories: vi.fn().mockResolvedValue(true),
    deleteCategory: vi.fn().mockResolvedValue('deleted'),
    getExamAttemptStats: vi.fn().mockResolvedValue({
      participantCount: 0,
      attemptCount: 0,
      passedCount: 0,
      averageScore: null,
    }),
    queryExamAttempts: vi.fn().mockResolvedValue({ attempts: [], total: 0 }),
    getCommunityWindowCounts: vi.fn().mockResolvedValue({
      posts: 0,
      replies: 0,
      danmaku: 0,
      moderationActions: 0,
    }),
    listCommunityActivity: vi.fn().mockResolvedValue([]),
    getConfigurationHealth: vi.fn().mockResolvedValue({
      assignableRoleCount: 1,
      validInviteCodeCount: 1,
    }),
    getExamPolicy: vi.fn().mockResolvedValue(null),
  };
  const enterprise = {
    listAdminCourses: vi.fn().mockResolvedValue(options?.courses ?? [course()]),
    listExamPolicies: vi.fn().mockResolvedValue(options?.policies ?? [policy()]),
    getDashboard: vi.fn().mockResolvedValue({
      summary: {
        learnerCount: 20,
        courseCount: 1,
        courseCompletionRate: 75,
        examPassRate: 0,
        examAttemptCount: 0,
      },
    }),
  };
  const service = createAdminManagementService({
    repository: repository as unknown as AdminDataRepository,
    enterprise,
    now: () => new Date('2026-07-23T12:00:00.000Z'),
    flags: () => ({ forum: options?.forum ?? true, danmaku: options?.danmaku ?? true }),
  });
  return { service, repository, enterprise };
}

describe('stage 2 admin management service', () => {
  it('derives all four course content states and filters review results on the server', async () => {
    expect(getAdminCourseContentStatus(course())).toBe('ready');
    expect(
      getAdminCourseContentStatus(
        course({ generationComplete: false, generationStatus: 'generating' }),
      ),
    ).toBe('generating');
    expect(
      getAdminCourseContentStatus(course({ generationComplete: false, generationStatus: 'error' })),
    ).toBe('incomplete');
    expect(getAdminCourseContentStatus(course({ assessmentQuestions: [] }))).toBe(
      'missing_assessment',
    );

    const courses = [
      course({ id: 'ready' }),
      course({
        id: 'generating',
        generationComplete: false,
        generationStatus: 'generating',
      }),
      course({ id: 'missing', assessmentQuestions: [] }),
    ];
    const { service } = setup({ courses });
    const result = await service.queryCourses({
      status: 'review',
      visibilityMode: 'any',
      page: 1,
      pageSize: 12,
      sort: 'updatedAt:desc',
    });
    expect(result.courses.map((item) => item.id).sort()).toEqual(['generating', 'missing']);
    expect(result.pagination).toEqual({ page: 1, pageSize: 12, total: 2, totalPages: 1 });
    expect(result.courses[0]).toHaveProperty('generationStatus');
    expect(result.courses[0]).toHaveProperty('assessmentQuestions');
  });

  it('bounds previews, suppresses generating previews, and preserves missing results as null', async () => {
    const { service, repository } = setup({
      courses: [
        course({ id: 'ready' }),
        course({ id: 'generating', generationStatus: 'generating', generationComplete: false }),
      ],
    });
    repository.getCoursePreviews.mockResolvedValue([
      { courseId: 'ready', sceneKey: 'slide-1', canvas: { id: 'slide-1' } },
    ]);
    await expect(
      service.getCoursePreviews(Array.from({ length: 21 }, (_, i) => `c-${i}`)),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    const result = await service.getCoursePreviews(['ready', 'generating', 'unknown']);
    expect(repository.getCoursePreviews).toHaveBeenCalledWith(['ready']);
    expect(result.previews.ready).toMatchObject({ sceneKey: 'slide-1' });
    expect(result.previews.generating).toBeNull();
    expect(result.previews.unknown).toBeNull();
  });

  it('maps self-disable and last-admin outcomes to conflicts', async () => {
    const { service, repository } = setup();
    repository.updateUserStatus.mockResolvedValueOnce({ outcome: 'self_disable' });
    await expect(
      service.updateUserStatus({ userId: 'admin-1', currentUserId: 'admin-1', status: 'disabled' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CONFLICT' }));
    repository.updateUserStatus.mockResolvedValueOnce({ outcome: 'last_admin' });
    await expect(
      service.updateUserStatus({ userId: 'admin-2', currentUserId: 'admin-1', status: 'disabled' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CONFLICT' }));
  });

  it('returns null rates without attempts and paginates submitted exam results', async () => {
    const { service, repository } = setup();
    const list = await service.queryExamPolicies({
      status: 'all',
      page: 1,
      pageSize: 20,
    });
    expect(list.summary).toMatchObject({ examAttemptCount: 0, passRate: null, averageScore: null });

    repository.getExamPolicy.mockResolvedValue({
      id: 'policy-1',
      title: '安全考核',
      passThreshold: 80,
      questionCount: 10,
      timeLimit: 30,
    });
    repository.getExamAttemptStats.mockResolvedValue({
      participantCount: 2,
      attemptCount: 3,
      passedCount: 2,
      averageScore: 82.34,
    });
    repository.queryExamAttempts.mockResolvedValue({
      attempts: [
        {
          id: 'attempt-1',
          userId: 'user-1',
          displayName: '张三',
          roleName: '学员',
          score: 86,
          passed: true,
          attemptNumber: 2,
          submittedAt: baseDate,
        },
      ],
      total: 3,
    });
    const detail = await service.getExamPolicyAttempts('policy-1', 1, 1);
    expect(detail.summary).toEqual({
      participantCount: 2,
      attemptCount: 3,
      passRate: 66.7,
      averageScore: 82.3,
    });
    expect(detail.attempts[0].submittedAt).toBe(baseDate.toISOString());
    expect(detail.pagination).toEqual({ page: 1, pageSize: 1, total: 3, totalPages: 3 });
  });

  it('compares equal community periods and returns null when the previous period is zero', async () => {
    const { service, repository } = setup({ danmaku: false });
    repository.getCommunityWindowCounts
      .mockResolvedValueOnce({ posts: 12, replies: 6, danmaku: 40, moderationActions: 3 })
      .mockResolvedValueOnce({ posts: 0, replies: 3, danmaku: 20, moderationActions: 2 });
    const summary = await service.getCommunitySummary('week');
    expect(summary.posts).toEqual({ count: 12, changeRate: null });
    expect(summary.replies).toEqual({ count: 6, changeRate: 100 });
    expect(summary.moderationActions).toEqual({ count: 3, changeRate: 50 });
  });

  it('builds only confirmed dashboard pending items and excludes disabled community types', async () => {
    const { service, repository, enterprise } = setup({
      danmaku: false,
      courses: [
        course({
          id: 'normal-generating',
          generationComplete: false,
          generationStatus: 'generating',
          assessmentQuestions: [],
        }),
        course({
          id: 'plain-draft',
          status: 'draft',
          generationComplete: false,
          generationStatus: 'draft',
          assessmentQuestions: [],
        }),
        course({
          id: 'broken',
          generationComplete: false,
          generationStatus: 'error',
          assessmentQuestions: [],
        }),
      ],
      policies: [policy({ candidateQuestionCount: 4, questionCount: 10 })],
    });
    repository.getConfigurationHealth.mockResolvedValue({
      assignableRoleCount: 0,
      validInviteCodeCount: 0,
    });
    repository.listCommunityActivity.mockResolvedValue([
      { type: 'posts', createdAt: new Date('2026-07-23T01:00:00Z') },
      { type: 'replies', createdAt: new Date('2026-07-23T02:00:00Z') },
      { type: 'danmaku', createdAt: new Date('2026-07-23T03:00:00Z') },
    ]);
    const dashboard = await service.getDashboard('week');
    expect(dashboard.summary.examPassRate).toBeNull();
    expect(dashboard.communityActivity.totals).toEqual({
      interactions: 2,
      posts: 1,
      replies: 1,
      danmaku: 0,
    });
    expect(dashboard.pending.items.map((item) => item.type)).toEqual([
      'course_content',
      'course_assessment',
      'exam_question_pool',
      'roles_missing',
      'invite_codes_missing',
    ]);
    expect(dashboard.pending.items.find((item) => item.type === 'course_content')?.count).toBe(1);
    expect(dashboard.pending.items.find((item) => item.type === 'course_assessment')?.count).toBe(
      1,
    );
    expect(enterprise.getDashboard).toHaveBeenCalledOnce();
  });

  it('rejects invalid category reorder and in-use deletion outcomes', async () => {
    const { service, repository } = setup();
    repository.reorderCategories.mockResolvedValue(false);
    await expect(service.reorderCategories(['cat-1'])).rejects.toBeInstanceOf(AdminManagementError);
    repository.deleteCategory.mockResolvedValue('in_use');
    await expect(service.deleteCategory('cat-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: '请先调整相关课程分类',
    });
  });
});
