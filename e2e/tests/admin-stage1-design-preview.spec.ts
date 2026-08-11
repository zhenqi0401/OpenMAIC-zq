import { expect, test } from '../fixtures/base';

const modules = ['dashboard', 'courses', 'exams', 'community', 'access'] as const;
const viewports = [
  { name: 'desktop-wide', width: 1920, height: 1080 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-compact', width: 1280, height: 800 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        identity: {
          userId: 'admin-preview',
          roleId: 'role-admin',
          roleCode: 'admin',
          isAdmin: true,
          authSource: 'password',
        },
        user: {
          id: 'admin-preview',
          displayName: '视觉验收管理员',
          role: { name: '管理员', code: 'admin' },
        },
      }),
    }),
  );
});

test('stage 1 samples keep the responsive shell and page patterns stable', async ({ page }) => {
  test.setTimeout(300_000);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const module of modules) {
      await page.goto(`/admin?module=${module}&designPreview=1`);
      await expect(page.locator(`[data-admin-design-preview="${module}"]`)).toBeVisible();
      await expect(page.locator('[data-brand-lockup]:visible').first()).toBeVisible();
      await expect(page.getByText('阶段 1 静态布局样例')).toBeVisible();
      await expect(page.getByText(/SaaS Admin|Management Portal|hbc/)).toHaveCount(0);
      await expect(page.getByText('新建课程', { exact: true })).toHaveCount(0);
      await expect(page.getByText('添加用户', { exact: true })).toHaveCount(0);

      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBeLessThanOrEqual(1);

      if (viewport.width >= 992) {
        await expect(page.locator('[data-admin-sider]')).toBeVisible();
        const sidebarWidth = await page
          .locator('[data-admin-sider]')
          .evaluate((element) => element.getBoundingClientRect().width);
        // 未折叠时为 260px 侧栏（antd Layout.Sider）
        expect(Math.round(sidebarWidth)).toBe(260);
      } else {
        // <992px：侧栏收起为 0，antd Sider 提供 zero-width trigger 展开导航
        await expect(page.locator('[data-admin-sider]')).toBeHidden();
        await expect(page.locator('.ant-layout-sider-zero-width-trigger')).toBeVisible();
      }

      // 截图仅作为验收产物；字体加载或动画在 CI/dev 下不稳定时不阻塞断言
      await page
        .screenshot({
          animations: 'disabled',
          fullPage: true,
          path: `/tmp/yuanwo-admin-stage1/${viewport.name}-${module}.png`,
        })
        .catch(() => undefined);
    }
  }
});
