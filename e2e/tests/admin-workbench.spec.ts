import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';

async function expectAdminDangerButton(button: Locator) {
  const styles = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      opacity: computed.opacity,
    };
  });
  expect(styles).toEqual({
    backgroundColor: 'rgb(186, 26, 26)',
    color: 'rgb(255, 255, 255)',
    opacity: '1',
  });
  await expect(button).toBeEnabled();
}

async function expectAdminSecondaryButton(button: Locator) {
  const styles = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { backgroundColor: computed.backgroundColor, opacity: computed.opacity };
  });
  expect(styles).toEqual({ backgroundColor: 'rgb(255, 255, 255)', opacity: '1' });
  await expect(button).toBeEnabled();
}

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
        body: JSON.stringify({
          users,
          pagination: { page: 1, pageSize: 20, total: users.length, totalPages: 1 },
        }),
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
  actionOffsetMs: 65_000,
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
    listUrls?: string[];
  } = {},
) {
  let listRequests = 0;
  const items = options.items ?? [communityItem];
  await page.route('**/api/admin/community?**', async (route) => {
    listRequests += 1;
    options.listUrls?.push(route.request().url());
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
  await expect(page.getByRole('tab', { name: '帖子' })).toHaveAttribute('data-state', 'active');
  await page.getByRole('tab', { name: '弹幕' }).click();
  await expect(page.locator('[data-community-danmaku-list]').first()).toContainText(
    '这是一条需要审核的课程弹幕',
  );
}

async function mockAdminModuleReadApis(page: Page, requestUrls: string[] = []) {
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const { pathname } = requestUrl;
    if (request.method() !== 'GET') return route.fallback();
    requestUrls.push(requestUrl.toString());

    const payloads: Record<string, unknown> = {
      '/api/admin/dashboard': {
        summary: {
          courseCompletionRate: 0,
          examPassRate: null,
          learnerCount: 0,
          activeCourseCount: 0,
          examAttemptCount: 0,
        },
        communityActivity: {
          totals: { interactions: 20, posts: 3, replies: 7, danmaku: 10 },
          points: [
            { date: '2026-07-21', interactions: 4, posts: 1, replies: 1, danmaku: 2 },
            { date: '2026-07-22', interactions: 7, posts: 1, replies: 2, danmaku: 4 },
            { date: '2026-07-23', interactions: 9, posts: 1, replies: 4, danmaku: 4 },
          ],
        },
        pending: { total: 0, items: [] },
      },
      '/api/admin/roles': { roles },
      '/api/admin/invite-codes': { inviteCodes },
      '/api/admin/users': {
        users,
        pagination: { page: 1, pageSize: 20, total: users.length, totalPages: 1 },
      },
      '/api/admin/categories': { categories: [] },
      '/api/admin/courses': {
        courses: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
      },
      '/api/admin/courses/previews': { previews: {} },
      '/api/admin/exam-policies': {
        examPolicies: [],
        summary: {
          publishedCourseCount: 0,
          readyCourseCount: 0,
          missingQuestionCourseCount: 0,
          examAttemptCount: 0,
          passRate: null,
          averageScore: null,
        },
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      },
      '/api/admin/community/summary': {
        summary: {
          posts: { count: 0, changeRate: null },
          replies: { count: 0, changeRate: null },
          moderationActions: { count: 0, changeRate: null },
        },
      },
      '/api/admin/community': {
        success: true,
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
    };
    if (!(pathname in payloads)) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payloads[pathname]),
    });
  });
}

test.describe('P0 overall acceptance', () => {
  test('loads all five modules without page-level overflow at desktop acceptance sizes', async ({
    page,
  }) => {
    await mockAdminModuleReadApis(page);
    const modules = [
      { id: 'dashboard', heading: '数据看板' },
      { id: 'courses', heading: '课程管理' },
      { id: 'exams', heading: '阶段考核' },
      { id: 'community', heading: '社区内容' },
      { id: 'access', heading: '用户管理' },
    ];

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const adminModule of modules) {
        await page.goto(`/admin?module=${adminModule.id}`);
        await expect(page.getByRole('heading', { name: adminModule.heading })).toBeVisible();
        await expect(page.locator('[data-admin-refresh-button]')).toHaveCount(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
    }
  });
});

test.describe('course administration interactions', () => {
  test('keeps the page and sticky navigation in place when opening course actions', async ({
    page,
  }) => {
    const courses = Array.from({ length: 9 }, (_, index) => ({
      id: `course-${index + 1}`,
      name: `课程 ${index + 1}`,
      description: `用于验证滚动位置的课程 ${index + 1}`,
      categoryId: 'category-training',
      categoryName: '培训课程',
      status: index % 2 === 0 ? 'draft' : 'published',
      visibilityMode: 'all',
      visibleRoleIds: [],
      assessmentQuestions: [],
      learnerCount: index,
      generationStatus: 'ready',
      generationComplete: true,
      publishedAt: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));

    await page.route('**/api/admin/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const payloads: Record<string, unknown> = {
        '/api/admin/roles': { roles },
        '/api/admin/categories': {
          categories: [{ id: 'category-training', name: '培训课程', sortOrder: 0 }],
        },
        '/api/admin/courses': {
          courses,
          pagination: { page: 1, pageSize: 12, total: courses.length, totalPages: 1 },
        },
        '/api/admin/courses/previews': { previews: {} },
      };
      if (!(pathname in payloads)) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payloads[pathname]),
      });
    });

    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto('/admin?module=courses');
    await expect(page.getByRole('heading', { name: '课程管理' })).toBeVisible();
    const trigger = page.getByRole('button', { name: '课程 9的更多操作' });
    await trigger.scrollIntoViewIfNeeded();

    const before = await page.evaluate(() => ({
      scrollY: window.scrollY,
      sidebarTop:
        document.querySelector('[data-admin-sidebar]')?.getBoundingClientRect().top ?? null,
    }));
    expect(before.scrollY).toBeGreaterThan(0);

    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();

    const after = await page.evaluate(() => ({
      scrollY: window.scrollY,
      sidebarTop:
        document.querySelector('[data-admin-sidebar]')?.getBoundingClientRect().top ?? null,
      scrollLocked: document.body.hasAttribute('data-scroll-locked'),
    }));
    expect(after.scrollY).toBe(before.scrollY);
    expect(after.sidebarTop).toBe(before.sidebarTop);
    expect(after.scrollLocked).toBe(false);
  });
});

test.describe('dashboard activity chart', () => {
  test('renders SVG series, exposes precise keyboard tooltips and keeps period API parameters', async ({
    page,
  }) => {
    const requestUrls: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
    await mockAdminModuleReadApis(page, requestUrls);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?module=dashboard');

    const chart = page.locator('[data-admin-activity-chart-canvas]');
    await expect(chart.locator('svg')).toBeVisible();
    await expect(page.locator('[data-admin-community-chart]')).toContainText('总互动');
    await expect(page.locator('[data-admin-community-chart]')).toContainText('20');
    expect(await chart.locator('svg path').count()).toBeGreaterThanOrEqual(4);
    expect(await chart.locator('svg linearGradient').count()).toBeGreaterThan(0);
    await expect(chart.locator('svg path[fill^="var(--admin-chart-"]')).toHaveCount(0);

    const chartBox = await chart.boundingBox();
    if (!chartBox) throw new Error('社区活跃趋势图未生成可交互区域');
    await page.mouse.move(chartBox.x + chartBox.width / 2, chartBox.y + chartBox.height / 2);
    await expect(chart.locator('svg path[fill^="var(--admin-chart-"]')).toHaveCount(4);
    await page.getByRole('heading', { name: '社区活跃趋势' }).hover();
    await expect(chart.locator('svg path[fill^="var(--admin-chart-"]')).toHaveCount(0);

    await chart.focus();
    await chart.press('ArrowRight');
    await expect(chart.locator('div').filter({ hasText: '2026-07-22' }).last()).toBeVisible();
    await expect(chart.locator('div').filter({ hasText: '总互动' }).last()).toContainText('7');
    await expect(chart.locator('svg path[fill^="var(--admin-chart-"]')).toHaveCount(4);

    const postsLegend = page.locator('[data-admin-activity-legend="posts"]');
    await postsLegend.hover();
    await expect
      .poll(() =>
        chart
          .locator('svg path[stroke="var(--admin-chart-posts)"]')
          .first()
          .evaluate((element) => getComputedStyle(element).strokeOpacity),
      )
      .toBe('1');
    await expect
      .poll(() =>
        chart
          .locator('svg path[stroke="var(--admin-chart-interactions)"]')
          .first()
          .evaluate((element) => getComputedStyle(element).strokeOpacity),
      )
      .toBe('0.16');
    await page.getByRole('heading', { name: '社区活跃趋势' }).hover();
    await expect
      .poll(() =>
        chart
          .locator('svg path[stroke="var(--admin-chart-interactions)"]')
          .first()
          .evaluate((element) => getComputedStyle(element).strokeOpacity),
      )
      .toBe('1');

    await page.getByRole('button', { name: '周', exact: true }).click();
    await expect
      .poll(() =>
        requestUrls.some((url) => {
          const parsed = new URL(url);
          return (
            parsed.pathname === '/api/admin/dashboard' &&
            parsed.searchParams.get('range') === 'week'
          );
        }),
      )
      .toBe(true);
    await expect.poll(() => pageErrors).toEqual([]);
    await expect(page.getByRole('button', { name: '周', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const yearButton = page.getByRole('button', { name: '年', exact: true });
    await expect(yearButton).toBeEnabled();
    await yearButton.click();
    await expect
      .poll(() =>
        requestUrls.some((url) => {
          const parsed = new URL(url);
          return (
            parsed.pathname === '/api/admin/dashboard' &&
            parsed.searchParams.get('range') === 'year'
          );
        }),
      )
      .toBe(true);
  });
});

test.describe('exam workbench filters', () => {
  test('switches status immediately but submits name and role drafts explicitly', async ({
    page,
  }) => {
    const requestUrls: string[] = [];
    await mockAdminModuleReadApis(page, requestUrls);
    await page.goto('/admin?module=exams');
    await expect(page.getByRole('heading', { name: '阶段考核' })).toBeVisible();
    await expect(page.getByText('题库准备度')).toBeVisible();
    await expect(page.getByText('全局考核平均指标')).toBeVisible();
    await expect(page.getByLabel('通过率 暂无记录')).toContainText('—');
    await expect(page.locator('[data-exam-policy-status-bar]')).not.toContainText('待审核');
    await expect(page.getByText(/共 \d+ 项/)).toHaveCount(0);

    const examRequests = () =>
      requestUrls.filter((url) => new URL(url).pathname === '/api/admin/exam-policies');
    const initialCount = examRequests().length;
    await page.getByLabel('搜索考核').fill('销售考核');
    await page.getByLabel('筛选目标角色').selectOption('role-learner');
    expect(examRequests()).toHaveLength(initialCount);

    await page.getByRole('button', { name: '已发布', exact: true }).click();
    await expect.poll(() => examRequests().length).toBeGreaterThan(initialCount);
    expect(new URL(examRequests().at(-1)!).searchParams.get('status')).toBe('published');

    const afterStatusCount = examRequests().length;
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await expect.poll(() => examRequests().length).toBeGreaterThan(afterStatusCount);
    const filteredUrl = new URL(examRequests().at(-1)!);
    expect(filteredUrl.searchParams.get('q')).toBe('销售考核');
    expect(filteredUrl.searchParams.get('targetRoleId')).toBe('role-learner');
    expect(filteredUrl.searchParams.get('status')).toBe('published');

    await page.getByRole('button', { name: '清除筛选', exact: true }).click();
    await expect.poll(() => examRequests().length).toBeGreaterThan(afterStatusCount + 1);
    const clearedUrl = new URL(examRequests().at(-1)!);
    expect(clearedUrl.searchParams.has('q')).toBe(false);
    expect(clearedUrl.searchParams.has('targetRoleId')).toBe(false);
    expect(clearedUrl.searchParams.get('status')).toBe('all');
  });
});

test.describe('P0-03 access workbench', () => {
  test('keeps the invitation workspace free of internal horizontal scrolling at 1920x900', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await mockAccessApis(page);
    await openAccess(page, 'invites');

    expect(
      await page
        .getByRole('tablist', { name: '用户管理工作区' })
        .evaluate((element) => getComputedStyle(element).borderBottomWidth),
    ).toBe('0px');

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
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockAccessApis(page, revokedRequests);
    await openAccess(page);

    const activeUserTab = page.getByRole('tab', { name: /^用户，/, selected: true });
    await expect(activeUserTab).toBeVisible();
    await expect(activeUserTab).toHaveAttribute('aria-selected', 'true');

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
    await usersWorkspace.getByRole('button', { name: '张三的账号操作' }).click();
    await page.getByRole('menuitem', { name: '永久删除' }).click();
    await expect(page.getByRole('heading', { name: '永久删除用户' })).toBeVisible();
    await expectAdminDangerButton(page.getByRole('button', { name: '确认永久删除' }));
    await expectAdminSecondaryButton(page.getByRole('button', { name: '取消' }));
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
    await expect(page.getByText(/当前页面生命周期内显示并允许复制明文/)).toBeVisible();
    await page.getByLabel('邀请码明文').fill('OPEN-CODE-2026');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(invitesWorkspace.getByText('OPEN-CODE-2026').first()).toBeVisible();
    await invitesWorkspace
      .getByRole('button', { name: '复制邀请码 OPEN-CODE-2026' })
      .first()
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('OPEN-CODE-2026');

    await page.reload();
    await expect(page.locator('[data-admin-access-workspace="invites"]')).toBeVisible();
    await expect(page.getByText('OPEN-CODE-2026')).toHaveCount(0);
    await expect(page.getByText('仅创建时可见').first()).toBeVisible();

    const refreshedInvitesWorkspace = page.locator('[data-admin-access-workspace="invites"]');
    await refreshedInvitesWorkspace.getByRole('button', { name: '编辑' }).first().click();
    await expect(page.getByRole('heading', { name: '编辑邀请码' })).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();

    await refreshedInvitesWorkspace.getByRole('button', { name: '撤销' }).click();
    await expect(page.getByRole('heading', { name: '撤销邀请码' })).toBeVisible();
    const revokeConfirm = page.getByRole('button', { name: '确认撤销' });
    await expectAdminDangerButton(revokeConfirm);
    await expectAdminSecondaryButton(page.getByRole('button', { name: '取消' }));
    await revokeConfirm.click();
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
  test('keeps five filter groups as drafts until the administrator clicks 筛选', async ({
    page,
  }) => {
    const listUrls: string[] = [];
    const getListRequests = await mockCommunityApis(page, { listUrls });
    await openCommunity(page);
    const initialRequests = getListRequests();

    await page.getByLabel('关键词').fill('课程重点');
    await page.getByLabel('作者用户 ID').fill('learner-1');
    await page.getByLabel('课程 ID').fill('course-1');
    await page.getByLabel('内容状态').selectOption('hidden');
    await page.getByRole('button', { name: '选择日期范围' }).click();
    await page.getByLabel('开始时间').fill('2026-07-01T00:00');
    await page.getByLabel('结束时间').fill('2026-07-23T23:59');

    expect(getListRequests()).toBe(initialRequests);
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await expect.poll(getListRequests).toBeGreaterThan(initialRequests);
    const appliedUrl = new URL(listUrls.at(-1)!);
    expect(appliedUrl.searchParams.get('keyword')).toBe('课程重点');
    expect(appliedUrl.searchParams.get('authorId')).toBe('learner-1');
    expect(appliedUrl.searchParams.get('courseId')).toBe('course-1');
    expect(appliedUrl.searchParams.get('status')).toBe('hidden');
    expect(appliedUrl.searchParams.get('from')).toBe(new Date('2026-07-01T00:00').toISOString());
    expect(appliedUrl.searchParams.get('to')).toBe(new Date('2026-07-23T23:59').toISOString());

    await page.getByRole('button', { name: '清空', exact: true }).click();
    await expect.poll(getListRequests).toBeGreaterThan(initialRequests + 1);
    const clearedUrl = new URL(listUrls.at(-1)!);
    expect(clearedUrl.searchParams.has('keyword')).toBe(false);
    expect(clearedUrl.searchParams.has('authorId')).toBe(false);
    expect(clearedUrl.searchParams.has('courseId')).toBe(false);
    expect(clearedUrl.searchParams.has('status')).toBe(false);
    expect(clearedUrl.searchParams.has('from')).toBe(false);
    expect(clearedUrl.searchParams.has('to')).toBe(false);
  });

  test('uses a semantic table on desktop and field cards on mobile without tab dividers', async ({
    page,
  }) => {
    await mockCommunityApis(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCommunity(page);

    await expect(page.locator('[data-community-danmaku-table]')).toBeVisible();
    await expect(page.locator('[data-community-danmaku-cards]')).toBeHidden();
    await expect(page.getByRole('columnheader', { name: '播放时间点' })).toBeVisible();
    await expect(page.locator('[data-community-danmaku-list]')).toContainText('01:05');
    expect(
      await page
        .getByRole('tablist', { name: '社区内容类型' })
        .evaluate((element) => getComputedStyle(element).borderBottomWidth),
    ).toBe('0px');
    await expect(page.getByRole('tablist', { name: '社区内容类型' }).getByRole('tab')).toHaveText([
      '帖子',
      '回复',
      '弹幕',
      '操作审计',
    ]);
    const buttonHeights = await Promise.all([
      page
        .getByRole('button', { name: '下架' })
        .first()
        .evaluate((element) => element.clientHeight),
      page
        .getByRole('button', { name: '删除', exact: true })
        .first()
        .evaluate((element) => element.clientHeight),
    ]);
    expect(buttonHeights[0]).toBe(buttonHeights[1]);
    await page.getByRole('button', { name: '删除', exact: true }).click();
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByRole('heading', { name: '确认删除' })).toBeVisible();
    await expectAdminDangerButton(deleteDialog.getByRole('button', { name: '确认删除' }));
    await expectAdminSecondaryButton(deleteDialog.getByRole('button', { name: '取消' }));
    await deleteDialog.getByRole('button', { name: '取消' }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-community-danmaku-table]')).toBeHidden();
    await expect(page.locator('[data-community-danmaku-cards]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test('keeps tabs, filters, content and pagination in one ordered community workbench', async ({
    page,
  }) => {
    await mockCommunityApis(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCommunity(page);

    const workbench = page.locator('[data-community-workbench]');
    await expect(workbench).toBeVisible();
    await expect(workbench.getByRole('tablist', { name: '社区内容类型' })).toBeVisible();
    await expect(workbench.locator('[data-community-filters]')).toBeVisible();
    await expect(workbench.locator('[data-community-content]')).toBeVisible();
    await expect(workbench.locator('[data-admin-pagination]')).toBeVisible();

    const positions = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN;
      return {
        metric: top('[data-admin-metric-card]'),
        tabs: top('[data-community-workbench] [role="tablist"]'),
        filters: top('[data-community-filters]'),
        content: top('[data-community-content]'),
        pagination: top('[data-community-workbench] [data-admin-pagination]'),
      };
    });
    expect(positions.metric).toBeLessThan(positions.tabs);
    expect(positions.tabs).toBeLessThan(positions.filters);
    expect(positions.filters).toBeLessThan(positions.content);
    expect(positions.content).toBeLessThan(positions.pagination);
  });

  test('shows post moderation type, empty reason and moderator, then uses tables for replies and audit', async ({
    page,
  }) => {
    await mockCommunityApis(page, {
      items: [
        {
          ...communityItem,
          id: 'post-1',
          title: '需要复核的帖子',
          body: '帖子正文',
          action: 'lock',
          reason: null,
          moderator: { id: 'admin-1', displayName: '系统管理员' },
        },
      ],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?module=community');

    const moderation = page.locator('[data-community-post-moderation]');
    await expect(moderation).toContainText('操作类型：关闭回复');
    await expect(moderation).toContainText('操作原因：未填写');
    await expect(moderation).toContainText('操作人：系统管理员');

    await page.getByRole('tab', { name: '回复' }).click();
    await expect(page.locator('[data-community-reply-table]')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '回复内容' })).toBeVisible();

    await page.getByRole('tab', { name: '操作审计' }).click();
    await expect(page.locator('[data-community-audit-table]')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '操作原因' })).toBeVisible();
  });

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

    await page.getByRole('button', { name: '下架' }).last().click();
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

    await expect(page.locator('[data-community-danmaku-list]')).toContainText('正常');
    await expect(page.getByText('场景 ID：scene-internal-1')).toBeHidden();
    await page.getByRole('button', { name: '下架' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '确认下架' })).toBeVisible();
    await expect(dialog).toContainText('这是一条需要审核的课程弹幕');
    await dialog.getByRole('button', { name: '确认下架' }).click();
    await expect(dialog).toContainText('请选择原因，或填写补充说明。');

    await dialog.getByLabel('广告营销').check();
    await dialog.getByLabel('补充说明').fill('重复发布');
    await dialog.getByRole('button', { name: '确认下架' }).click();
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

    await page.getByRole('button', { name: '下架' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('其他').check();
    await dialog.getByLabel('补充说明').fill('需要人工复核的具体原因');
    await dialog.getByRole('button', { name: '确认下架' }).click();

    await expect(dialog).toContainText('审核服务暂时不可用');
    await expect(dialog.getByLabel('补充说明')).toHaveValue('需要人工复核的具体原因');
    await expect(page.locator('[data-community-danmaku-list]')).toContainText(
      '这是一条需要审核的课程弹幕',
    );
  });
});
