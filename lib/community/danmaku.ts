import type {
  EnterpriseCourseContent,
  EnterpriseRepository,
} from '@/lib/storage/enterprise-service';

export const DANMAKU_MAX_CONTENT_LENGTH = 200;
export const DANMAKU_DEFAULT_PAGE_SIZE = 50;
export const DANMAKU_MAX_PAGE_SIZE = 100;
export const DANMAKU_MIN_INTERVAL_MS = 2_000;
export const DANMAKU_WINDOW_MS = 60_000;
export const DANMAKU_MAX_PER_WINDOW = 20;

export type DanmakuStatus = 'visible' | 'hidden' | 'deleted_by_author' | 'deleted_by_admin';
export type DanmakuInputSource = 'text' | 'voice';

export interface DanmakuRecord {
  id: string;
  courseId: string;
  sceneKey: string;
  actionId: string;
  actionOffsetMs: number;
  authorId: string;
  content: string;
  inputSource: DanmakuInputSource;
  status: DanmakuStatus;
  clientRequestId: string | null;
  deletedAt: Date | null;
  moderatedBy: string | null;
  moderationReason: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDanmaku {
  id: string;
  sceneKey: string;
  actionId: string;
  actionOffsetMs: number;
  content: string;
  inputSource: DanmakuInputSource;
  createdAt: string;
}

export interface AdminDanmaku extends DanmakuRecord {
  author: {
    id: string;
    displayName: string;
    status: string;
    roleId: string;
    roleCode: string;
  };
}

export interface DanmakuCursor {
  createdAt: Date;
  id: string;
}

export interface DanmakuRepository {
  listVisible(input: {
    courseId: string;
    sceneKey: string;
    after?: DanmakuCursor;
    limit: number;
  }): Promise<DanmakuRecord[]>;
  findByRequestId(input: {
    authorId: string;
    courseId: string;
    clientRequestId: string;
  }): Promise<DanmakuRecord | null>;
  getAuthorSendWindow(authorId: string, since: Date): Promise<DanmakuRecord[]>;
  create(input: {
    courseId: string;
    sceneKey: string;
    actionId: string;
    actionOffsetMs: number;
    authorId: string;
    content: string;
    inputSource: DanmakuInputSource;
    clientRequestId?: string;
  }): Promise<DanmakuRecord>;
  softDeleteByAuthor(input: {
    id: string;
    courseId: string;
    authorId: string;
  }): Promise<DanmakuRecord | null>;
  listAdmin(input: {
    courseId?: string;
    sceneKey?: string;
    authorId?: string;
    status?: DanmakuStatus;
    after?: DanmakuCursor;
    limit: number;
  }): Promise<AdminDanmaku[]>;
  moderate(input: {
    id: string;
    action: 'hide' | 'restore' | 'delete';
    adminId: string;
    reason?: string;
  }): Promise<AdminDanmaku | null>;
}

export class DanmakuServiceError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_REQUEST'
      | 'RATE_LIMITED'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'DanmakuServiceError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findScene(content: EnterpriseCourseContent, sceneKey: string) {
  return content.scenes.find((scene) => asRecord(scene)?.id === sceneKey);
}

function assertActionBelongsToScene(scene: unknown, actionId: string): void {
  const actions = asRecord(scene)?.actions;
  if (
    !Array.isArray(actions) ||
    !actions.some((action) => {
      const record = asRecord(action);
      return record?.id === actionId;
    })
  ) {
    throw new DanmakuServiceError('INVALID_REQUEST', 'Action does not belong to scene');
  }
}

function actionBelongsToScene(scene: unknown, actionId: string): boolean {
  const actions = asRecord(scene)?.actions;
  return (
    Array.isArray(actions) &&
    actions.some((action) => {
      const record = asRecord(action);
      return record?.id === actionId;
    })
  );
}

function assertPublishedCourseVisible(content: EnterpriseCourseContent | null, roleId: string) {
  if (!content || content.course.status !== 'published') {
    throw new DanmakuServiceError('NOT_FOUND', 'Course not found');
  }
  if (
    content.course.visibilityMode === 'roles' &&
    !content.course.visibleRoleIds.includes(roleId)
  ) {
    throw new DanmakuServiceError('NOT_FOUND', 'Course not found');
  }
  return content;
}

function assertIdempotentReplayMatches(
  existing: DanmakuRecord,
  input: {
    sceneKey: string;
    actionId: string;
    actionOffsetMs: number;
    content: string;
    inputSource?: DanmakuInputSource;
  },
): void {
  if (
    existing.sceneKey !== input.sceneKey ||
    existing.actionId !== input.actionId ||
    existing.actionOffsetMs !== input.actionOffsetMs ||
    existing.content !== input.content ||
    existing.inputSource !== (input.inputSource ?? 'text')
  ) {
    throw new DanmakuServiceError(
      'CONFLICT',
      'Idempotency key was already used for different danmaku content',
    );
  }
}

export function toPublicDanmaku(record: DanmakuRecord): PublicDanmaku {
  return {
    id: record.id,
    sceneKey: record.sceneKey,
    actionId: record.actionId,
    actionOffsetMs: record.actionOffsetMs,
    content: record.content,
    inputSource: record.inputSource,
    createdAt: record.createdAt.toISOString(),
  };
}

export function encodeDanmakuCursor(record: Pick<DanmakuRecord, 'createdAt' | 'id'>): string {
  return Buffer.from(JSON.stringify([record.createdAt.toISOString(), record.id])).toString(
    'base64url',
  );
}

export function decodeDanmakuCursor(value: string | null | undefined): DanmakuCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error('invalid cursor');
    const [dateValue, id] = parsed;
    const createdAt = new Date(dateValue);
    if (
      typeof dateValue !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof id !== 'string' ||
      !id
    ) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id };
  } catch {
    throw new DanmakuServiceError('INVALID_REQUEST', 'Invalid danmaku cursor');
  }
}

export function parseDanmakuLimit(value: string | null): number {
  if (value === null) return DANMAKU_DEFAULT_PAGE_SIZE;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > DANMAKU_MAX_PAGE_SIZE) {
    throw new DanmakuServiceError(
      'INVALID_REQUEST',
      `limit must be between 1 and ${DANMAKU_MAX_PAGE_SIZE}`,
    );
  }
  return limit;
}

export function createDanmakuService(
  repository: DanmakuRepository,
  courses: Pick<EnterpriseRepository, 'getCourseContent'>,
  now: () => Date = () => new Date(),
) {
  async function getVisibleCourse(courseId: string, roleId: string) {
    return assertPublishedCourseVisible(await courses.getCourseContent(courseId), roleId);
  }

  return {
    async listVisible(input: {
      courseId: string;
      sceneKey: string;
      roleId: string;
      after?: DanmakuCursor;
      limit: number;
    }) {
      const content = await getVisibleCourse(input.courseId, input.roleId);
      const scene = findScene(content, input.sceneKey);
      if (!scene) {
        throw new DanmakuServiceError('NOT_FOUND', 'Scene not found');
      }
      const rows = await repository.listVisible(input);
      const anchoredRows = rows.filter((row) => actionBelongsToScene(scene, row.actionId));
      return {
        items: anchoredRows.map(toPublicDanmaku),
        nextCursor: rows.length === input.limit ? encodeDanmakuCursor(rows[rows.length - 1]) : null,
      };
    },

    async create(input: {
      courseId: string;
      sceneKey: string;
      actionId: string;
      actionOffsetMs: number;
      authorId: string;
      roleId: string;
      content: string;
      inputSource?: DanmakuInputSource;
      clientRequestId?: string;
    }) {
      const content = input.content.trim();
      if (!content || content.length > DANMAKU_MAX_CONTENT_LENGTH) {
        throw new DanmakuServiceError(
          'INVALID_REQUEST',
          `Danmaku content must be between 1 and ${DANMAKU_MAX_CONTENT_LENGTH} characters`,
        );
      }
      if (!Number.isInteger(input.actionOffsetMs) || input.actionOffsetMs < 0) {
        throw new DanmakuServiceError('INVALID_REQUEST', 'actionOffsetMs must be non-negative');
      }
      if (input.inputSource && input.inputSource !== 'text' && input.inputSource !== 'voice') {
        throw new DanmakuServiceError('INVALID_REQUEST', 'inputSource must be text or voice');
      }
      if (input.clientRequestId && input.clientRequestId.length > 128) {
        throw new DanmakuServiceError('INVALID_REQUEST', 'Idempotency key is too long');
      }

      const course = await getVisibleCourse(input.courseId, input.roleId);
      const scene = findScene(course, input.sceneKey);
      if (!scene)
        throw new DanmakuServiceError('INVALID_REQUEST', 'Scene does not belong to course');
      assertActionBelongsToScene(scene, input.actionId);

      if (input.clientRequestId) {
        const existing = await repository.findByRequestId({
          authorId: input.authorId,
          courseId: input.courseId,
          clientRequestId: input.clientRequestId,
        });
        if (existing) {
          assertIdempotentReplayMatches(existing, { ...input, content });
          return { danmaku: toPublicDanmaku(existing), created: false };
        }
      }

      const sent = await repository.getAuthorSendWindow(
        input.authorId,
        new Date(now().getTime() - DANMAKU_WINDOW_MS),
      );
      if (sent.length >= DANMAKU_MAX_PER_WINDOW) {
        throw new DanmakuServiceError('RATE_LIMITED', 'Danmaku send limit exceeded');
      }
      const latest = sent.reduce<Date | null>(
        (current, item) => (!current || item.createdAt > current ? item.createdAt : current),
        null,
      );
      if (latest && now().getTime() - latest.getTime() < DANMAKU_MIN_INTERVAL_MS) {
        throw new DanmakuServiceError('RATE_LIMITED', 'Please wait before sending another danmaku');
      }

      try {
        const created = await repository.create({
          courseId: input.courseId,
          sceneKey: input.sceneKey,
          actionId: input.actionId,
          actionOffsetMs: input.actionOffsetMs,
          authorId: input.authorId,
          content,
          inputSource: input.inputSource ?? 'text',
          clientRequestId: input.clientRequestId,
        });
        return { danmaku: toPublicDanmaku(created), created: true };
      } catch (error) {
        if (input.clientRequestId) {
          const existing = await repository.findByRequestId({
            authorId: input.authorId,
            courseId: input.courseId,
            clientRequestId: input.clientRequestId,
          });
          if (existing) {
            assertIdempotentReplayMatches(existing, { ...input, content });
            return { danmaku: toPublicDanmaku(existing), created: false };
          }
        }
        throw error;
      }
    },

    async deleteOwn(input: { id: string; courseId: string; authorId: string; roleId: string }) {
      await getVisibleCourse(input.courseId, input.roleId);
      const deleted = await repository.softDeleteByAuthor(input);
      if (!deleted) throw new DanmakuServiceError('NOT_FOUND', 'Danmaku not found');
      return toPublicDanmaku(deleted);
    },

    listAdmin: (input: Parameters<DanmakuRepository['listAdmin']>[0]) =>
      repository.listAdmin(input),

    async moderate(input: {
      id: string;
      action: 'hide' | 'restore' | 'delete';
      adminId: string;
      reason?: string;
    }) {
      if (!['hide', 'restore', 'delete'].includes(input.action)) {
        throw new DanmakuServiceError('INVALID_REQUEST', 'Unsupported moderation action');
      }
      if (input.reason && input.reason.trim().length > 500) {
        throw new DanmakuServiceError('INVALID_REQUEST', 'Moderation reason is too long');
      }
      const updated = await repository.moderate({
        ...input,
        reason: input.reason?.trim() || undefined,
      });
      if (!updated) throw new DanmakuServiceError('NOT_FOUND', 'Danmaku not found');
      return updated;
    },
  };
}
