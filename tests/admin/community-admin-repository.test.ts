import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  selectDistinctOn: vi.fn(),
}));

vi.mock('@/lib/storage/db', () => ({
  getDb: () => ({ select: mocks.select, selectDistinctOn: mocks.selectDistinctOn }),
}));

import { CommunityAdminRepository } from '@/lib/community/community-admin';

function fluentQuery(resultMethod: 'offset' | 'orderBy' | 'where', result: unknown) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  for (const method of Object.values(query)) method.mockReturnValue(query);
  query[resultMethod].mockResolvedValue(result);
  return query;
}

const filters = {
  type: 'posts' as const,
  page: 1,
  pageSize: 20,
};

const postRow = {
  content: {
    id: 'post-1',
    title: '课程讨论',
    body: '帖子正文',
    status: 'hidden',
    createdAt: new Date('2026-07-23T08:00:00.000Z'),
  },
  author: { id: 'user-1', displayName: '张三' },
  role: { code: 'learner', name: '学员' },
  courseName: '入职课程',
};

describe('community admin post repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches the distinct latest post audit action, reason and moderator', async () => {
    const newest = {
      audit: {
        id: 'audit-new',
        targetId: 'post-1',
        action: 'restore',
        reason: null,
        createdAt: new Date('2026-07-23T10:00:00.000Z'),
      },
      moderator: { id: 'admin-2', displayName: '复核管理员' },
    };
    mocks.select
      .mockReturnValueOnce(fluentQuery('offset', [postRow]))
      .mockReturnValueOnce(fluentQuery('where', [{ value: 1 }]));
    mocks.selectDistinctOn.mockReturnValueOnce(fluentQuery('orderBy', [newest]));

    const result = await new CommunityAdminRepository().list(filters);

    expect(mocks.selectDistinctOn).toHaveBeenCalledOnce();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'post-1',
      action: 'restore',
      reason: null,
      moderator: { id: 'admin-2', displayName: '复核管理员' },
    });
  });

  it('leaves moderation fields absent when the post has no audit record', async () => {
    mocks.select
      .mockReturnValueOnce(fluentQuery('offset', [postRow]))
      .mockReturnValueOnce(fluentQuery('where', [{ value: 1 }]));
    mocks.selectDistinctOn.mockReturnValueOnce(fluentQuery('orderBy', []));

    const result = await new CommunityAdminRepository().list(filters);

    expect(result.items[0]).not.toHaveProperty('action');
    expect(result.items[0]).not.toHaveProperty('reason');
    expect(result.items[0]).not.toHaveProperty('moderator');
  });
});
