import { assertHostApiAccess, type StoredHostApiKey } from '@/lib/host-api/access';
import type { DashboardSummary, HostQueryFilters } from '@/lib/host-api/types';
import type { AuthRole } from '@/lib/auth/service';
import { shouldShowAssessmentMismatchWarning } from '@/lib/authoring/course-draft';
import {
  generateCourseAssessmentQuestions,
  type GenerateCourseAssessmentQuestionsInput,
} from '@/lib/assessment/course-assessment-generation';
import {
  buildCourseAssessment,
  filterChoiceQuestions,
  gradeCourseAssessment,
  toPublicCourseAssessment,
  type AssessmentAnswers,
  type CourseAssessmentDetail,
  type PublicCourseAssessment,
} from '@/lib/assessment/course-assessment';
import {
  collectStageExamCandidates,
  drawStageExamQuestions,
  gradeStageExam,
  resolveQuestionsFromRefs,
  toPublicStageExam,
  type PublicStageExam,
  type StageExamAttemptDetail,
  type StageExamQuestionRef,
} from '@/lib/exams/stage-exam';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibilityMode = 'all' | 'roles';
export type CourseListSort = 'latest' | 'popular';

export interface EnterpriseCourse {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string | null;
  status: CourseStatus;
  visibilityMode: CourseVisibilityMode;
  visibleRoleIds: string[];
  stageSnapshot?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
  assessmentQuestions: unknown[];
  learnerCount?: number;
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
  stage?: unknown;
  scenes: unknown[];
  outlines: unknown[];
  mediaManifest?: EnterpriseMediaManifestItem[];
  audioManifest?: EnterpriseAudioManifestItem[];
}

export interface ReplaceCourseContentInput {
  scenes: unknown[];
  outlines: unknown[];
  stage?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
}

export interface EnterpriseStoredCourseContent {
  courseId: string;
  scenes: unknown[];
  outlines: unknown[];
  stage?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
  assessmentMismatchWarning?: boolean;
}

export interface EnterpriseCourseProgress {
  userId: string;
  courseId: string;
  sceneIndex: number;
  actionIndex: number;
  completed: boolean;
  startedAt?: Date;
  lastViewedAt?: Date;
  updatedAt?: Date;
}

export interface EnterpriseAssessmentAttempt {
  id: string;
  userId: string;
  courseId: string;
  roleSnapshot: string;
  attemptNumber: number;
  score: number;
  passed: boolean;
  threshold: number;
  answers: AssessmentAnswers;
  details: CourseAssessmentDetail[];
  createdAt: Date;
}

export type EnterpriseAssessmentAttemptInput = Omit<
  EnterpriseAssessmentAttempt,
  'id' | 'createdAt'
>;

export interface SubmitCourseAssessmentInput {
  courseId: string;
  userId: string;
  roleId: string;
  roleSnapshot: string;
  answers: AssessmentAnswers;
}

export interface SubmitCourseAssessmentResult {
  attempt: EnterpriseAssessmentAttempt;
  requiresRelearning: boolean;
}

export type GenerateCourseAssessmentInput = Omit<GenerateCourseAssessmentQuestionsInput, 'content'>;

export interface EnterpriseProgressDetail {
  userId: string;
  displayName: string;
  roleId: string;
  roleCode: string;
  courseId: string;
  courseName: string;
  completed: boolean;
  startedAt?: Date;
  lastViewedAt?: Date;
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
  candidateQuestionCount?: number;
}

export type DeleteExamPolicyRepositoryResult =
  | { outcome: 'deleted'; policy: EnterpriseExamPolicy }
  | { outcome: 'not_draft'; policy: EnterpriseExamPolicy }
  | { outcome: 'not_found' };

export interface EnterpriseExamAttempt {
  id: string;
  examPolicyId: string;
  userId: string;
  roleSnapshot: string;
  attemptNumber: number;
  score: number;
  passed: boolean;
  threshold: number;
  duration: number | null;
  answers: AssessmentAnswers;
  details: StageExamAttemptDetail[];
  questionRefs: StageExamQuestionRef[];
  createdAt: Date;
}

export type EnterpriseExamAttemptInput = Omit<EnterpriseExamAttempt, 'id' | 'createdAt'>;

export interface SubmitStageExamInput {
  examPolicyId: string;
  userId: string;
  roleId: string;
  roleSnapshot: string;
  answers: AssessmentAnswers;
  questionRefs: StageExamQuestionRef[];
  durationSeconds?: number | null;
}

export interface SubmitStageExamResult {
  attempt: EnterpriseExamAttempt;
}

export interface EnterpriseMediaFile {
  id: string;
  courseId: string | null;
  sceneId: string | null;
  sceneKey?: string | null;
  mediaId: string;
  mediaType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  prompt: string | null;
  params: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnterpriseMediaBlob {
  courseId: string;
  mediaId: string;
  mediaType: string;
  mimeType: string | null;
  sizeBytes: number | null;
  blob: Buffer;
}

export interface EnterpriseAudioBlob {
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

export interface EnterpriseMediaManifestItem {
  mediaId: string;
  url: string;
  type: 'image' | 'video';
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface EnterpriseAudioManifestItem {
  audioId: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number;
}

export interface CreateCourseInput {
  name: string;
  description?: string | null;
  categoryId: string;
  createdBy?: string | null;
  assessmentQuestions?: unknown[];
  stageSnapshot?: unknown;
  generationStatus?: string;
  generationComplete?: boolean;
}

export interface CreateMediaFileInput {
  courseId?: string | null;
  sceneId?: string | null;
  sceneKey?: string | null;
  mediaId: string;
  mediaType: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  prompt?: string | null;
  params?: unknown;
  blob: Buffer;
  posterBlob?: Buffer | null;
}

export interface CreateCourseAudioBlobInput {
  courseId: string;
  sceneKey?: string | null;
  audioId: string;
  mimeType?: string | null;
  sizeBytes?: number;
  text?: string | null;
  voice?: string | null;
  blob: Buffer;
}

export interface EnterpriseRepository {
  listRoles(): Promise<AuthRole[]>;
  createRole(input: { code: string; name: string; isAdmin?: boolean }): Promise<AuthRole>;
  updateRole(
    id: string,
    patch: { code?: string; name?: string; isAdmin?: boolean },
  ): Promise<AuthRole | null>;
  getRoleUsage(
    roleId: string,
  ): Promise<{ users: number; inviteCodes: number; examPolicies: number }>;
  deleteRole(id: string): Promise<AuthRole | null>;

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
  deleteInviteCode(id: string): Promise<EnterpriseInviteCode | null>;

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
  deleteCourse(id: string): Promise<EnterpriseCourse | null>;
  getCourseContent(id: string): Promise<EnterpriseCourseContent | null>;
  replaceCourseContent(
    courseId: string,
    input: ReplaceCourseContentInput,
  ): Promise<EnterpriseStoredCourseContent>;
  updateCourseAssessmentQuestions(
    courseId: string,
    questions: unknown[],
  ): Promise<EnterpriseCourse | null>;
  getCourseProgress(userId: string, courseId: string): Promise<EnterpriseCourseProgress | null>;
  markCourseStarted(input: { userId: string; courseId: string }): Promise<EnterpriseCourseProgress>;
  upsertCourseProgress(input: EnterpriseCourseProgress): Promise<EnterpriseCourseProgress>;
  listCourseAssessmentAttempts(
    userId: string,
    courseId: string,
  ): Promise<EnterpriseAssessmentAttempt[]>;
  createAssessmentAttempt(
    input: EnterpriseAssessmentAttemptInput,
  ): Promise<EnterpriseAssessmentAttempt>;

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
  deleteExamPolicy(id: string): Promise<DeleteExamPolicyRepositoryResult>;
  listExamAttemptsForUser(examPolicyId: string, userId: string): Promise<EnterpriseExamAttempt[]>;
  createExamAttempt(input: EnterpriseExamAttemptInput): Promise<EnterpriseExamAttempt>;

  findHostApiKey(keyId: string): Promise<StoredHostApiKey | null>;
  touchHostApiKey(keyId: string): Promise<void>;

  createMediaFile(input: CreateMediaFileInput): Promise<EnterpriseMediaFile>;
  listMediaFiles(filters?: { courseId?: string; sceneId?: string }): Promise<EnterpriseMediaFile[]>;
  getMediaFileBlob(courseId: string, mediaId: string): Promise<EnterpriseMediaBlob | null>;
  createCourseAudioBlob(input: CreateCourseAudioBlobInput): Promise<EnterpriseAudioBlob>;
  listCourseAudioBlobs(courseId: string): Promise<EnterpriseAudioBlob[]>;
  getCourseAudioBlob(courseId: string, audioId: string): Promise<EnterpriseAudioBlob | null>;
}

export type EnterpriseStorageServiceErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
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

function sortVisibleCourses(courses: EnterpriseCourse[], sort: CourseListSort): EnterpriseCourse[] {
  return [...courses].sort((left, right) => {
    if (sort === 'popular') {
      const countDifference = (right.learnerCount ?? 0) - (left.learnerCount ?? 0);
      if (countDifference !== 0) return countDifference;
    }
    const dateDifference = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (dateDifference !== 0) return dateDifference;
    return left.id.localeCompare(right.id);
  });
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

function maxAttemptNumber(attempts: EnterpriseAssessmentAttempt[]): number {
  return attempts.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0);
}

function maxExamAttemptNumber(attempts: EnterpriseExamAttempt[]): number {
  return attempts.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0);
}

function parseHostKeyId(token: string | null | undefined): string | null {
  if (!token) return null;
  const separatorIndex = token.indexOf('.');
  return separatorIndex > 0 ? token.slice(0, separatorIndex) : null;
}

function buildMediaManifest(courseId: string, mediaFiles: EnterpriseMediaFile[]) {
  return mediaFiles
    .filter(
      (media): media is EnterpriseMediaFile & { mediaType: 'image' | 'video' } =>
        media.mediaType === 'image' || media.mediaType === 'video',
    )
    .map((media) => ({
      mediaId: media.mediaId,
      url: `/api/courses/${courseId}/media/${encodeURIComponent(media.mediaId)}`,
      type: media.mediaType,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
    }));
}

function buildAudioManifest(courseId: string, audioBlobs: EnterpriseAudioBlob[]) {
  return audioBlobs.map((audio) => ({
    audioId: audio.audioId,
    url: `/api/courses/${courseId}/audio/${encodeURIComponent(audio.audioId)}`,
    mimeType: audio.mimeType,
    sizeBytes: audio.sizeBytes,
  }));
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
  async function getExamPolicyCandidates(policy: EnterpriseExamPolicy) {
    const courses = await repository.listAdminCourses();
    const eligibleCourses = courses.filter((course) => {
      if (course.status !== 'published') return false;
      if (!policy.categoryIds.includes(course.categoryId)) return false;
      if (policy.courseIds.length > 0 && !policy.courseIds.includes(course.id)) return false;
      return true;
    });
    const contents = (
      await Promise.all(eligibleCourses.map((course) => repository.getCourseContent(course.id)))
    ).filter((content): content is EnterpriseCourseContent => content !== null);
    return collectStageExamCandidates(contents);
  }

  async function withCandidateQuestionCount(
    policy: EnterpriseExamPolicy,
  ): Promise<EnterpriseExamPolicy> {
    const candidates = await getExamPolicyCandidates(policy);
    return { ...policy, candidateQuestionCount: candidates.length };
  }

  async function getPublishedExamPolicyForRole(policyId: string, roleId: string) {
    const policy = (await repository.listExamPolicies()).find(
      (candidate) => candidate.id === policyId,
    );
    if (!policy || policy.status !== 'published') {
      throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
    }
    if (policy.targetRoleId !== roleId) {
      throw new EnterpriseStorageServiceError(
        'FORBIDDEN',
        'Exam policy is not available for this role',
      );
    }
    return policy;
  }

  return {
    listRoles: () => repository.listRoles(),
    createRole: (input: { code: string; name: string; isAdmin?: boolean }) =>
      repository.createRole(input),
    updateRole: async (id: string, patch: { code?: string; name?: string; isAdmin?: boolean }) => {
      const role = await repository.updateRole(id, patch);
      if (!role) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Role not found');
      return role;
    },
    deleteRole: async (id: string) => {
      const currentRoles = await repository.listRoles();
      const role = currentRoles.find((candidate) => candidate.id === id);
      if (!role) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Role not found');
      const adminRoleCount = currentRoles.filter((candidate) => candidate.isAdmin).length;
      if (role.isAdmin && adminRoleCount <= 1) {
        throw new EnterpriseStorageServiceError(
          'CONFLICT',
          'At least one administrator role must remain',
        );
      }
      const usage = await repository.getRoleUsage(id);
      if (usage.users > 0 || usage.inviteCodes > 0 || usage.examPolicies > 0) {
        throw new EnterpriseStorageServiceError(
          'CONFLICT',
          'Role is still assigned to users, invite codes, or exam policies',
        );
      }
      const deletedRole = await repository.deleteRole(id);
      if (!deletedRole) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Role not found');
      return deletedRole;
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
    deleteInviteCode: async (id: string) => {
      const inviteCode = await repository.deleteInviteCode(id);
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
    deleteCourse: async (id: string) => {
      const course = await repository.deleteCourse(id);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },

    async listVisibleCourses(roleId: string, sort: CourseListSort = 'latest') {
      const courses = await repository.listAdminCourses();
      return sortVisibleCourses(
        courses.filter((course) => isCourseVisibleToRole(course, roleId)),
        sort,
      );
    },

    async getVisibleCourse(id: string, roleId: string) {
      const content = await repository.getCourseContent(id);
      if (!content) return null;
      if (!isCourseVisibleToRole(content.course, roleId)) return null;
      const [mediaFiles, audioBlobs] = await Promise.all([
        repository.listMediaFiles({ courseId: id }),
        repository.listCourseAudioBlobs(id),
      ]);
      return {
        ...content,
        stage: content.stage ?? content.course.stageSnapshot,
        mediaManifest: buildMediaManifest(id, mediaFiles),
        audioManifest: buildAudioManifest(id, audioBlobs),
      };
    },

    async getCourseContent(id: string) {
      const content = await repository.getCourseContent(id);
      if (!content) return null;
      const [mediaFiles, audioBlobs] = await Promise.all([
        repository.listMediaFiles({ courseId: id }),
        repository.listCourseAudioBlobs(id),
      ]);
      return {
        ...content,
        stage: content.stage ?? content.course.stageSnapshot,
        mediaManifest: buildMediaManifest(id, mediaFiles),
        audioManifest: buildAudioManifest(id, audioBlobs),
      };
    },

    async startCourse(input: { courseId: string; userId: string; roleId: string }) {
      const content = await repository.getCourseContent(input.courseId);
      if (!content || !isCourseVisibleToRole(content.course, input.roleId)) {
        throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      }
      return repository.markCourseStarted({
        userId: input.userId,
        courseId: input.courseId,
      });
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

    async getCourseAssessment(input: {
      courseId: string;
      userId: string;
      roleId: string;
    }): Promise<PublicCourseAssessment> {
      const content = await this.getVisibleCourse(input.courseId, input.roleId);
      if (!content) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      const [progress, attempts] = await Promise.all([
        repository.getCourseProgress(input.userId, input.courseId),
        repository.listCourseAssessmentAttempts(input.userId, input.courseId),
      ]);
      return toPublicCourseAssessment(
        buildCourseAssessment(input.courseId, content.course.assessmentQuestions),
        {
          completed: attempts.some((attempt) => attempt.passed),
          canAttempt: progress?.completed === true,
          requiresRelearning:
            attempts.some((attempt) => !attempt.passed) && progress?.completed !== true,
        },
      );
    },

    async submitCourseAssessment(
      input: SubmitCourseAssessmentInput,
    ): Promise<SubmitCourseAssessmentResult> {
      const content = await this.getVisibleCourse(input.courseId, input.roleId);
      if (!content) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      const progress = await repository.getCourseProgress(input.userId, input.courseId);
      if (progress?.completed !== true) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'Course learning must be completed before assessment',
        );
      }

      const assessment = buildCourseAssessment(input.courseId, content.course.assessmentQuestions);
      if (assessment.questions.length === 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'Course assessment has no choice questions',
        );
      }

      const grade = gradeCourseAssessment({
        questions: assessment.questions,
        answers: input.answers,
        threshold: assessment.threshold,
      });
      const attempts = await repository.listCourseAssessmentAttempts(input.userId, input.courseId);
      const attempt = await repository.createAssessmentAttempt({
        userId: input.userId,
        courseId: input.courseId,
        roleSnapshot: input.roleSnapshot,
        attemptNumber: maxAttemptNumber(attempts) + 1,
        score: grade.score,
        passed: grade.passed,
        threshold: grade.threshold,
        answers: grade.answers,
        details: grade.details,
      });

      if (!grade.passed) {
        await repository.upsertCourseProgress({
          userId: input.userId,
          courseId: input.courseId,
          sceneIndex: 0,
          actionIndex: 0,
          completed: false,
        });
      } else {
        await repository.upsertCourseProgress({
          userId: input.userId,
          courseId: input.courseId,
          sceneIndex: progress.sceneIndex,
          actionIndex: progress.actionIndex,
          completed: true,
        });
      }

      return { attempt, requiresRelearning: !grade.passed };
    },

    async updateCourseAssessmentQuestions(courseId: string, questions: unknown[]) {
      const current = await repository.getCourseContent(courseId);
      if (!current) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      const choiceQuestions = filterChoiceQuestions(questions);
      const course = await repository.updateCourseAssessmentQuestions(courseId, choiceQuestions);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
    },

    async regenerateCourseAssessment(courseId: string, input: GenerateCourseAssessmentInput) {
      const current = await repository.getCourseContent(courseId);
      if (!current) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      const choiceQuestions = await generateCourseAssessmentQuestions({
        content: current,
        aiCall: input.aiCall,
        questionCount: input.questionCount,
        languageDirective: input.languageDirective,
      });
      const course = await repository.updateCourseAssessmentQuestions(courseId, choiceQuestions);
      if (!course) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Course not found');
      return course;
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
    getMediaFileBlob: (courseId: string, mediaId: string) =>
      repository.getMediaFileBlob(courseId, mediaId),
    createCourseAudioBlob: (input: CreateCourseAudioBlobInput) =>
      repository.createCourseAudioBlob(input),
    listCourseAudioBlobs: (courseId: string) => repository.listCourseAudioBlobs(courseId),
    getCourseAudioBlob: (courseId: string, audioId: string) =>
      repository.getCourseAudioBlob(courseId, audioId),

    async listExamPolicies() {
      const policies = await repository.listExamPolicies();
      return Promise.all(policies.map(withCandidateQuestionCount));
    },
    async createExamPolicy(input: {
      title: string;
      targetRoleId: string;
      categoryIds: string[];
      courseIds: string[];
      questionCount: number;
      passThreshold: number;
      timeLimitMinutes?: number | null;
    }) {
      if (input.categoryIds.length === 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'At least one category is required',
        );
      }
      if (input.questionCount <= 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'questionCount must be positive',
        );
      }
      if (input.passThreshold < 0 || input.passThreshold > 100) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'passThreshold must be between 0 and 100',
        );
      }
      return withCandidateQuestionCount(await repository.createExamPolicy(input));
    },
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
      if (patch.categoryIds !== undefined && patch.categoryIds.length === 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'At least one category is required',
        );
      }
      if (patch.questionCount !== undefined && patch.questionCount <= 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'questionCount must be positive',
        );
      }
      if (
        patch.passThreshold !== undefined &&
        (patch.passThreshold < 0 || patch.passThreshold > 100)
      ) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'passThreshold must be between 0 and 100',
        );
      }
      const policy = await repository.updateExamPolicy(id, patch);
      if (!policy) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
      return withCandidateQuestionCount(policy);
    },
    publishExamPolicy: async (id: string) => {
      const policy = await repository.publishExamPolicy(id);
      if (!policy) throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
      return withCandidateQuestionCount(policy);
    },
    deleteExamPolicy: async (id: string) => {
      const result = await repository.deleteExamPolicy(id);
      if (result.outcome === 'not_found') {
        throw new EnterpriseStorageServiceError('NOT_FOUND', 'Exam policy not found');
      }
      if (result.outcome === 'not_draft') {
        throw new EnterpriseStorageServiceError(
          'CONFLICT',
          'Only draft exam policies can be deleted',
        );
      }
      return result.policy;
    },
    async listAvailableExams(roleId: string): Promise<EnterpriseExamPolicy[]> {
      const policies = await repository.listExamPolicies();
      const available = policies.filter(
        (policy) => policy.status === 'published' && policy.targetRoleId === roleId,
      );
      return Promise.all(available.map(withCandidateQuestionCount));
    },
    async startStageExam(input: {
      examPolicyId: string;
      roleId: string;
    }): Promise<PublicStageExam> {
      const policy = await getPublishedExamPolicyForRole(input.examPolicyId, input.roleId);
      const candidates = await getExamPolicyCandidates(policy);
      if (candidates.length === 0) {
        throw new EnterpriseStorageServiceError(
          'INVALID_REQUEST',
          'Exam policy has no choice questions',
        );
      }
      const selected = drawStageExamQuestions(candidates, policy.questionCount);
      return toPublicStageExam({ ...policy, candidateQuestionCount: candidates.length }, selected);
    },
    async submitStageExam(input: SubmitStageExamInput): Promise<SubmitStageExamResult> {
      const policy = await getPublishedExamPolicyForRole(input.examPolicyId, input.roleId);
      if (input.questionRefs.length === 0) {
        throw new EnterpriseStorageServiceError('INVALID_REQUEST', 'questionRefs are required');
      }
      const candidates = await getExamPolicyCandidates(policy);
      let questions;
      try {
        questions = resolveQuestionsFromRefs(candidates, input.questionRefs);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid exam question reference';
        throw new EnterpriseStorageServiceError('INVALID_REQUEST', message);
      }
      const grade = gradeStageExam({
        questions,
        answers: input.answers,
        threshold: policy.passThreshold,
      });
      const attempts = await repository.listExamAttemptsForUser(input.examPolicyId, input.userId);
      const attempt = await repository.createExamAttempt({
        examPolicyId: input.examPolicyId,
        userId: input.userId,
        roleSnapshot: input.roleSnapshot,
        attemptNumber: maxExamAttemptNumber(attempts) + 1,
        score: grade.score,
        passed: grade.passed,
        threshold: grade.threshold,
        duration: input.durationSeconds ?? null,
        answers: grade.answers,
        details: grade.details,
        questionRefs: input.questionRefs,
      });
      return { attempt };
    },
  };
}
