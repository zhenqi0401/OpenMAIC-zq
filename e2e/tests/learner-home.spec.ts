import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';

const learnerIdentity = {
  userId: 'learner-e2e',
  tenantId: 'tenant-e2e',
  roleId: 'role-sales',
  roleCode: 'sales',
  isAdmin: false,
  authSource: 'password',
};

const adminIdentity = {
  ...learnerIdentity,
  userId: 'admin-e2e',
  roleId: 'role-admin',
  roleCode: 'admin',
  isAdmin: true,
  authSource: 'host-sso',
};

const courses = [
  {
    id: 'platform-new',
    name: '精品管理领导力',
    description: '面向管理者的精品课程',
    categoryId: 'category-platform-management',
    categoryName: '管理知识培训',
    scope: 'platform',
    learnerCount: 10,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    generationComplete: true,
  },
  {
    id: 'tenant-sales',
    name: 'ToB 销售实战',
    description: '客户沟通与商机推进',
    categoryId: 'category-tenant-tob-sales',
    categoryName: 'ToB销售培训',
    scope: 'tenant',
    learnerCount: 90,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    generationComplete: true,
  },
  {
    id: 'tenant-management',
    name: '企业管理知识基础',
    description: '管理制度与团队协作',
    categoryId: 'category-tenant-management',
    categoryName: '管理知识培训',
    scope: 'tenant',
    learnerCount: 90,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    generationComplete: true,
  },
  {
    id: 'platform-hot',
    name: '精品服务沟通课',
    description: '高热度平台课程',
    categoryId: 'category-platform-professional',
    categoryName: '专业知识培训',
    scope: 'platform',
    learnerCount: 220,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    generationComplete: true,
  },
];

const categories = [
  {
    id: 'category-platform-management',
    name: '管理知识培训',
    sortOrder: 10,
    scope: 'platform',
    categoryKey: 'management',
    isSystem: true,
  },
  {
    id: 'category-platform-professional',
    name: '专业知识培训',
    sortOrder: 20,
    scope: 'platform',
    categoryKey: 'professional',
    isSystem: true,
  },
  {
    id: 'category-tenant-management',
    name: '管理知识培训',
    sortOrder: 10,
    scope: 'tenant',
    categoryKey: 'management',
    isSystem: true,
  },
  {
    id: 'category-professional',
    name: '专业知识培训',
    sortOrder: 20,
    scope: 'tenant',
    categoryKey: 'professional',
    isSystem: true,
  },
  {
    id: 'category-tenant-tob-sales',
    name: 'ToB销售培训',
    sortOrder: 30,
    scope: 'tenant',
    categoryKey: 'tob-sales',
    isSystem: true,
  },
  {
    id: 'category-toc-sales',
    name: 'ToC销售培训',
    sortOrder: 40,
    scope: 'tenant',
    categoryKey: 'toc-sales',
    isSystem: true,
  },
  {
    id: 'category-policy',
    name: '公司制度培训',
    sortOrder: 50,
    scope: 'tenant',
    categoryKey: 'company-policy',
    isSystem: true,
  },
  {
    id: 'category-custom-onboarding',
    name: '新人训练专区',
    sortOrder: 60,
    scope: 'tenant',
    categoryKey: null,
    isSystem: false,
  },
];

const examPolicy = {
  id: 'exam-sales',
  title: '门店安全与服务规范',
  targetRoleId: 'role-sales',
  categoryIds: ['category-tenant-tob-sales'],
  courseIds: ['tenant-sales'],
  questionCount: 2,
  passThreshold: 80,
  timeLimitMinutes: 15,
  status: 'published',
};

async function mockLearnerApis(
  page: Page,
  options: {
    identity?: typeof learnerIdentity;
    exams?: (typeof examPolicy)[];
    failFirstExamList?: boolean;
    failFirstSubmit?: boolean;
  } = {},
) {
  let examListCount = 0;
  let attemptCount = 0;
  const identity = options.identity ?? learnerIdentity;
  const exams = options.exams ?? [examPolicy];

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        identity,
        user: { displayName: identity.isAdmin ? '管理员甲' : '张琪' },
      }),
    }),
  );
  await page.route('**/api/courses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, courses, categories }),
    }),
  );
  await page.route('**/api/courses/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, scenes: [] }),
    }),
  );
  await page.route('**/api/exams', (route) => {
    examListCount += 1;
    // React strict mode mounts effects twice in development. Keep both initial
    // requests failing so the page reaches its retry UI, then let the explicit
    // user retry succeed.
    if (options.failFirstExamList && examListCount <= 2) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '待办服务暂时不可用' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, exams }),
    });
  });
  await page.route('**/api/exams/exam-sales/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        exam: {
          policy: examPolicy,
          questions: [
            {
              id: 'q1',
              type: 'single',
              question: '发现地面积水时，第一步如何处理？',
              options: [
                { value: 'A', label: '等待巡场' },
                { value: 'B', label: '设置警示并安排清理' },
              ],
            },
            {
              id: 'q2',
              type: 'multiple',
              question: '交接班必须确认哪些内容？',
              options: [
                { value: 'A', label: '未处理异常' },
                { value: 'B', label: '重点设备状态' },
                { value: 'C', label: '天气情况' },
              ],
            },
          ],
          questionRefs: [
            { source: 'course_assessment', courseId: 'tenant-sales', questionId: 'q1' },
            { source: 'course_assessment', courseId: 'tenant-sales', questionId: 'q2' },
          ],
        },
      }),
    }),
  );
  await page.route('**/api/exams/exam-sales/attempts', (route) => {
    attemptCount += 1;
    if (options.failFirstSubmit && attemptCount === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: '网络繁忙，请重试' }),
      });
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        result: {
          attempt: {
            score: 100,
            passed: true,
            attemptNumber: 1,
            threshold: 80,
            duration: 18,
            details: [],
          },
        },
      }),
    });
  });
  await page.route('**/classroom/**', (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><main>课堂占位页</main></body></html>',
    });
  });
}

async function seedLocalCourse(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('MAIC-Database', 11);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('stages')) {
            const stages = database.createObjectStore('stages', { keyPath: 'id' });
            stages.createIndex('updatedAt', 'updatedAt');
          }
        };
        request.onsuccess = (event) => {
          const database = (event.target as IDBOpenDBRequest).result;
          try {
            const transaction = database.transaction(['stages'], 'readwrite');
            const now = Date.now();
            transaction.objectStore('stages').put({
              id: 'local-course-1',
              name: '不应出现的本地历史课程',
              description: '当前浏览器课程',
              createdAt: now,
              updatedAt: now,
            });
            transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          } catch (error) {
            database.close();
            reject(error);
          }
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

async function courseOrder(page: Page) {
  return page
    .locator('[data-course-id]')
    .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.courseId));
}

async function firstRowColumnCount(page: Page) {
  return page.getByTestId('learner-course-grid').evaluate((grid) => {
    const cards = Array.from(grid.children) as HTMLElement[];
    if (cards.length === 0) return 0;
    const firstTop = cards[0].getBoundingClientRect().top;
    return cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) <= 1)
      .length;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'zh-CN');
    localStorage.setItem('theme', 'light');
    localStorage.setItem(
      'user-profile-storage',
      JSON.stringify({
        state: { avatar: '/avatars/user.png', nickname: '张琪', bio: '' },
        version: 0,
      }),
    );
  });
});

test('uses a server-only scope catalogue with semantic whole-card links', async ({ page }) => {
  await mockLearnerApis(page, { exams: [] });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '课程中心' })).toBeVisible();

  await expect(page.getByRole('button', { name: /全部课程\s*4/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /精品课程\s*2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /企业课程\s*2/ })).toBeVisible();
  await expect(page.getByText('早上好，张琪')).toHaveCount(0);
  await expect(page.getByText('角色课程按当前权限更新')).toHaveCount(0);
  await expect(page.getByText(/当前显示 \d+ 门课程/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CN' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主题设置' }).locator('svg')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '退出登录' }).locator('svg')).toHaveCount(1);
  await expect(page.getByRole('link', { name: '进入管理后台' })).toHaveCount(0);
  await expect(page.getByText('待办事项')).toHaveCount(0);
  await expect(page.getByText('张琪', { exact: true })).toBeVisible();
  await expect(page.getByText('张', { exact: true })).toBeVisible();

  await seedLocalCourse(page);
  await page.reload();
  await expect(page.getByText('不应出现的本地历史课程')).toHaveCount(0);
  await expect(page.locator('[data-course-id]')).toHaveCount(4);

  await expect(page.locator('[data-course-scope="platform"]')).toHaveCount(2);
  await expect(page.locator('[data-course-scope="tenant"]')).toHaveCount(2);
  await expect(
    page.locator('[data-course-scope="platform"]').getByText('精品课程', { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.locator('[data-course-scope="tenant"]').getByText('精品课程', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('220 人已开始学习')).toBeVisible();

  const rootCard = page.getByRole('link', { name: '学习课程：精品管理领导力' });
  await expect(rootCard).toHaveAttribute('href', '/classroom/platform-new');

  await rootCard.locator('div').first().click();
  await expect(page).toHaveURL(/\/classroom\/platform-new$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '课程中心' })).toBeVisible();

  await page.getByRole('heading', { name: 'ToB 销售实战' }).click();
  await expect(page).toHaveURL(/\/classroom\/tenant-sales$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '课程中心' })).toBeVisible();

  await page
    .getByRole('link', { name: '学习课程：企业管理知识基础' })
    .click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL(/\/classroom\/tenant-management$/);
});

test('filters, searches, sorts, and isolates enterprise categories', async ({ page }) => {
  await mockLearnerApis(page, { exams: [] });
  await page.goto('/learn?category=management');

  await expect(page.getByRole('button', { name: /企业课程\s*2/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '管理知识培训' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('企业管理知识基础')).toBeVisible();
  await expect(page.getByText('精品管理领导力')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新人训练专区' })).toBeVisible();

  await page.getByRole('button', { name: /精品课程\s*2/ }).click();
  await expect(page).toHaveURL(/\/learn\?category=management$/);
  await expect(page.getByRole('button', { name: '管理知识培训' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '新人训练专区' })).toHaveCount(0);
  await expect(page.getByText('精品管理领导力')).toBeVisible();
  await expect(page.getByText('精品服务沟通课')).toHaveCount(0);
  await expect(page.getByText('企业管理知识基础')).toHaveCount(0);

  await page.getByRole('button', { name: /全部课程\s*4/ }).click();
  await page.getByRole('button', { name: '全部分类' }).click();
  expect(await courseOrder(page)).toEqual([
    'platform-new',
    'tenant-sales',
    'tenant-management',
    'platform-hot',
  ]);
  await page.getByRole('button', { name: '最热' }).click();
  expect(await courseOrder(page)).toEqual([
    'platform-hot',
    'tenant-sales',
    'tenant-management',
    'platform-new',
  ]);

  await page.getByRole('searchbox', { name: '搜索课程' }).fill('客户沟通');
  await expect(page.locator('[data-course-id]')).toHaveCount(1);
  await expect(page.getByText('ToB 销售实战')).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索课程' }).fill('');

  await page.getByRole('button', { name: /企业课程\s*2/ }).click();
  await page.getByRole('button', { name: 'ToB销售培训' }).click();
  await expect(page).toHaveURL(/\/learn\?category=tob-sales$/);
  await expect(page.locator('[data-course-id]')).toHaveCount(1);
  await expect(page.getByText('ToB 销售实战')).toBeVisible();
});

test('keeps invalid category links recoverable and uses learner mode for administrators', async ({
  page,
}) => {
  await mockLearnerApis(page, { identity: adminIdentity, exams: [] });
  await page.goto('/learn?category=not-a-system-category');

  await expect(page.getByText('指定的课程分类不存在或不可用')).toBeVisible();
  await page.getByRole('button', { name: '查看全部课程' }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole('link', { name: '进入管理后台' })).toBeVisible();
  await expect(page.getByRole('link', { name: '学习课程：精品管理领导力' })).toHaveAttribute(
    'href',
    '/classroom/platform-new?mode=learn',
  );
  await expect(page.getByRole('link', { name: '首页', exact: true })).toHaveAttribute(
    'href',
    '/learn',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn');
  await page.getByRole('button', { name: '打开用户菜单' }).click();
  expect(
    await page.getByRole('menuitem', { name: '主题' }).locator('svg').count(),
  ).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('menuitem', { name: '管理后台' }).locator('svg')).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: '退出' }).locator('svg')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.getByRole('heading', { name: '课程中心' })).toHaveCount(0);
});

test('shows only published server courses in the administrator root workbench', async ({
  page,
}) => {
  await mockLearnerApis(page, { identity: adminIdentity, exams: [] });
  await page.goto('/');
  await seedLocalCourse(page);
  await page.reload();

  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.getByText('精品管理领导力', { exact: true })).toBeVisible();
  await expect(page.getByText('ToB 销售实战', { exact: true })).toBeVisible();
  await expect(page.getByText('企业管理知识基础', { exact: true })).toBeVisible();
  await expect(page.getByText('精品服务沟通课', { exact: true })).toBeVisible();
  await expect(page.getByText('不应出现的本地历史课程')).toHaveCount(0);
});

test('shows a recoverable todo error, defaults open, collapses, and preserves the exam flow', async ({
  page,
}) => {
  await mockLearnerApis(page, { failFirstExamList: true, failFirstSubmit: true });
  await page.goto('/');

  await expect(page.getByText('考核任务加载失败')).toBeVisible();
  await expect(page.getByText('待办服务暂时不可用')).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  const todoToggle = page.getByRole('button', { name: /待办事项.*1/ });
  await expect(todoToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /进入考核/ })).toBeVisible();
  await todoToggle.click();
  await expect(todoToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: /进入考核/ })).toHaveCount(0);
  await todoToggle.click();

  await page.getByRole('button', { name: /进入考核/ }).click();
  await expect(page.getByRole('dialog')).toContainText('准备好后开始本次考核');
  await page.getByRole('button', { name: '开始答题' }).click();
  await page.getByLabel('B. 设置警示并安排清理').check();
  await page.getByRole('button', { name: '关闭考核' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('当前答案尚未提交');
  await page.getByRole('button', { name: '继续答题' }).click();
  await expect(page.getByLabel('B. 设置警示并安排清理')).toBeChecked();

  await page.getByLabel('A. 未处理异常').check();
  await page.getByLabel('B. 重点设备状态').check();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('alert')).toContainText('网络繁忙，请重试');
  await expect(page.getByLabel('B. 设置警示并安排清理')).toBeChecked();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: '考核通过' })).toBeVisible();
  await page.getByRole('button', { name: '完成并返回' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('keeps navigation, wrapped categories, cards, and dialogs responsive', async ({ page }) => {
  await mockLearnerApis(page);

  for (const [width, height, columns] of [
    [360, 800, 1],
    [390, 844, 1],
    [768, 1024, 2],
    [1024, 768, 3],
    [1440, 900, 3],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByTestId('learner-course-grid')).toBeVisible();
    await expect.poll(() => firstRowColumnCount(page)).toBe(columns);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);

    if (width < 768) {
      await expect(page.getByRole('link', { name: '首页', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: '交流' })).toBeVisible();
      await page.getByRole('button', { name: '打开用户菜单' }).click();
      await expect(page.getByRole('menuitem', { name: '主题' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: '退出' })).toBeVisible();
      await page.keyboard.press('Escape');
    }
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /企业课程\s*2/ }).click();
  const categoryRows = await page
    .getByRole('group', { name: '课程分类' })
    .getByRole('button')
    .evaluateAll(
      (buttons) =>
        new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
    );
  expect(categoryRows).toBeGreaterThan(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('learner-course-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: /待办事项.*1/ })).toBeVisible();
  await page
    .locator('nextjs-portal')
    .evaluateAll((portals) => portals.forEach((portal) => portal.setAttribute('hidden', '')));
  await page.screenshot({
    path: 'output/playwright/learner-home-catalog-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('learner-course-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: /待办事项.*1/ })).toBeVisible();
  await page
    .locator('nextjs-portal')
    .evaluateAll((portals) => portals.forEach((portal) => portal.setAttribute('hidden', '')));
  await page.screenshot({
    path: 'output/playwright/learner-home-catalog-mobile.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: '打开用户菜单' }).click();
  await page.getByRole('menuitem', { name: '主题' }).click();
  await page.getByRole('menuitem', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: '课程中心' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
});

test('keeps the exam dialog inside a phone viewport', async ({ page }) => {
  await mockLearnerApis(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /进入考核/ }).click();
  await page.getByRole('button', { name: '开始答题' }).click();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox?.width).toBeLessThanOrEqual(390);
  expect(dialogBox?.height).toBeLessThanOrEqual(844);
});
