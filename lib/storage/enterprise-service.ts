import { assertHostApiAccess, type StoredHostApiKey } from '@/lib/host-api/access';
import type { DashboardSummary, HostQueryFilters } from '@/lib/host-api/types';
import type { AuthRole } from '@/lib/auth/service';
import { shouldShowAssessmentMismatchWarning } from '@/lib/authoring/course-draft';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibilityMode = 'all' | 'roles';

export interface EnterpriseCourse {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string | null;
  status: CourseStatus;
  visibilityMode: CourseVisibilityMode;
  visibleRoleIds: string[];
  assessmentQuestions: unknown[];
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnterpriseCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface EnterpriseInviteCode {
  id: string;
  roleId: string;
  enabled: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface EnterpriseCourseContent {
  course: EnterpriseCourse;
  scenes: unknown[];
  outlines: unknown[];
}

export interface ReplaceCourseContentInput {
  scenes: unknown[];
  outlines: unknown[];
}

export interface EnterpriseStoredCourseContent {
  courseId: string;
  scenes: unknown[];
  outlines: unknown[];
  assessmentMismatchWarning?: boolean;
}

export interface EnterpriseCourseProgress {
  userId: string;
  courseId: string;
  sceneIndex: number;
  actionIndex: number;
  completed: boolean;
  updatedAt?: Date;
}

export interface EnterpriseProgressDetail {
  userId: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  courseId: string;
  courseName: string;
  completed: boolean;
  updatedAt: Date;
}

export interface EnterpriseAttemptDetail {
  id: string;
  userId: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  courseId?: string;
  courseName?: string;
  examPolicyId?: string;
  examTitle?: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  createdAt: Date;
}

export interface EnterpriseExamPolicy {
  id: string;
  title: string;
  targetRoleId: string;
  categoryIds: string[];
  courseIds: string[];
  questionCount: number;
  passThreshold: number;
  timeLimitMinutes?: number | null;
  status: 'draft' | 'published' | 'archived';
}

export interface EnterpriseMediaFile {
  id: string;
  courseId: string | null;
  sceneId: string | null;
  mediaType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  prompt: string | null;
  params: unknown;
  ossKey: string;
  posterOssKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseInput {
  name: string;
  description?: string | null;
  categoryId: string;
  createdBy?: string | null;
  assessmentQuestions?: unknown[];
}

export interface CreateMediaFileInput {
  courseId?: string | null;
  sceneId?: string | null;
  mediaType: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  prompt?: string | null;
  params?: unknown;
  ossKey: string;
  posterOssKey?: string | null;
}

export interface OssPresignedUploadInput {
  ossKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}

export interface OssPresignedUpload {
  method: 'PUT';
  uploadUrl: string;
  ossKey: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface EnterpriseRepository {
  listRoles(): Promise<AuthRole[]>;
  createRole(input: { code: string; name: string; isAdmin?: boolean }): Promise<AuthRole>;
  updateRole(
    id: string,
    patch: { code?: string; name?: string; isAdmin?: boolean },
  ): Promise<AuthRole | null>;

  listInviteCodes(): Promise<EnterpriseInviteCode[]>;
  createInviteCode(input: {
    code: string;
    roleId: string;
    enabled?: boolean;
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<EnterpriseInviteCode>;
  updateInviteCode(
    id: string,
    patch: { enabled?: boolean; expiresAt?: Date | null; roleId?: string },
  ): Promise<EnterpriseInviteCode | null>;

  listCategories(): Promise<EnterpriseCategory[]>;
  createCategory(input: { name: string; sortOrder?: number }): Promise<EnterpriseCategory>;
  updateCategory(
    id: string,
    patch: { name?: string; sortOrder?: number },
  ): Promise<EnterpriseCategory | null>;

  listAdminCourses(filters?: HostQueryFilters): Promise<EnterpriseCourse[]>;
  createCourse(input: CreateCourseInput): Promise<EnterpriseCourse>;
  updateCourse(
    id: string,
    patch: { name?: string; description?: string | null; categoryId?: string },
  ): Promise<EnterpriseCourse | null>;
  updateCourseVisibility(
    id: string,
    visibility: { visibilityMode: CourseVisibilityMode; visibleRoleIds: string[] },
  ): Promise<EnterpriseCourse | null>;
  publishCourse(id: string): Promise<EnterpriseCourse | null>;
  archiveCourse(id: string): Promise<EnterpriseCourse | null>;
  getCourseContent(id: string): Promise<EnterpriseCourseContent | null>;
  replaceCourseContent(
    courseId: string,
    input: ReplaceCourseContentInput,
  ): Promise<EnterpriseStoredCourseContent>;
  upsertCourseProgress(input: EnterpriseCourseProgress): Promise<EnterpriseCourseProgress>;

  getDashboardSummary(filters?: HostQueryFilters): Promise<DashboardSummary>;
  listCourseProgress(filters?: HostQueryFilters): Promise<EnterpriseProgressDetail[]>;
  listAssessmentAttempts(filters?: HostQueryFilters): Promise<EnterpriseAttemptDetail[]>;
  listExamAttempts(filters?: HostQueryFilters): Promise<EnterpriseAttemptDetail[]>;

  listExamPolicies(): Promise<EnterpriseExamPolicy[]>;
  createExamPolicy(input: {
    title: string;
    targetRoleId: string;
    categoryIds: string[];
    courseIds: string[];
    questionCount: number;
    passThreshold: number;
    timeLimitMinutes?: number | null;
  }): Promise<EnterpriseExamPolicy>;
  updateExamPolicy(
    id: string,
    patch: {
      title?: string;
      targetRoleId?: string;
      categoryIds?: string[];
      courseIds?: string[];
      questionCount?: number;
      passThreshold?: number;
      timeLimitMinutes?: number | null;
      status?: 'draft' | 'published' | 'archived';
    },
  ): Promise<EnterpriseExamPolicy | null>;
  publishExamPolicy(id: string): Promise<EnterpriseExamPolicy | null>;

  findHostApiKey(keyId: string): Promise<StoredHostApiKey | null>;
  touchHostApiKey(keyId: string): Promise<void>;

  createMediaFile(input: CreateMediaFileInput): Promise<EnterpriseMediaFile>;
  listMediaFiles(filters?: { courseId?: string; sceneId?: string }): Promise<EnterpriseMediaFile[]>;
  createOssPresignedUpload(input: OssPresignedUploadInput): Promise<OssPresignedUpload>;
}

export type EnterpriseStorageServiceErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'HOST_API_UNAUTHORIZED'
  | 'STORAGE_UNAVAILABLE';

export class EnterpriseStorageServiceError extends Error {
  constructor(
    public readonly code: EnterpriseStorageServiceErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'EnterpriseStorageServiceError';
  }
}

function isCourseVisibleToRole(course: EnterpriseCourse, roleId: string): boolean {
  if (course.status !== 'published') return false;
  if (course.visibilityMode === 'all') return true;
  return course.visibleRoleIds.includes(roleId);
}

function assertValidVisibility(visibility: {
  visibilityMode: CourseVisibilityMode;
  visibleRoleIds: string[];
}): void {
  if (visibility.visibilityMode === 'roles' && visibility.visibleRoleIds.length === 0) {
    throw new EnterpriseStorageServiceError(
      'INVALID_REQUEST',
      'At least one role is required for role visibility',
    );
  }
}

function assertPublishable(course: EnterpriseCourse): void {
  if (course.visibilityMode === 'roles' && course.visibleRoleIds.length === 0) {
    throw new EnterpriseStorageServiceError(
      'INVALID_REQUEST',
      'At least one role is required before publishing a role-visible course',
    );
  }
}

function parseHostKeyId(token: string | null | undefined): string | null {
  if (!token) return null;
  const separatorIndex = token.indexOf('.');
  return separatorIndex > 0 ? token.slice(0, separatorIndex) : null;
}

async function assertHostAccess(
  repository: EnterpriseRepository,
  pathname: string,
  token: string | null | undefined,
) {
  const keyId = parseHostKeyId(token);
  const key = keyId ? await repository.findHostApiKey(keyId) : null;
  const access = assertHostApiAccess({ pathname, token, key });
  if (!access.ok) {
    throw new EnterpriseStorageServiceError('HOST_API_UNAUTHORIZED', access.reason);
  }
  await repository.touchHostApiKey(access.keyId);
  return access.keyId;
}

export function createEnterpriseStorageService(repository: EnterpriseRepository) {
  return {
    listRoles: () => repository.listRoles(),
    createRole: (input: { code: string; name: string; isAdmin?: boolean }) =>
      repository.createRole(input),
    updateRole: async (id: string, patch: { code?: string; name?: string; isAdmin?: boolean }) => {
      const role = await repository.updateRole(id, patch);
      if (!role) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Role not found');
      return role;
    },

    listInviteCodes: () => repository.listInviteCodes(),
    createInviteCode: (input: {
      code: string;
      roleId: string;
      enabled?: boolean;
      expiresAt?: Date | null;
      createdBy?: string | null;
    }) => repository.createInviteCode(input),
    updateInviteCode: async (
      id: string,
      patch: { enabled?: boolean; expiresAt?: Date | null; roleId?: string },
    ) => {
      const inviteCode = await repository.updateInviteCode(id, patch);
      if (!inviteCode)
        throw new EnterpriseStorageServiceError('NOT_FOUND', 'Invite code not found');
      return inviteCode;
    },

    listCategories: () => repository.listCategories(),
    createCategory: (input: { name: string; sortOrder?: number }) =>
      repository.createCategory(input),
    updateCategory: async (id: string, patch: { name?: string; sortOrder?: number }) => {
      const category = await repository.updateCategory(id, patch);
      if (!category) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Category not found');
      return category;
    },

    listAdminCourses: (filters?: HostQueryFilters) => repository.listAdminCourses(filters),
    createCourse: (input: CreateCourseInput) => repository.createCourse(input),
    updateCourse: async (
      id: string,
      patch: { name?: string; description?: string | null; categoryId?: string },
    ) => {
      const course = await repository.updateCourse(id, patch);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },
    updateCourseVisibility: async (
      id: string,
      visibility: { visibilityMode: CourseVisibilityMode; visibleRoleIds: string[] },
    ) => {
      assertValidVisibility(visibility);
      const course = await repository.updateCourseVisibility(id, visibility);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },
    publishCourse: async (id: string) => {
      const current = await repository.getCourseContent(id);
      if (!current) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      assertPublishable(current.course);
      const course = await repository.publishCourse(id);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },
    archiveCourse: async (id: string) => {
      const course = await repository.archiveCourse(id);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },

    async listVisibleCourses(roleId: string) {
      const courses = await repository.listAdminCourses();
      return courses.filter((course) => isCourseVisibleToRole(course, roleId));
    },

    async getVisibleCourse(id: string, roleId: string) {
      const content = await repository.getCourseContent(id);
      if (!content) return null;
      return isCourseVisibleToRole(content.course, roleId) ? content : null;
    },

    replaceCourseContent: async (courseId: string, input: ReplaceCourseContentInput) => {
      const current = await repository.getCourseContent(courseId);
      if (!current) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      const content = await repository.replaceCourseContent(courseId, input);
      return {
        ...content,
        assessmentMismatchWarning: shouldShowAssessmentMismatchWarning(
          current.course.assessmentQuestions,
        ),
      };
    },

    saveCourseProgress: (input: EnterpriseCourseProgress) => repository.upsertCourseProgress(input),

    async getDashboard(filters?: HostQueryFilters) {
      const [summary, progress] = await Promise.all([
        repository.getDashboardSummary(filters),
        repository.listCourseProgress(filters),
      ]);
      return { summary, progress };
    },

    async getHostSummary(input: {
      pathname: string;
      token: string | null | undefined;
      filters: HostQueryFilters;
    }) {
      await assertHostAccess(repository, input.pathname, input.token);
      const summary = await repository.getDashboardSummary(input.filters);
      return { summary };
    },

    async getHostCourseProgress(input: {
      pathname: string;
      token: string | null | undefined;
      filters: HostQueryFilters;
    }) {
      await assertHostAccess(repository, input.pathname, input.token);
      const progress = await repository.listCourseProgress(input.filters);
      return { progress };
    },

    async getHostAssessmentAttempts(input: {
      pathname: string;
      token: string | null | undefined;
      filters: HostQueryFilters;
    }) {
      await assertHostAccess(repository, input.pathname, input.token);
      const attempts = await repository.listAssessmentAttempts(input.filters);
      return { attempts };
    },

    async getHostExamAttempts(input: {
      pathname: string;
      token: string | null | undefined;
      filters: HostQueryFilters;
    }) {
      await assertHostAccess(repository, input.pathname, input.token);
      const attempts = await repository.listExamAttempts(input.filters);
      return { attempts };
    },

    createMediaFile: (input: CreateMediaFileInput) => repository.createMediaFile(input),
    listMediaFiles: (filters?: { courseId?: string; sceneId?: string }) =>
      repository.listMediaFiles(filters),
    createOssPresignedUpload: (input: OssPresignedUploadInput) =>
      repository.createOssPresignedUpload(input),

    listExamPolicies: () => repository.listExamPolicies(),
    createExamPolicy: (input: {
      title: string;
      targetRoleId: string;
      categoryIds: string[];
      courseIds: string[];
      questionCount: number;
      passThreshold: number;
      timeLimitMinutes?: number | null;
    }) => repository.createExamPolicy(input),
    updateExamPolicy: async (
      id: string,
      patch: {
        title?: string;
        targetRoleId?: string;
        categoryIds?: string[];
        courseIds?: string[];
        questionCount?: number;
        passThreshold?: number;
        timeLimitMinutes?: number | null;
        status?: 'draft' | 'published' | 'archived';
      },
    ) => {
      const policy = await repository.updateExamPolicy(id, patch);
      if (!policy) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
      return policy;
    },
    publishExamPolicy: async (id: string) => {
      const policy = await repository.publishExamPolicy(id);
      if (!policy) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
      return policy;
    },
  };
}
