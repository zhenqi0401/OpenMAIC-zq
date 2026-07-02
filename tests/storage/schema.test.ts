import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, test } from 'vitest';
import { getTableName } from 'drizzle-orm';

import * as schema from '@/lib/storage/schema';

const migrationSql = readFileSync(
  resolve(__dirname, '../../drizzle/0000_slice_00_foundation.sql'),
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
    expect(getTableName(schema.scenes)).toBe('scenes');
    expect(getTableName(schema.outlines)).toBe('outlines');
    expect(getTableName(schema.mediaFiles)).toBe('media_files');
    expect(getTableName(schema.courseProgress)).toBe('course_progress');
    expect(getTableName(schema.assessmentAttempts)).toBe('assessment_attempts');
    expect(getTableName(schema.examPolicies)).toBe('exam_policies');
    expect(getTableName(schema.examPolicyCourses)).toBe('exam_policy_courses');
    expect(getTableName(schema.examAttempts)).toBe('exam_attempts');
    expect(getTableName(schema.hostApiKeys)).toBe('host_api_keys');
  });

  test('creates every enterprise foundation table', () => {
    for (const table of schema.enterpriseTableNames) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  test('keeps media blobs out of PostgreSQL', () => {
    expect(migrationSql).toContain('"oss_key" text NOT NULL');
    expect(migrationSql).not.toMatch(/\bBLOB\b|\bBYTEA\b/i);
  });

  test('seeds default administrator and learner roles idempotently', () => {
    expect(seedSql).toContain("'admin'");
    expect(seedSql).toContain("'learner'");
    expect(seedSql).toContain('ON CONFLICT');
  });
});
