import { expect, test } from '../fixtures/base';

test.beforeEach(async ({ page }) => {
  let authenticated = false;

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        authenticated
          ? {
              authenticated: true,
              identity: {
                userId: 'learner-e2e',
                roleId: 'role-learner',
                roleCode: 'learner',
                isAdmin: false,
                authSource: 'password',
              },
            }
          : { authenticated: false },
      ),
    }),
  );

  await page.route('**/api/auth/login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
});

test('renders the desktop story/form split and completes login loading state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByText('让每一次学习都有记录')).toBeVisible();
  const columns = await page
    .locator('main[data-auth-page="login"]')
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean),
    );
  expect(columns).toHaveLength(2);

  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('请输入手机号')).toBeVisible();
  await expect(page.getByText('请输入密码')).toBeVisible();

  await page.getByLabel('手机号').fill('13800138000');
  await page.getByLabel('密码', { exact: true }).fill('password-123');
  await page.getByRole('button', { name: '登录', exact: true }).click();

  const loadingButton = page.getByRole('button', { name: '正在验证账号' });
  await expect(loadingButton).toBeDisabled();
  await expect(page).toHaveURL('/');
});

test('uses a mobile single column and maps register API errors to the invite field', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        errorCode: 'INVALID_REQUEST',
        error: 'INVITE_CODE_EXPIRED',
      }),
    }),
  );
  await page.goto('/register');

  await expect(page.getByRole('heading', { name: '注册账号' })).toBeVisible();
  // 左侧品牌故事栏在移动端单列下隐藏（"用邀请码加入学习空间"等文案已下线）
  await expect(page.locator('main[data-auth-page="register"] > aside')).toBeHidden();
  const columns = await page
    .locator('main[data-auth-page="register"]')
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean),
    );
  expect(columns).toHaveLength(1);

  await page.getByRole('button', { name: '创建账号', exact: true }).click();
  await expect(page.getByText('请输入姓名')).toBeVisible();
  await expect(page.getByText('请输入企业邀请码')).toBeVisible();

  await page.getByLabel('姓名').fill('张三');
  await page.getByLabel('手机号').fill('13800138000');
  await page.getByLabel('密码', { exact: true }).fill('password-123');
  await page.getByLabel('邀请码').fill('learn-2026');
  await expect(page.getByLabel('邀请码')).toHaveValue('LEARN-2026');
  await page.getByRole('button', { name: '创建账号', exact: true }).click();
  await expect(page.getByText('邀请码已过期，请联系企业管理员')).toBeVisible();
  await expect(page.getByRole('button', { name: '创建账号', exact: true })).toBeEnabled();

  await page.getByRole('link', { name: '直接登录' }).click();
  await expect(page).toHaveURL('/login', { timeout: 20_000 });
  await page.getByRole('link', { name: '创建员工账号' }).click();
  await expect(page).toHaveURL('/register', { timeout: 20_000 });
});
