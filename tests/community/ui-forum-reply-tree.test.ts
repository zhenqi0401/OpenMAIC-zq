import { readFileSync } from 'node:fs';
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

  test('keeps post composition in a responsive Ant Design drawer form', () => {
    const source = readFileSync('components/forum/ForumListPage.tsx', 'utf8');

    expect(source).toContain('<Drawer');
    expect(source).toContain('Math.min(560, document.body.clientWidth)');
    expect(source).toContain('width={composerWidth}');
    expect(source).toContain("maxWidth: '100%'");
    expect(source).toContain('padding: composerWidth < 576 ? 16 : 24');
    expect(source).toContain('id="forum-compose-form"');
    expect(source).toContain('form="forum-compose-form"');
    expect(source).toContain('showSearch');
    expect(source).toContain('autoSize={{ minRows: 6, maxRows: 12 }}');
    expect(source).not.toContain('选择讨论范围，并用清晰的标题和正文描述');
    expect(source).toContain('name="scope"\n              className="mb-5"');
    expect(source).not.toContain('{composing && (\n          <Form');
  });
});
