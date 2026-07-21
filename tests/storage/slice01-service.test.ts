import { describe, expect, test, vi } from 'vitest';

import {
  createEnterpriseStorageService,
  type EnterpriseCourse,
  type EnterpriseExamPolicy,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';
import {
  calculateCourseCompletionRate,
  filterDashboardRowsForPublishedCourses,
  filterHostRowsForQuery,
} from '@/lib/storage/enterprise-repository';
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
    learnerCount: 0,
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
    learnerCount: 3,
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
    learnerCount: 9,
  },
];

function makeRepository(): EnterpriseRepository {
  const roles = [adminRole, learnerRole, salesRole];
  const inviteCodes = [
    {
      id: 'invite-learner',
      roleId: learnerRole.id,
      enabled: true,
      expiresAt: null,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];
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
    sceneKey: string | null;
    mediaType: string;
    mimeType: string | null;
    prompt: string | null;
    params: unknown;
    mediaId: string;
    blob: Buffer;
    posterBlob: Buffer | null;
    sizeBytes: number | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const audio = new Map<
    string,
    {
      courseId: string;
      sceneKey: string | null;
      audioId: string;
      mimeType: string | null;
      sizeBytes: number;
      text: string | null;
      voice: string | null;
      blob: Buffer;
      createdAt: Date;
    }
  >();
  const hostKey: StoredHostApiKey = {
    keyId: 'host_demo',
    secretHash: hashHostApiSecret('sk_demo'),
    enabled: true,
  };

  return {
    async listRoles() {
      return roles;
    },
    async createRole(input) {
      return { id: `role-${input.code}`, isAdmin: false, ...input };
    },
    async updateRole(id, patch) {
      return { ...learnerRole, id, ...patch };
    },
    async getRoleUsage(roleId) {
      return {
        users: roleId === learnerRole.id ? 1 : 0,
        inviteCodes: inviteCodes.filter((inviteCode) => inviteCode.roleId === roleId).length,
        examPolicies: examPolicies.filter((policy) => policy.targetRoleId === roleId).length,
      };
    },
    async deleteRole(id) {
      const index = roles.findIndex((role) => role.id === id);
      if (index === -1) return null;
      const [role] = roles.splice(index, 1);
      return role;
    },
    async listInviteCodes() {
      return inviteCodes;
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
    async deleteInviteCode(id) {
      const index = inviteCodes.findIndex((inviteCode) => inviteCode.id === id);
      if (index === -1) return null;
      const [inviteCode] = inviteCodes.splice(index, 1);
      return inviteCode;
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
    async deleteCourse(id) {
      return courses.find((candidate) => candidate.id === id) ?? null;
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
    async markCourseStarted(input) {
      const existing = progress.get(`${input.userId}:${input.courseId}`);
      const started = existing ?? {
        sceneIndex: 0,
        actionIndex: 0,
        completed: false,
      };
      progress.set(`${input.userId}:${input.courseId}`, started);
      return { ...input, ...started, updatedAt: new Date('2026-07-01T00:00:00Z') };
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
    async deleteExamPolicy() {
      throw new Error('not used');
    },
    async listExamAttemptsForUser() {
      return [];
    },
    async createExamAttempt(input) {
      return {
        id: `exam-attempt-${input.attemptNumber}`,
        ...input,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
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
        sceneKey: input.sceneKey ?? null,
        mediaId: input.mediaId,
        mediaType: input.mediaType,
        mimeType: input.mimeType ?? null,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
        blob: input.blob,
        posterBlob: input.posterBlob ?? null,
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
    async getMediaFileBlob(courseId, mediaId) {
      const record = media.find(
        (candidate) => candidate.courseId === courseId && candidate.mediaId === mediaId,
      );
      return record
        ? {
            courseId,
            mediaId,
            mediaType: record.mediaType,
            mimeType: record.mimeType,
            sizeBytes: record.sizeBytes,
            blob: record.blob,
          }
        : null;
    },
    async createCourseAudioBlob(input) {
      const record = {
        courseId: input.courseId,
        sceneKey: input.sceneKey ?? null,
        audioId: input.audioId,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? input.blob.byteLength,
        text: input.text ?? null,
        voice: input.voice ?? null,
        blob: input.blob,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      };
      audio.set(`${input.courseId}:${input.audioId}`, record);
      return record;
    },
    async listCourseAudioBlobs(courseId) {
      return [...audio.values()].filter((record) => record.courseId === courseId);
    },
    async getCourseAudioBlob(courseId, audioId) {
      return audio.get(`${courseId}:${audioId}`) ?? null;
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

  test('excludes archived and draft courses from dashboard completion math', () => {
    const activeCourses = filterDashboardRowsForPublishedCourses(
      [
        { id: 'course-published', status: 'published' },
        { id: 'course-archived', status: 'archived' },
        { id: 'course-draft', status: 'draft' },
      ],
      [
        { courseId: 'course-published', completed: false },
        { courseId: 'course-archived', completed: true },
        { courseId: 'course-draft', completed: true },
      ],
    );

    expect(activeCourses).toEqual([{ courseId: 'course-published', completed: false }]);
  });

  test('returns no dashboard completion rows when every course is archived', () => {
    expect(
      filterDashboardRowsForPublishedCourses(
        [{ id: 'course-archived', status: 'archived' }],
        [{ courseId: 'course-archived', completed: true }],
      ),
    ).toEqual([]);
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

  test('sorts visible courses by unique learner count with update time as the tie breaker', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.listVisibleCourses(salesRole.id, 'popular')).resolves.toMatchObject([
      { id: 'course-sales', learnerCount: 9 },
      { id: 'course-all', learnerCount: 3 },
    ]);
  });

  test('uses all started progress rows as the course completion denominator', () => {
    expect(
      calculateCourseCompletionRate([
        { completed: true },
        { completed: false },
        { completed: false },
        { completed: true },
      ]),
    ).toBe(50);
    expect(calculateCourseCompletionRate([])).toBe(0);
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

  test('deletes courses through the enterprise storage service', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.deleteCourse('course-all')).resolves.toMatchObject({
      id: 'course-all',
      name: 'All Hands',
    });
    await expect(service.deleteCourse('missing-course')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Course not found',
    });
  });

  test('deletes invite codes and protects referenced or final admin roles', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(service.deleteInviteCode('invite-learner')).resolves.toMatchObject({
      id: 'invite-learner',
      roleId: learnerRole.id,
    });
    await expect(service.deleteInviteCode('missing-invite')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Invite code not found',
    });

    await expect(service.deleteRole(learnerRole.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Role is still assigned to users, invite codes, or exam policies',
    });
    await expect(service.deleteRole(adminRole.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'At least one administrator role must remain',
    });
    await expect(service.deleteRole(salesRole.id)).resolves.toMatchObject({
      id: salesRole.id,
    });
  });

  test('normalizes and validates invite codes before creation', async () => {
    const repository = makeRepository();
    const createInviteCode = vi.spyOn(repository, 'createInviteCode');
    const service = createEnterpriseStorageService(repository);

    await expect(
      service.createInviteCode({ code: ' sales - 2026 ', roleId: salesRole.id }),
    ).resolves.toMatchObject({ roleId: salesRole.id });
    expect(createInviteCode).toHaveBeenLastCalledWith({
      code: 'SALES-2026',
      roleId: salesRole.id,
    });

    for (const code of ['A B C', 'A'.repeat(17)]) {
      await expect(service.createInviteCode({ code, roleId: salesRole.id })).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        message: 'Invite code must contain 4 to 16 characters',
      });
    }
    expect(createInviteCode).toHaveBeenCalledTimes(1);
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

  test('stores and lists PostgreSQL media blobs without OSS keys', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await expect(
      service.createMediaFile({
        courseId: 'course-all',
        sceneKey: 'scene-1',
        mediaId: 'video-1',
        mediaType: 'video',
        mimeType: 'video/mp4',
        prompt: 'sales intro',
        params: { model: 'demo' },
        blob: Buffer.from('video-data'),
        sizeBytes: 2048,
      }),
    ).resolves.toMatchObject({
      id: 'media-1',
      mediaId: 'video-1',
      prompt: 'sales intro',
      sizeBytes: 2048,
    });

    await expect(service.listMediaFiles({ courseId: 'course-all' })).resolves.toMatchObject([
      { id: 'media-1', mediaId: 'video-1' },
    ]);
  });

  test('returns media and audio manifests with visible course content', async () => {
    const service = createEnterpriseStorageService(makeRepository());

    await service.createMediaFile({
      courseId: 'course-all',
      sceneKey: 'scene-1',
      mediaId: 'image-1',
      mediaType: 'image',
      mimeType: 'image/png',
      blob: Buffer.from('image-data'),
      sizeBytes: 10,
    });
    await service.createCourseAudioBlob({
      courseId: 'course-all',
      sceneKey: 'scene-1',
      audioId: 'tts-1',
      mimeType: 'audio/mpeg',
      blob: Buffer.from('audio-data'),
      sizeBytes: 10,
    });

    await expect(service.getVisibleCourse('course-all', learnerRole.id)).resolves.toMatchObject({
      mediaManifest: [
        {
          mediaId: 'image-1',
          url: '/api/courses/course-all/media/image-1',
          type: 'image',
          mimeType: 'image/png',
          sizeBytes: 10,
        },
      ],
      audioManifest: [
        {
          audioId: 'tts-1',
          url: '/api/courses/course-all/audio/tts-1',
          mimeType: 'audio/mpeg',
          sizeBytes: 10,
        },
      ],
    });
  });
});
