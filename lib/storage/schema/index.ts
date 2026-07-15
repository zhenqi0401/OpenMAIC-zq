import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  code: varchar('code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  ...timestamps,
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    phone: varchar('phone', { length: 32 }).unique(),
    passwordHash: text('password_hash'),
    hostUserId: varchar('host_user_id', { length: 128 }).unique(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('users_role_id_idx').on(table.roleId),
    index('users_host_user_id_idx').on(table.hostUserId),
  ],
);

export const inviteCodes = pgTable(
  'invite_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    codeHash: text('code_hash').notNull().unique(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    enabled: boolean('enabled').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('invite_codes_role_id_idx').on(table.roleId)],
);

export const courseCategories = pgTable('course_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  name: varchar('name', { length: 128 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    name: text('name').notNull(),
    description: text('description'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => courseCategories.id),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    visibilityMode: varchar('visibility_mode', { length: 16 }).notNull().default('all'),
    stageSnapshot: jsonb('stage_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    generationStatus: varchar('generation_status', { length: 32 }).notNull().default('draft'),
    generationComplete: boolean('generation_complete').notNull().default(false),
    assessmentQuestions: jsonb('assessment_questions')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdBy: uuid('created_by').references(() => users.id),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('courses_category_id_idx').on(table.categoryId),
    index('courses_status_idx').on(table.status),
  ],
);

export const courseVisibilityRoles = pgTable(
  'course_visibility_roles',
  {
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.roleId] })],
);

export const courseDanmaku = pgTable(
  'course_danmaku',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    sceneKey: varchar('scene_key', { length: 128 }).notNull(),
    actionId: varchar('action_id', { length: 128 }).notNull(),
    actionOffsetMs: integer('action_offset_ms').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    content: varchar('content', { length: 200 }).notNull(),
    inputSource: varchar('input_source', { length: 16 }).notNull().default('text'),
    status: varchar('status', { length: 32 }).notNull().default('visible'),
    clientRequestId: varchar('client_request_id', { length: 128 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('course_danmaku_course_scene_status_created_idx').on(
      table.courseId,
      table.sceneKey,
      table.status,
      table.createdAt,
      table.id,
    ),
    index('course_danmaku_course_scene_action_idx').on(
      table.courseId,
      table.sceneKey,
      table.actionId,
    ),
    index('course_danmaku_author_created_idx').on(table.authorId, table.createdAt),
    uniqueIndex('course_danmaku_author_course_request_idx').on(
      table.authorId,
      table.courseId,
      table.clientRequestId,
    ),
  ],
);

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    scope: varchar('scope', { length: 16 }).notNull().default('global'),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('visible'),
    pinned: boolean('pinned').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    replyCount: integer('reply_count').notNull().default(0),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('forum_posts_status_pinned_created_idx').on(
      table.status,
      table.pinned,
      table.createdAt,
      table.id,
    ),
    index('forum_posts_status_pinned_activity_idx').on(
      table.status,
      table.pinned,
      table.lastActivityAt,
      table.id,
    ),
    index('forum_posts_course_status_activity_idx').on(
      table.courseId,
      table.status,
      table.lastActivityAt,
    ),
    index('forum_posts_author_created_idx').on(table.authorId, table.createdAt),
  ],
);

export const forumReplies = pgTable(
  'forum_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => forumPosts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('visible'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('forum_replies_post_status_created_idx').on(
      table.postId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index('forum_replies_author_created_idx').on(table.authorId, table.createdAt),
  ],
);

export const communityRateLimits = pgTable(
  'community_rate_limits',
  {
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actionKind: varchar('action_kind', { length: 32 }).notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
    actionCount: integer('action_count').notNull().default(1),
    lastActionAt: timestamp('last_action_at', { withTimezone: true }).notNull(),
    lastContentHash: varchar('last_content_hash', { length: 64 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.actorId, table.actionKind] }),
    index('community_rate_limits_updated_at_idx').on(table.updatedAt),
  ],
);

export const communityModerationAudit = pgTable(
  'community_moderation_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moderatorId: uuid('moderator_id')
      .notNull()
      .references(() => users.id),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: uuid('target_id').notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('community_moderation_audit_target_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index('community_moderation_audit_moderator_created_idx').on(
      table.moderatorId,
      table.createdAt,
    ),
    index('community_moderation_audit_created_at_idx').on(table.createdAt),
  ],
);

export const courseScenes = pgTable(
  'course_scenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    sceneKey: varchar('scene_key', { length: 128 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    title: text('title').notNull(),
    sceneOrder: integer('scene_order').notNull(),
    sceneData: jsonb('scene_data').notNull(),
    content: jsonb('content').notNull(),
    actions: jsonb('actions'),
    whiteboards: jsonb('whiteboards'),
    ...timestamps,
  },
  (table) => [
    index('course_scenes_course_id_idx').on(table.courseId),
    uniqueIndex('course_scenes_course_scene_key_idx').on(table.courseId, table.sceneKey),
  ],
);

export const scenes = courseScenes;

export const courseOutlines = pgTable('course_outlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  outline: jsonb('outline').notNull(),
  generationStatus: varchar('generation_status', { length: 32 }).notNull().default('draft'),
  generationComplete: boolean('generation_complete').notNull().default(false),
  ...timestamps,
});

export const outlines = courseOutlines;

export const mediaFiles = pgTable(
  'media_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    sceneId: uuid('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    sceneKey: varchar('scene_key', { length: 128 }),
    mediaId: varchar('media_id', { length: 128 }).notNull(),
    mediaType: varchar('media_type', { length: 32 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    prompt: text('prompt'),
    params: jsonb('params'),
    blob: bytea('blob').notNull(),
    posterBlob: bytea('poster_blob'),
    ...timestamps,
  },
  (table) => [
    index('media_files_course_id_idx').on(table.courseId),
    uniqueIndex('media_files_course_media_id_idx').on(table.courseId, table.mediaId),
  ],
);

export const courseAudioBlobs = pgTable(
  'course_audio_blobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    sceneKey: varchar('scene_key', { length: 128 }),
    audioId: varchar('audio_id', { length: 128 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes').notNull(),
    text: text('text'),
    voice: varchar('voice', { length: 128 }),
    blob: bytea('blob').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('course_audio_blobs_course_id_idx').on(table.courseId),
    uniqueIndex('course_audio_blobs_course_audio_id_idx').on(table.courseId, table.audioId),
  ],
);

export const courseProgress = pgTable(
  'course_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    sceneIndex: integer('scene_index').notNull().default(0),
    actionIndex: integer('action_index').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.courseId] }),
    index('course_progress_course_id_idx').on(table.courseId),
  ],
);

export const assessmentAttempts = pgTable(
  'assessment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    roleSnapshot: varchar('role_snapshot', { length: 64 }).notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    score: integer('score').notNull(),
    passed: boolean('passed').notNull(),
    threshold: integer('threshold').notNull(),
    answers: jsonb('answers').notNull(),
    details: jsonb('details').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('assessment_attempts_user_course_idx').on(table.userId, table.courseId)],
);

export const examPolicies = pgTable('exam_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  title: text('title').notNull(),
  targetRoleId: uuid('target_role_id')
    .notNull()
    .references(() => roles.id),
  categoryIds: jsonb('category_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  questionCount: integer('question_count').notNull(),
  timeLimit: integer('time_limit'),
  passThreshold: integer('pass_threshold').notNull().default(80),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  ...timestamps,
});

export const examPolicyCourses = pgTable(
  'exam_policy_courses',
  {
    examPolicyId: uuid('exam_policy_id')
      .notNull()
      .references(() => examPolicies.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.examPolicyId, table.courseId] })],
);

export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    examPolicyId: uuid('exam_policy_id')
      .notNull()
      .references(() => examPolicies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleSnapshot: varchar('role_snapshot', { length: 64 }).notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    score: integer('score').notNull(),
    passed: boolean('passed').notNull(),
    threshold: integer('threshold').notNull(),
    duration: integer('duration'),
    answers: jsonb('answers').notNull(),
    details: jsonb('details').notNull(),
    questionRefs: jsonb('question_refs').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('exam_attempts_policy_user_idx').on(table.examPolicyId, table.userId)],
);

export const hostApiKeys = pgTable('host_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  keyId: varchar('key_id', { length: 128 }).notNull().unique(),
  secretHash: text('secret_hash').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  allowedOrigins: jsonb('allowed_origins'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

export const enterpriseTableNames = [
  'roles',
  'users',
  'invite_codes',
  'course_categories',
  'courses',
  'course_visibility_roles',
  'course_scenes',
  'course_outlines',
  'media_files',
  'course_audio_blobs',
  'course_progress',
  'assessment_attempts',
  'exam_policies',
  'exam_policy_courses',
  'exam_attempts',
  'host_api_keys',
] as const;

export type EnterpriseTableName = (typeof enterpriseTableNames)[number];
