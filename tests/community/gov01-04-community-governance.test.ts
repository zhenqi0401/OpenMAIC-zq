import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import {
  CommunityGovernanceError,
  COMMUNITY_MODERATION_REASON_MAX_LENGTH,
  normalizeCommunityText,
  normalizeModerationReason,
  type CommunityRateLimiter,
} from '@/lib/community/governance';
import { createForumService, type ForumPost, type ForumRepository } from '@/lib/community/forum';
import { parseCommunityAdminFilters } from '@/lib/community/community-admin';
import type { EnterpriseRepository } from '@/lib/storage/enterprise-service';
import { communityModerationAudit, communityRateLimits } from '@/lib/storage/schema';

const now = new Date('2026-07-15T09:00:00.000Z');
const author = { id: 'user-1', displayName: 'User', roleCode: 'learner', roleName: 'Learner' };

function post(patch: Partial<ForumPost> = {}): ForumPost {
  return {
    id: 'post-1',
    authorId: 'user-1',
    scope: 'global',
    courseId: null,
    courseName: null,
    title: 'Title',
    body: 'Body',
    status: 'visible',
    pinned: false,
    locked: false,
    replyCount: 0,
    lastActivityAt: now,
    deletedAt: null,
    moderatedBy: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt: now,
    updatedAt: now,
    author,
    ...patch,
  };
}

function forumSetup(rateLimiter: CommunityRateLimiter) {
  const repository: ForumRepository = {
    listPosts: vi.fn(async () => ({ items: [], total: 0 })),
    getPost: vi.fn(async () => post()),
    createPost: vi.fn(async (input) => post(input)),
    updateOwnPost: vi.fn(async (input) => post(input)),
    deleteOwnPost: vi.fn(async () => post({ status: 'deleted_by_author' })),
    listReplies: vi.fn(async () => ({ items: [], total: 0, rootTotal: 0 })),
    getReply: vi.fn(async () => null),
    createReply: vi.fn(async () => {
      throw new Error('not used');
    }),
    updateOwnReply: vi.fn(async () => null),
    deleteOwnReply: vi.fn(async () => null),
    moderatePost: vi.fn(async () => post()),
    moderateReply: vi.fn(async () => null),
  };
  const courses = {
    getCourseContent: vi.fn(async () => null),
  } as unknown as Pick<EnterpriseRepository, 'getCourseContent'>;
  return { repository, service: createForumService(repository, courses, rateLimiter) };
}

describe('GOV-01 server-side rate and length governance', () => {
  test('routes normalized post content through the dedicated post limiter before persistence', async () => {
    const rateLimiter: CommunityRateLimiter = { consume: vi.fn(async () => undefined) };
    const { repository, service } = forumSetup(rateLimiter);

    await service.createPost({
      authorId: 'user-1',
      roleId: 'role-1',
      scope: 'global',
      title: '  标题\r\n ',
      body: ' 正文\t内容 ',
    });

    expect(rateLimiter.consume).toHaveBeenCalledWith({
      actorId: 'user-1',
      actionKind: 'forum_post',
      content: '标题\n正文 内容',
    });
    expect(repository.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ title: '标题', body: '正文 内容' }),
    );
  });

  test('maps a shared limiter rejection to the forum RATE_LIMITED contract', async () => {
    const rateLimiter: CommunityRateLimiter = {
      consume: vi.fn(async () => {
        throw new CommunityGovernanceError('RATE_LIMITED', 'slow down');
      }),
    };
    const { service, repository } = forumSetup(rateLimiter);
    await expect(
      service.createPost({
        authorId: 'user-1',
        roleId: 'role-1',
        scope: 'global',
        title: 'Title',
        body: 'Body',
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(repository.createPost).not.toHaveBeenCalled();
  });
});

describe('GOV-02 plain-text normalization and XSS protection', () => {
  test('normalizes Unicode, line endings and tabs', () => {
    expect(normalizeCommunityText('  Cafe\u0301\r\nA\tB  ', 'body', 100)).toBe('Café\nA B');
  });

  test.each([
    '<script>alert(1)</script>',
    '[click](javascript:alert(1))',
    '<iframe src="https://example.com"></iframe>',
    'safe\u202etxt',
  ])('rejects unsafe stored content: %s', (value) => {
    expect(() => normalizeCommunityText(value, 'body', 1_000)).toThrow(CommunityGovernanceError);
  });

  test('bounds and normalizes moderation reasons', () => {
    expect(normalizeModerationReason('  spam\r\nreason  ')).toBe('spam\nreason');
    expect(() =>
      normalizeModerationReason('x'.repeat(COMMUNITY_MODERATION_REASON_MAX_LENGTH + 1)),
    ).toThrow(CommunityGovernanceError);
  });
});

describe('GOV-03 management filters and GOV-04 audit persistence', () => {
  test('parses bounded common management filters', () => {
    const filters = parseCommunityAdminFilters(
      new URLSearchParams({
        type: 'replies',
        keyword: ' help ',
        authorId: 'user-1',
        courseId: 'course-1',
        status: 'hidden',
        page: '2',
        pageSize: '25',
        from: '2026-07-01T00:00:00.000Z',
      }),
    );
    expect(filters).toMatchObject({
      type: 'replies',
      keyword: 'help',
      authorId: 'user-1',
      courseId: 'course-1',
      status: 'hidden',
      page: 2,
      pageSize: 25,
    });
    expect(filters.from?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  test('declares persistent limiter and append-only moderation audit tables and migration', () => {
    expect(communityRateLimits.actionKind.name).toBe('action_kind');
    expect(communityModerationAudit.moderatorId.name).toBe('moderator_id');
    expect(communityModerationAudit.targetType.name).toBe('target_type');
    expect(communityModerationAudit.action.name).toBe('action');
    expect(communityModerationAudit.reason.name).toBe('reason');
    expect(communityModerationAudit.createdAt.name).toBe('created_at');

    const migration = fs.readFileSync(
      path.join(process.cwd(), 'drizzle/0006_community_governance.sql'),
      'utf8',
    );
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "community_rate_limits"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "community_moderation_audit"');
    expect(migration).toContain('"moderator_id" uuid NOT NULL');
    expect(migration).toContain('"reason" text');
    expect(migration).toContain('"created_at" timestamp with time zone');
  });

  test('binds raw rate-limit CASE timestamps through the column encoder', () => {
    const implementation = fs.readFileSync(
      path.join(process.cwd(), 'lib/community/governance.ts'),
      'utf8',
    );

    expect(implementation).toContain('sql.param(now, communityRateLimits.windowStartedAt)');
    expect(implementation).toMatch(
      /sql\.param\(\s*windowBoundary,\s*communityRateLimits\.windowStartedAt,?\s*\)/,
    );
    expect(implementation).not.toMatch(
      /windowStartedAt: sql`case when .* <= \$\{windowBoundary\} then \$\{now\}/,
    );
  });

  test('rejects invalid management pagination and content types', () => {
    expect(() => parseCommunityAdminFilters(new URLSearchParams({ type: 'unknown' }))).toThrow();
    expect(() => parseCommunityAdminFilters(new URLSearchParams({ pageSize: '51' }))).toThrow();
  });
});
