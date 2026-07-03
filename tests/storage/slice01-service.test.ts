import { describe, expect, test } from 'vitest';

import {
  createEnterpriseStorageService,
  type EnterpriseCourse,
  type EnterpriseExamPolicy,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import { filterHostRowsForQuery } from '@/lib/storage/enterprise-repository';
import type { StoredHostApiKey } from '@/lib/host-api/access';
import { hashHostApiSecret } from '@/lib/security/host-api-key';

const adminRole = { id: 'role-admin', code: 'admin', name: 'Admin', isAdmin: true };
const learnerRole = { id: 'role-learner', code: 'learner', name: 'Learner', isAdmin: false };
const salesRole = { id: 'role-sales', code: 'sales', name: 'Sales', isAdmin: false };

const courses: EnterpriseCourse[] = [
  {
    id: 'course-draft',
    name: 'Draft Course',
    description: null,
    categoryId: 'cat-sales',
    categoryName: 'Sales',
    status: 'draft',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  },
  {
    id: 'course-all',
    name: 'All Hands',
    description: 'Visible to every learner',
    categoryId: 'cat-sales',
    categoryName: 'Sales',
    status: 'published',
    visibilityMode: 'all',
    visibleRoleIds: [],
    assessmentQuestions: [],
    publishedAt: new Date('2026-07-01T01:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  },
  {
    id: 'course-sales',
    name: 'Sales Playbook',
    description: 'Role scoped',
    categoryId: 'cat-sales',
    categoryName: 'Sales',
    status: 'published',
    visibilityMode: 'roles',
    visibleRoleIds: [salesRole.id],
    assessmentQuestions: [],
    publishedAt: new Date('2026-07-01T02:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  },
];

function makeRepository(): EnterpriseRepository {
  const progress = new Map<
    string,
    { sceneIndex: number; actionIndex: number; completed: boolean }
  >();
  const contents = new Map<string, { scenes: unknown[]; outlines: unknown[] }>();
  const examPolicies: EnterpriseExamPolicy[] = [];
  const media: Array<{
    id: string;
    courseId: string | null;
    sceneId: string | null;
    mediaType: string;
    mimeType: string | null;
    prompt: string | null;
    params: unknown;
    ossKey: string;
    posterOssKey: string | null;
    sizeBytes: number | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const hostKey: StoredHostApiKey = {
    keyId: 'host_demo',
    secretHash: hashHostApiSecret('sk_demo'),
    enabled: true,
  };

  return {
    async listRoles() {
      return [adminRole, learnerRole, salesRole];
    },
    async createRole(input) {
      return { id: `role-${input.code}`, isAdmin: false, ...input };
    },
    async updateRole(id, patch) {
      return { ...learnerRole, id, ...patch };
    },
    async listInviteCodes() {
      return [];
    },
    async createInviteCode(input) {
      return {
        id: 'invite-1',
        roleId: input.roleId,
        enabled: input.enabled ?? true,
        expiresAt: input.expiresAt ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async updateInviteCode(id, patch) {
      return {
        id,
        roleId: learnerRole.id,
        enabled: patch.enabled ?? true,
        expiresAt: patch.expiresAt ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async listCategories() {
      return [{ id: 'cat-sales', name: 'Sales', sortOrder: 0 }];
    },
    async createCategory(input) {
      return { id: 'cat-new', sortOrder: 0, ...input };
    },
    async updateCategory(id, patch) {
      return { id, name: patch.name ?? 'Sales', sortOrder: patch.sortOrder ?? 0 };
    },
    async listAdminCourses() {
      return courses;
    },
    async createCourse(input) {
      return {
        id: 'course-new',
        description: null,
        status: 'draft',
        visibilityMode: 'all',
        visibleRoleIds: [],
        assessmentQuestions: [],
        publishedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
        categoryName: 'Sales',
        ...input,
      };
    },
    async updateCourseVisibility(id, visibility) {
      const course = courses.find((candidate) => candidate.id === id)!;
      return { ...course, ...visibility };
    },
    async updateCourse(id, patch) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, ...patch } : null;
    },
    async publishCourse(id) {
      const course = courses.find((candidate) => candidate.id === id)!;
      return { ...course, status: 'published', publishedAt: new Date('2026-07-01T03:00:00Z') };
    },
    async archiveCourse(id) {
      const course = courses.find((candidate) => candidate.id === id)!;
      return { ...course, status: 'archived' };
    },
    async getCourseContent(id) {
      const course = courses.find((candidate) => candidate.id === id);
      if (!course) return null;
      const content = contents.get(id) ?? { scenes: [], outlines: [] };
      return { course, scenes: content.scenes, outlines: content.outlines };
    },
    async replaceCourseContent(courseId, input) {
      contents.set(courseId, { scenes: input.scenes, outlines: input.outlines });
      return {
        courseId,
        scenes: input.scenes,
        outlines: input.outlines,
      };
    },
    async updateCourseAssessmentQuestions(id, questions) {
      const course = courses.find((candidate) => candidate.id === id);
      return course ? { ...course, assessmentQuestions: questions } : null;
    },
    async getCourseProgress(userId, courseId) {
      const saved = progress.get(`${userId}:${courseId}`);
      return saved
        ? { userId, courseId, ...saved, updatedAt: new Date('2026-07-01T00:00:00Z') }
        : null;
    },
    async upsertCourseProgress(input) {
      progress.set(`${input.userId}:${input.courseId}`, input);
      return { ...input, updatedAt: new Date('2026-07-01T00:00:00Z') };
    },
    async listCourseAssessmentAttempts() {
      return [];
    },
    async createAssessmentAttempt(input) {
      return {
        id: `attempt-${input.attemptNumber}`,
        ...input,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
    },
    async getDashboardSummary() {
      return {
        courseCompletionRate: 50,
        assessmentPassRate: 75,
        examPassRate: 25,
        learnerCount: 2,
        courseCount: 3,
        assessmentAttemptCount: 4,
        examAttemptCount: 5,
      };
    },
    async listCourseProgress() {
      return [
        {
          userId: 'learner-1',
          displayName: 'Learner 1',
          roleId: learnerRole.id,
          roleCode: learnerRole.code,
          courseId: 'course-all',
          courseName: 'All Hands',
          completed: true,
          updatedAt: new Date('2026-07-01T00:00:00Z'),
        },
      ];
    },
    async listAssessmentAttempts() {
      return [];
    },
    async listExamAttempts() {
      return [];
    },
    async listExamPolicies() {
      return examPolicies;
    },
    async createExamPolicy(input) {
      const policy = {
        id: 'exam-policy-1',
        title: input.title,
        targetRoleId: input.targetRoleId,
        categoryIds: input.categoryIds,
        courseIds: input.courseIds,
        questionCount: input.questionCount,
        passThreshold: input.passThreshold,
        timeLimitMinutes: input.timeLimitMinutes,
        status: 'draft' as const,
      };
      examPolicies.push(policy);
      return policy;
    },
    async updateExamPolicy(id, patch) {
      const existing = examPolicies.find((policy) => policy.id === id);
      if (!existing) return null;
      Object.assign(existing, patch);
      return existing;
    },
    async publishExamPolicy(id) {
      const existing = examPolicies.find((policy) => policy.id === id);
      if (!existing) return null;
      existing.status = 'published';
      return existing;
    },
    async findHostApiKey(keyId) {
      return keyId === hostKey.keyId ? hostKey : null;
    },
    async touchHostApiKey() {},
    async createMediaFile(input) {
      const record = {
        id: 'media-1',
        courseId: input.courseId ?? null,
        sceneId: input.sceneId ?? null,
        mediaType: input.mediaType,
        mimeType: input.mimeType ?? null,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
        ossKey: input.ossKey,
        posterOssKey: input.posterOssKey ?? null,
        sizeBytes: input.sizeBytes ?? null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      };
      media.push(record);
      return record;
    },
    async listMediaFiles() {
      return media;
    },
    async createOssPresignedUpload(input) {
      return {
        method: 'PUT',
        uploadUrl: `https://openmaic-enterprise.oss-cn-hangzhou.aliyuncs.com/${input.ossKey}?OSSAccessKeyId=test-id&Expires=1780000000&Signature=sig`,
        ossKey: input.ossKey,
        expiresAt: new Date('2026-07-01T01:00:00Z'),
        headers: { 'Content-Type': input.mimeType },
      };
    },
  };
}

describe('Slice-01 enterprise storage service', () => {
  test('filters host and dashboard detail rows by course, role, user, and time range', () => {
    const rows = [
      {
        courseId: 'course-sales',
        roleId: 'role-sales',
        userId: 'user-1',
        updatedAt: new Date('2026-07-01T10:00:00Z'),
      },
      {
        courseId: 'course-ops',
        roleId: 'role-ops',
        userId: 'user-2',
        updatedAt: new Date('2026-07-01T11:00:00Z'),
      },
      {
        courseId: 'course-sales',
        roleId: 'role-sales',
        userId: 'user-3',
        updatedAt: new Date('2026-07-03T10:00:00Z'),
      },
    ];

    expect(
      filterHostRowsForQuery(rows, {
        courseId: 'course-sales',
        roleId: 'role-sales',
        userId: 'user-1',
        from: '2026-07-01T00:00:00Z',
        to: '2026-07-02T00:00:00Z',
      }),
    ).toEqual([rows[0]]);
  });

  test('filters learner course lists by published status and current role visibility', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.listVisibleCourses(learnerRole.id)).resolves.toMatchObject([
      { id: 'course-all' },
    ]);
    await expect(service.listVisibleCourses(salesRole.id)).resolves.toMatchObject([
      { id: 'course-all' },
      { id: 'course-sales' },
    ]);
  });

  test('returns complete course content only when the current role can see the course', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.getVisibleCourse('course-sales', learnerRole.id)).resolves.toBeNull();
    await expect(service.getVisibleCourse('course-sales', salesRole.id)).resolves.toMatchObject({
      course: { id: 'course-sales' },
      scenes: [],
      outlines: [],
    });
  });

  test('saves learner course progress through the server repository', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.saveCourseProgress({
        userId: 'learner-1',
        courseId: 'course-all',
        sceneIndex: 2,
        actionIndex: 3,
        completed: true,
      }),
    ).resolves.toMatchObject({
      userId: 'learner-1',
      courseId: 'course-all',
      sceneIndex: 2,
      actionIndex: 3,
      completed: true,
    });
  });

  test('stores complete course content scenes and outlines on the server side', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.replaceCourseContent('course-all', {
        scenes: [
          {
            id: 'scene-1',
            type: 'slide',
            title: 'Welcome',
            content: { canvas: { elements: [] } },
            actions: [{ type: 'speak', text: 'hello' }],
            whiteboards: [{ id: 'wb-1' }],
          },
        ],
        outlines: [{ id: 'outline-1', title: 'Welcome' }],
      }),
    ).resolves.toMatchObject({
      courseId: 'course-all',
      scenes: [{ id: 'scene-1', actions: [{ type: 'speak' }] }],
      outlines: [{ id: 'outline-1' }],
    });

    await expect(service.getVisibleCourse('course-all', learnerRole.id)).resolves.toMatchObject({
      scenes: [{ id: 'scene-1' }],
      outlines: [{ id: 'outline-1' }],
    });
  });

  test('updates course metadata without changing publish or visibility state', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.updateCourse('course-all', {
        name: 'Updated Course',
        description: 'Updated description',
        categoryId: 'cat-sales',
      }),
    ).resolves.toMatchObject({
      id: 'course-all',
      name: 'Updated Course',
      description: 'Updated description',
      status: 'published',
      visibilityMode: 'all',
    });
  });

  test('keeps stage exam policy CRUD in the admin backend without starting exams', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    const created = await service.createExamPolicy({
      title: 'Quarterly Sales Exam',
      targetRoleId: salesRole.id,
      categoryIds: ['cat-sales'],
      courseIds: ['course-sales'],
      questionCount: 20,
      passThreshold: 80,
      timeLimitMinutes: 45,
    });
    expect(created).toMatchObject({
      id: 'exam-policy-1',
      status: 'draft',
      targetRoleId: salesRole.id,
      courseIds: ['course-sales'],
    });

    await expect(
      service.updateExamPolicy('exam-policy-1', {
        questionCount: 30,
      }),
    ).resolves.toMatchObject({ questionCount: 30 });

    await expect(service.publishExamPolicy('exam-policy-1')).resolves.toMatchObject({
      status: 'published',
    });

    await expect(service.listExamPolicies()).resolves.toMatchObject([
      { id: 'exam-policy-1', status: 'published' },
    ]);
  });

  test('authenticates host query API requests with API key tokens', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.getHostSummary({
        pathname: '/api/host/summary',
        token: 'host_demo.sk_demo',
        filters: {},
      }),
    ).resolves.toMatchObject({
      summary: { courseCompletionRate: 50, assessmentPassRate: 75 },
    });

    await expect(
      service.getHostSummary({
        pathname: '/api/host/summary',
        token: 'host_demo.wrong',
        filters: {},
      }),
    ).rejects.toMatchObject({ code: 'HOST_API_UNAUTHORIZED' });
  });

  test('stores and lists OSS media metadata without storing media blobs in PostgreSQL', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.createMediaFile({
        courseId: 'course-all',
        sceneId: 'scene-1',
        mediaType: 'video',
        mimeType: 'video/mp4',
        prompt: 'sales intro',
        params: { model: 'demo' },
        ossKey: 'courses/course-all/scene-1/video.mp4',
        sizeBytes: 2048,
      }),
    ).resolves.toMatchObject({
      id: 'media-1',
      ossKey: 'courses/course-all/scene-1/video.mp4',
      prompt: 'sales intro',
      sizeBytes: 2048,
    });

    await expect(service.listMediaFiles({ courseId: 'course-all' })).resolves.toMatchObject([
      { id: 'media-1', ossKey: 'courses/course-all/scene-1/video.mp4' },
    ]);
  });

  test('creates OSS pre-signed upload URLs without accepting media blobs', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.createOssPresignedUpload({
        ossKey: 'courses/course-all/scene-1/video.mp4',
        mimeType: 'video/mp4',
        expiresInSeconds: 900,
      }),
    ).resolves.toMatchObject({
      method: 'PUT',
      ossKey: 'courses/course-all/scene-1/video.mp4',
      headers: { 'Content-Type': 'video/mp4' },
    });
  });
});
