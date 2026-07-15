import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { forumPosts, forumReplies } from '@/lib/storage/schema';

describe('FOR-01 forum data model', () => {
  test('registers separate post and one-level reply tables', () => {
    expect(forumPosts.id.name).toBe('id');
    expect(forumPosts.scope.name).toBe('scope');
    expect(forumPosts.courseId.name).toBe('course_id');
    expect(forumPosts.pinned.name).toBe('pinned');
    expect(forumPosts.locked.name).toBe('locked');
    expect(forumReplies.postId.name).toBe('post_id');
    expect(forumReplies).not.toHaveProperty('parentReplyId');
  });

  test('migration enforces scope, status, content and course deletion invariants', () => {
    const migration = readFileSync(
      path.join(process.cwd(), 'drizzle/0005_community_forum.sql'),
      'utf8',
    );
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "forum_posts"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "forum_replies"');
    expect(migration).toContain('"scope" = \'global\' AND "course_id" IS NULL');
    expect(migration).toContain('"status" = \'archived\'');
    expect(migration).toContain('ON DELETE set null');
    expect(migration).not.toContain('parent_reply_id');
  });
});
