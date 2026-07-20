import type { Page, Route } from '@playwright/test';
import { expect, test } from '../fixtures/base';

const now = '2026-07-15T09:00:00.000Z';
const learner = {
  userId: 'learner-a',
  roleId: 'role-sales',
  roleCode: 'sales',
  isAdmin: false,
  authSource: 'password',
};
const admin = {
  userId: 'admin-1',
  roleId: 'role-admin',
  roleCode: 'admin',
  isAdmin: true,
  authSource: 'password',
};

function author(id: string, name: string, roleName: string) {
  return { id, displayName: name, roleCode: id.startsWith('admin') ? 'admin' : 'sales', roleName };
}

async function installCommunityApi(page: Page) {
  let identity = learner;
  let courseAccess = true;
  let post = {
    id: 'post-qa',
    authorId: learner.userId,
    scope: 'course' as const,
    courseId: 'course-1',
    courseName: '门店安全课',
    title: '历史讨论',
    body: '已有课程讨论',
    status: 'visible' as const,
    pinned: false,
    locked: false,
    replyCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    author: author(learner.userId, '学员 A', '销售学员'),
  };
  const replies: Array<Record<string, unknown>> = [];

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, identity }),
    }),
  );
  await page.route('**/api/courses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ courses: [{ id: 'course-1', name: '门店安全课' }] }),
    }),
  );
  await page.route('**/api/forum/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/forum/posts' && method === 'GET') {
      return json(route, { items: [post], total: 21, page: 1, pageSize: 10 });
    }
    if (path === '/api/forum/posts' && method === 'POST') {
      const input = request.postDataJSON() as { title: string; body: string };
      post = { ...post, title: input.title, body: input.body };
      return json(route, { post }, 201);
    }
    if (path === '/api/forum/posts/post-qa' && method === 'GET') {
      if (!courseAccess && !identity.isAdmin) return json(route, { error: 'Not found' }, 404);
      return json(route, { post });
    }
    if (path === '/api/forum/posts/post-qa/replies' && method === 'GET') {
      return json(route, {
        items: replies,
        total: replies.length,
        rootTotal: replies.filter((reply) => reply.parentReplyId === null).length,
      });
    }
    if (path === '/api/forum/posts/post-qa/replies' && method === 'POST') {
      const input = request.postDataJSON() as { body: string; parentReplyId: string | null };
      const parent = input.parentReplyId
        ? replies.find((reply) => reply.id === input.parentReplyId)
        : null;
      const depth = parent ? Number(parent.depth) + 1 : 1;
      if (depth > 5) return json(route, { error: '回复最多支持 5 层' }, 409);
      const reply = {
        id: `reply-${replies.length + 1}`,
        postId: post.id,
        authorId: identity.userId,
        parentReplyId: parent?.id ?? null,
        depth,
        body: input.body,
        status: 'visible',
        createdAt: now,
        updatedAt: now,
        author: author(
          identity.userId,
          identity.isAdmin ? '管理员' : '学员 A',
          identity.isAdmin ? '管理员' : '销售学员',
        ),
      };
      replies.push(reply);
      post = { ...post, replyCount: replies.length };
      return json(route, { reply }, 201);
    }
    return json(route, { error: `Unhandled ${method} ${path}` }, 500);
  });
  await page.route('**/api/admin/forum/posts/post-qa', async (route) => {
    const input = route.request().postDataJSON() as { action: string };
    post = { ...post, locked: input.action === 'lock' ? true : post.locked };
    return json(route, { post });
  });

  return {
    becomeAdmin: () => {
      identity = admin;
    },
    revokeCourseAccess: () => {
      identity = learner;
      courseAccess = false;
    },
  };
}

function json(route: Route, payload: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
}

test('course forum supports compose, pagination, reply, admin close, mobile and permission denial', async ({
  page,
}) => {
  const api = await installCommunityApi(page);
  await page.goto('/forum?view=course&courseId=course-1&compose=true');

  await expect(page.getByRole('heading', { name: '门店安全课 · 课程讨论' })).toBeVisible();
  await expect(page.getByLabel('关联课程')).toHaveValue('course-1');
  await expect(page.getByText('第 1 / 3 页')).toBeVisible();
  await page.getByLabel('标题').fill('学员 A 的课程问题');
  await page.getByLabel('正文').fill('如何在现场应用本节内容？');
  await page.getByRole('button', { name: '立即发布' }).click();

  await expect(page).toHaveURL(/\/forum\/posts\/post-qa$/);
  await expect(page.getByRole('heading', { name: '学员 A 的课程问题' })).toBeVisible();
  await page.getByLabel('回复内容').fill('同角色学员的第一层回复');
  await page.getByRole('button', { name: '发布回复' }).click();
  await expect(page.getByText('同角色学员的第一层回复')).toBeVisible();

  async function replyTo(parentText: string, body: string) {
    const parentArticle = page
      .getByText(parentText, { exact: true })
      .locator('xpath=ancestor::article[1]');
    const parentContent = parentArticle.locator(':scope > div').first();
    await parentContent.getByRole('button', { name: '回复', exact: true }).click();
    await parentContent.getByLabel('回复 学员 A').fill(body);
    await parentContent.getByRole('button', { name: '发布回复', exact: true }).click();
    await expect(page.getByText(body, { exact: true })).toBeVisible();
  }

  await replyTo('同角色学员的第一层回复', '第二层回复 A');
  await replyTo('第二层回复 A', '第三层回复');
  await replyTo('第三层回复', '第四层回复');
  await replyTo('第四层回复', '第五层回复');
  await replyTo('同角色学员的第一层回复', '第二层回复 B');

  const secondSibling = page
    .getByText('第二层回复 B', { exact: true })
    .locator('xpath=ancestor::article[1]');
  await expect(secondSibling.getByText('第 2 层', { exact: false })).toBeVisible();
  const fifthLevel = page
    .getByText('第五层回复', { exact: true })
    .locator('xpath=ancestor::article[1]');
  const fifthLevelContent = fifthLevel.locator(':scope > div').first();
  await expect(fifthLevelContent.getByText('已达到最多 5 层')).toBeVisible();
  await expect(fifthLevelContent.getByRole('button', { name: '回复', exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  api.becomeAdmin();
  await page.reload();
  page.once('dialog', (dialog) => dialog.accept('QA close regression'));
  await page.getByRole('button', { name: '关闭回复' }).click();
  await expect(page.getByText('该帖子已关闭，暂时不能新增回复。')).toBeVisible();
  await expect(page.getByLabel('回复内容')).toHaveCount(0);

  api.revokeCourseAccess();
  await page.reload();
  await expect(page.getByRole('heading', { name: '无法打开这个讨论' })).toBeVisible();
});
