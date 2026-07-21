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
  await expect(page.getByRole('heading', { name: '访问与角色' })).toBeVisible();
  await expect(page.locator(`[data-admin-access-workspace="${section}"]`)).toBeVisible();
}

test.describe('P0-03 access workbench', () => {
  test('keeps the invitation workspace free of internal horizontal scrolling at 1920x900', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await mockAccessApis(page);
    await openAccess(page, 'invites');

    const workspace = page.locator('[data-admin-access-invite-workspace]');
    await expect(workspace.locator('[data-admin-access-invite-table]')).toBeVisible();
    expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
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

    const usersWorkspace = page.locator('[data-admin-access-workspace="users"]');
    await expect(usersWorkspace).toContainText('138****8000');
    await expect(usersWorkspace).not.toContainText('13800138000');
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
