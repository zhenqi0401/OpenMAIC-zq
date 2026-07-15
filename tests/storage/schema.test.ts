import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, test } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';

import * as schema from '@/lib/storage/schema';

const migrationSql = readFileSync(
  resolve(__dirname, '../../drizzle/0000_slice_00_foundation.sql'),
  'utf8',
);

const change01MigrationSql = readFileSync(
  resolve(__dirname, '../../drizzle/0001_change_01_course_storage.sql'),
  'utf8',
);

const communityPopularityMigrationSql = readFileSync(
  resolve(__dirname, '../../drizzle/0003_community_course_popularity.sql'),
  'utf8',
);

const seedSql = readFileSync(resolve(__dirname, '../../drizzle/seed.sql'), 'utf8');

describe('Slice-00 database foundation SQL', () => {
  test('exports every enterprise foundation table as Drizzle schema', () => {
    expect(getTableName(schema.roles)).toBe('roles');
    expect(getTableName(schema.users)).toBe('users');
    expect(getTableName(schema.inviteCodes)).toBe('invite_codes');
    expect(getTableName(schema.courseCategories)).toBe('course_categories');
    expect(getTableName(schema.courses)).toBe('courses');
    expect(getTableName(schema.courseVisibilityRoles)).toBe('course_visibility_roles');
    expect(getTableName(schema.courseScenes)).toBe('course_scenes');
    expect(getTableName(schema.courseOutlines)).toBe('course_outlines');
    expect(getTableName(schema.mediaFiles)).toBe('media_files');
    expect(getTableName(schema.courseAudioBlobs)).toBe('course_audio_blobs');
    expect(getTableName(schema.courseProgress)).toBe('course_progress');
    expect(getTableName(schema.assessmentAttempts)).toBe('assessment_attempts');
    expect(getTableName(schema.examPolicies)).toBe('exam_policies');
    expect(getTableName(schema.examPolicyCourses)).toBe('exam_policy_courses');
    expect(getTableName(schema.examAttempts)).toBe('exam_attempts');
    expect(getTableName(schema.hostApiKeys)).toBe('host_api_keys');
    expect(getTableColumns(schema.courseProgress)).toMatchObject({
      startedAt: expect.any(Object),
      lastViewedAt: expect.any(Object),
    });
  });

  test('creates every enterprise foundation table', () => {
    for (const table of schema.enterpriseTableNames) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  test('stores course media blobs in PostgreSQL without OSS columns', () => {
    expect(migrationSql).toContain('"stage_snapshot" jsonb');
    expect(migrationSql).toContain('"generation_status" varchar(32) DEFAULT \'draft\' NOT NULL');
    expect(migrationSql).toContain('"generation_complete" boolean DEFAULT false NOT NULL');
    expect(migrationSql).toContain('CREATE TABLE "course_scenes"');
    expect(migrationSql).toContain('CREATE TABLE "course_outlines"');
    expect(migrationSql).toContain('CREATE TABLE "course_audio_blobs"');
    expect(migrationSql).toContain('"media_id" varchar(128) NOT NULL');
    expect(migrationSql).toContain('"blob" bytea NOT NULL');
    expect(migrationSql).toContain('"poster_blob" bytea');
    expect(migrationSql).toContain('"audio_id" varchar(128) NOT NULL');
    expect(migrationSql).not.toContain('"oss_key"');
    expect(migrationSql).not.toContain('"poster_oss_key"');
    expect(migrationSql).toContain('"size_bytes" integer');
  });

  test('ships an incremental migration for existing PostgreSQL databases', () => {
    expect(change01MigrationSql).toContain(
      'ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "stage_snapshot"',
    );
    expect(change01MigrationSql).toContain('CREATE TABLE IF NOT EXISTS "course_scenes"');
    expect(change01MigrationSql).toContain('CREATE TABLE IF NOT EXISTS "course_outlines"');
    expect(change01MigrationSql).toContain('CREATE TABLE IF NOT EXISTS "course_audio_blobs"');
    expect(change01MigrationSql).toContain(
      'ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "blob" bytea',
    );
    expect(change01MigrationSql).toContain(
      'ALTER TABLE "media_files" ALTER COLUMN "oss_key" DROP NOT NULL',
    );
    expect(change01MigrationSql).toContain(
      'ALTER TABLE "media_files" ALTER COLUMN "poster_oss_key" DROP NOT NULL',
    );
    expect(change01MigrationSql).not.toContain('ADD COLUMN IF NOT EXISTS "oss_key"');
    expect(change01MigrationSql).not.toContain('ADD COLUMN IF NOT EXISTS "poster_oss_key"');
  });

  test('backfills course start timestamps and adds the popularity aggregation index', () => {
    expect(communityPopularityMigrationSql).toContain('"started_at" timestamp with time zone');
    expect(communityPopularityMigrationSql).toContain(
      'COALESCE("started_at", "completed_at", "updated_at")',
    );
    expect(communityPopularityMigrationSql).toContain(
      '"last_viewed_at" = COALESCE("last_viewed_at", "updated_at"',
    );
    expect(communityPopularityMigrationSql).toContain(
      'CREATE INDEX IF NOT EXISTS "course_progress_course_id_idx"',
    );
  });

  test('seeds default administrator and learner roles idempotently', () => {
    expect(seedSql).toContain("'admin'");
    expect(seedSql).toContain("'learner'");
    expect(seedSql).toContain('ON CONFLICT');
  });
});
