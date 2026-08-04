import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('stage 2 admin repository contracts', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/admin/admin-data-repository.ts'), 'utf8');

  test('serializes administrator status changes and locks the target user', () => {
    expect(source).toMatch(
      /select\(\{ id: roles\.id \}\)[\s\S]*?eq\(roles\.isAdmin, true\)[\s\S]*?orderBy\(asc\(roles\.id\)\)[\s\S]*?for\('update'\)/,
    );
    expect(source).toMatch(
      /eq\(users\.id, input\.userId\)[\s\S]*?for\('update'\)[\s\S]*?if \(!record\)/,
    );
    expect(source).toMatch(
      /count\(\)[\s\S]*?eq\(users\.status, 'active'\)[\s\S]*?eq\(roles\.isAdmin, true\)/,
    );
  });

  test('reorders the exact complete category set inside one transaction', () => {
    expect(source).toMatch(
      /runDbTransaction<boolean>[\s\S]*?from\(courseCategories\)[\s\S]*?for\('update'\)/,
    );
    expect(source).toContain('categoryIds.length !== currentIds.size');
    expect(source).toContain('new Set(categoryIds).size !== categoryIds.length');
    expect(source).toContain('categoryIds.some((id) => !currentIds.has(id))');
    expect(source).toMatch(
      /for \(const \[sortOrder, id\] of categoryIds\.entries\(\)\)[\s\S]*?set\(\{ sortOrder, updatedAt: now \}\)/,
    );
  });

  test('checks course references before deleting a locked category', () => {
    expect(source).toMatch(
      /select\(\{ id: courseCategories\.id \}\)[\s\S]*?for\('update'\)[\s\S]*?from\(courses\)[\s\S]*?where\(eq\(courses\.categoryId, id\)\)/,
    );
    expect(source).toMatch(
      /if \(\(usage\?\.value \?\? 0\) > 0\) return 'in_use'[\s\S]*?delete\(courseCategories\)/,
    );
  });

  test('selects only slide scenes in deterministic first-slide order', () => {
    expect(source).toMatch(
      /eq\(courseScenes\.type, 'slide'\)[\s\S]*?orderBy\(asc\(courseScenes\.courseId\), asc\(courseScenes\.sceneOrder\), asc\(courseScenes\.id\)\)/,
    );
    expect(source).toContain('if (!firstByCourse.has(row.courseId))');
  });

  test('uses distinct participants and all attempts for exam aggregates', () => {
    expect(source).toContain('participantCount: countDistinct(examAttempts.userId)');
    expect(source).toContain('attemptCount: count()');
    expect(source).toMatch(/passedCount: sql<number>`count\(\*\) filter/);
    expect(source).toContain('averageScore: sql<string | null>`avg(${examAttempts.score})`');
  });

  test('limits moderation statistics to the confirmed management actions', () => {
    expect(source).toContain(
      "const moderationActions = ['hide', 'restore', 'delete', 'pin', 'unpin', 'lock', 'unlock']",
    );
    expect(source).toContain('inArray(communityModerationAudit.action, moderationActions)');
  });
});
