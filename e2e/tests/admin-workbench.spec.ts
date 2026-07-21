import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';

const roles = [
  { id: 'role-admin', code: 'admin', name: '管理员', isAdmin: true },
  { id: 'role-learner', code: 'learner', name: '学员', isAdmin: false },
];

const users = [
  {
    id: 'user-1',
    phone: '13800138000',
    hostUserId: 'host-user-1',
    displayName: '张三',
    status: 'active',
    role: roles[1],
  },
];

const inviteCodes = [
  {
    id: 'invite-1',
    roleId: 'role-learner',
    enabled: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:00:00.000Z',
  },
];

async function mockAccessApis(page: Page, revokedRequests: string[] = []) {
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === 'GET' && pathname === '/api/admin/roles') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roles }),
      });
    }
    if (request.method() === 'GET' && pathname === '/api/admin/users') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users }),
      });
    }
    if (request.method() === 'GET' && pathname === '/api/admin/invite-codes') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inviteCodes }),
      });
    }
    if (request.method() === 'DELETE' && pathname === '/api/admin/invite-codes/invite-1') {
      revokedRequests.push(`${request.method()} ${pathname}`);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inviteCode: inviteCodes[0] }),
      });
    }
    if (pathname.startsWith('/api/admin/roles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ role: roles[0] }),
      });
    }
    if (pathname.startsWith('/api/admin/invite-codes')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inviteCode: inviteCodes[0] }),
      });
    }
    if (pathname.startsWith('/api/admin/users')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: users[0] }),
      });
    }
    return route.fallback();
  });
}

async function openAccess(page: Page, section: 'users' | 'roles' | 'invites' = 'users') {
  await page.goto(`/admin?module=access&section=${section}`);
  await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();
  await expect(page.locator(`[data-admin-access-workspace="${section}"]`)).toBeVisible();
}

const communityItem = {
  id: 'danmaku-1',
  status: 'visible',
  content: '这是一条需要审核的课程弹幕',
  courseId: 'course-1',
  courseName: '安全培训课',
  sceneKey: 'scene-internal-1',
  actionId: 'action-internal-1',
  createdAt: '2026-07-21T06:00:00.000Z',
  author: {
    id: 'learner-1',
    displayName: '测试学员',
    roleName: '学员',
    roleCode: 'learner',
  },
};

async function mockCommunityApis(
  page: Page,
  options: {
    failModeration?: boolean;
    items?: Array<typeof communityItem>;
    requests?: Array<{ path: string; body: unknown }>;
  } = {},
) {
  let listRequests = 0;
  const items = options.items ?? [communityItem];
  await page.route('**/api/admin/community?**', async (route) => {
    listRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items,
        total: items.length,
        page: 1,
        pageSize: 20,
      }),
    });
  });
  await page.route('**/api/admin/danmaku/danmaku-1', async (route) => {
    const request = route.request();
    options.requests?.push({
      path: new URL(request.url()).pathname,
      body: request.postDataJSON(),
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: options.failModeration ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        options.failModeration
          ? { success: false, error: '审核服务暂时不可用' }
          : { success: true, danmaku: { ...communityItem, status: 'hidden' } },
      ),
    });
  });
  return () => listRequests;
}

async function openCommunity(page: Page) {
  await page.goto('/admin?module=community');
  await expect(page.getByRole('heading', { name: '社区内容' })).toBeVisible();
  await expect(page.locator('[data-community-item-row]').first()).toContainText(
    '这是一条需要审核的课程弹幕',
  );
}

test.describe('P0-03 access workbench', () => {
  test('keeps the invitation workspace free of internal horizontal scrolling at 1920x900', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await mockAccessApis(page);
    await openAccess(page, 'invites');

    const workspace = page.locator('[data-admin-access-invite-workspace]');
    const inviteTable = workspace.locator('[data-admin-access-invite-table]');
    await expect(inviteTable).toBeVisible();
    expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const headerColumns = await inviteTable.locator('thead th').evaluateAll((cells) =>
      cells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
      }),
    );
    const dataColumns = await inviteTable
      .locator('tbody tr')
      .first()
      .locator('td')
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const rect = cell.getBoundingClientRect();
          return { left: rect.left, width: rect.width };
        }),
      );
    expect(dataColumns).toHaveLength(headerColumns.length);
    headerColumns.forEach((header, index) => {
      expect(Math.abs(header.left - dataColumns[index].left)).toBeLessThan(1);
      expect(Math.abs(header.width - dataColumns[index].width)).toBeLessThan(1);
    });
    await expect(workspace).not.toContainText('SALES-SECRET-2026');
  });

  test('does not create page-level horizontal scrolling at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockAccessApis(page);
    await openAccess(page, 'invites');

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test('switches all deep-linked tabs and opens and closes access operation dialogs at 1280x800', async ({
    page,
  }) => {
    const revokedRequests: string[] = [];
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockAccessApis(page, revokedRequests);
    await openAccess(page);

    const activeUserTabColors = await page
      .getByRole('tab', { name: /^用户，/, selected: true })
      .evaluate((tab) => {
        const style = window.getComputedStyle(tab);
        return { backgroundColor: style.backgroundColor, color: style.color };
      });
    expect(activeUserTabColors.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(activeUserTabColors.color).toBe('rgb(43, 33, 29)');

    const usersWorkspace = page.locator('[data-admin-access-workspace="users"]');
    await expect(usersWorkspace).toContainText('13800138000');
    await expect(usersWorkspace).not.toContainText('脱敏手机号');
    await expect(usersWorkspace).not.toContainText('危险操作');
    await expect(page.locator('[data-admin-current-identity]')).toContainText(
      '当前用户：E2E 管理员',
    );
    await expect(page.locator('[data-admin-current-identity]')).toContainText(
      '当前角色：管理员（admin）',
    );
    await usersWorkspace.getByRole('button', { name: '永久删除用户' }).click();
    await expect(page.getByRole('heading', { name: '永久删除用户' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();

    await page.getByRole('tab', { name: /^角色，/ }).click();
    await expect(page).toHaveURL(/module=access.*section=roles|section=roles.*module=access/);
    const rolesWorkspace = page.locator('[data-admin-access-workspace="roles"]');
    await expect(rolesWorkspace).toContainText('当前用户数');
    await rolesWorkspace.getByRole('button', { name: '编辑' }).first().click();
    await expect(page.getByRole('heading', { name: '编辑角色' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();

    await page.getByRole('tab', { name: /^邀请码，/ }).click();
    await expect(page).toHaveURL(/module=access.*section=invites|section=invites.*module=access/);
    const invitesWorkspace = page.locator('[data-admin-access-workspace="invites"]');
    await invitesWorkspace.getByRole('button', { name: '创建邀请码' }).click();
    await expect(page.getByRole('heading', { name: '创建邀请码' })).toBeVisible();
    await expect(page.getByText('邀请码明文创建后不会在列表中再次显示')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await invitesWorkspace.getByRole('button', { name: '编辑' }).first().click();
    await expect(page.getByRole('heading', { name: '编辑邀请码' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();

    await invitesWorkspace.getByRole('button', { name: '撤销' }).click();
    await expect(page.getByRole('heading', { name: '撤销邀请码' })).toBeVisible();
    await page.getByRole('button', { name: '确认撤销' }).click();
    await expect.poll(() => revokedRequests).toEqual(['DELETE /api/admin/invite-codes/invite-1']);
  });

  test('uses readable card layouts at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAccessApis(page);
    await openAccess(page);

    const userCards = page.locator('[data-admin-access-user-cards]');
    await expect(userCards).toBeVisible();
    await expect(page.locator('[data-admin-access-user-table]')).toBeHidden();
    const userCardsBox = await userCards.boundingBox();
    expect(userCardsBox).not.toBeNull();
    expect(userCardsBox!.x).toBeGreaterThanOrEqual(0);
    expect(userCardsBox!.x + userCardsBox!.width).toBeLessThanOrEqual(390);

    await page.getByRole('tab', { name: /^邀请码，/ }).click();
    const inviteCards = page.locator('[data-admin-access-invite-cards]');
    await expect(inviteCards).toBeVisible();
    await expect(page.locator('[data-admin-access-invite-table]')).toBeHidden();
    const inviteCardsBox = await inviteCards.boundingBox();
    expect(inviteCardsBox).not.toBeNull();
    expect(inviteCardsBox!.x).toBeGreaterThanOrEqual(0);
    expect(inviteCardsBox!.x + inviteCardsBox!.width).toBeLessThanOrEqual(390);
  });
});

test.describe('P0-07 community moderation', () => {
  test('keeps the page and sticky navigation in place when opening the hide dialog', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await mockCommunityApis(page, {
      items: Array.from({ length: 8 }, (_, index) => ({
        ...communityItem,
        id: `danmaku-${index + 1}`,
        content: index === 0 ? communityItem.content : `第 ${index + 1} 条需要审核的课程弹幕`,
      })),
    });
    await openCommunity(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const before = await page.evaluate(() => ({
      scrollY: window.scrollY,
      sidebarTop: document.querySelector('aside')?.getBoundingClientRect().top ?? null,
    }));
    expect(before.scrollY).toBeGreaterThan(0);

    await page.getByRole('button', { name: '隐藏' }).last().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const after = await page.evaluate(() => ({
      scrollY: window.scrollY,
      sidebarTop: document.querySelector('aside')?.getBoundingClientRect().top ?? null,
    }));
    expect(after.scrollY).toBe(before.scrollY);
    expect(after.sidebarTop).toBe(before.sidebarTop);
  });

  test('opens the moderation dialog, disables submission, sends the reason, and refreshes', async ({
    page,
  }) => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const getListRequests = await mockCommunityApis(page, { requests });
    await openCommunity(page);

    await expect(page.locator('[data-community-item-row]')).toContainText('可见');
    await expect(page.getByText('场景 ID：scene-internal-1')).toBeHidden();
    await page.getByRole('button', { name: '隐藏' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '确认隐藏' })).toBeVisible();
    await expect(dialog).toContainText('这是一条需要审核的课程弹幕');
    await dialog.getByRole('button', { name: '确认隐藏' }).click();
    await expect(dialog).toContainText('请选择原因，或填写补充说明。');

    await dialog.getByLabel('广告营销').check();
    await dialog.getByLabel('补充说明').fill('重复发布');
    await dialog.getByRole('button', { name: '确认隐藏' }).click();
    await expect(dialog.getByRole('button', { name: '处理中…' })).toBeDisabled();
    await expect(dialog).toBeHidden();
    await expect.poll(getListRequests).toBeGreaterThan(1);
    expect(requests).toEqual([
      {
        path: '/api/admin/danmaku/danmaku-1',
        body: { action: 'hide', reason: '广告营销：重复发布' },
      },
    ]);
  });

  test('keeps the dialog reason and the existing row when moderation fails', async ({ page }) => {
    await mockCommunityApis(page, { failModeration: true });
    await openCommunity(page);

    await page.getByRole('button', { name: '隐藏' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('其他').check();
    await dialog.getByLabel('补充说明').fill('需要人工复核的具体原因');
    await dialog.getByRole('button', { name: '确认隐藏' }).click();

    await expect(dialog).toContainText('审核服务暂时不可用');
    await expect(dialog.getByLabel('补充说明')).toHaveValue('需要人工复核的具体原因');
    await expect(page.locator('[data-community-item-row]')).toContainText(
      '这是一条需要审核的课程弹幕',
    );
  });
});
