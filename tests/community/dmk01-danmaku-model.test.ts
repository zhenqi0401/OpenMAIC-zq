import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { getTableName } from 'drizzle-orm';

import { courseDanmaku } from '@/lib/storage/schema';

describe('DMK-01 danmaku model and migration', () => {
  test('exports the table with explicit lifecycle and audit fields', () => {
    expect(getTableName(courseDanmaku)).toBe('course_danmaku');
    expect(Object.keys(courseDanmaku)).toEqual(
      expect.arrayContaining([
        'courseId',
        'sceneKey',
        'actionId',
        'authorId',
        'status',
        'deletedAt',
        'moderatedBy',
        'moderationReason',
        'clientRequestId',
      ]),
    );
  });

  test('migration contains bounded-query indexes, checks, soft deletion and idempotency', () => {
    const sql = readFileSync('drizzle/0004_community_course_danmaku.sql', 'utf8');
    expect(sql).toContain('course_danmaku_course_scene_status_created_idx');
    expect(sql).toContain('course_danmaku_course_scene_action_idx');
    expect(sql).toContain('course_danmaku_author_created_idx');
    expect(sql).toContain('course_danmaku_author_course_request_idx');
    expect(sql).toContain('deleted_by_author');
    expect(sql).toContain('deleted_by_admin');
    expect(sql).toContain('CHECK (char_length(btrim("content")) BETWEEN 1 AND 200)');
    expect(sql).toContain(
      '"course_danmaku_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action',
    );
  });
});
