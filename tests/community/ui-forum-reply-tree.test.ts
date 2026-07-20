import { describe, expect, test } from 'vitest';

import { buildForumReplyTree, type ForumClientReply } from '@/lib/community/forum-client';

const author = {
  id: 'user-1',
  displayName: 'User',
  roleCode: 'learner',
  roleName: 'Learner',
};

function reply(id: string, parentReplyId: string | null, depth: number): ForumClientReply {
  return {
    id,
    postId: 'post-1',
    authorId: 'user-1',
    parentReplyId,
    depth,
    body: id,
    status: 'visible',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    author,
  };
}

describe('UI-FOR five-level reply tree', () => {
  test('keeps replies to the same parent as siblings on the same level', () => {
    const roots = buildForumReplyTree([
      reply('root', null, 1),
      reply('child-a', 'root', 2),
      reply('child-b', 'root', 2),
      reply('grandchild', 'child-a', 3),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0].children.map(({ id, depth }) => ({ id, depth }))).toEqual([
      { id: 'child-a', depth: 2 },
      { id: 'child-b', depth: 2 },
    ]);
    expect(roots[0].children[0].children[0]).toMatchObject({
      id: 'grandchild',
      parentReplyId: 'child-a',
      depth: 3,
    });
  });

  test('does not promote a malformed or orphaned child to a root', () => {
    const roots = buildForumReplyTree([
      reply('root', null, 1),
      reply('wrong-depth', 'root', 4),
      reply('orphan', 'missing', 2),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0].children).toEqual([]);
  });
});
