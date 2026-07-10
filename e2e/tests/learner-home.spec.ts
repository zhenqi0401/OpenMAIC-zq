import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';

const learnerIdentity = {
  userId: 'learner-e2e',
  roleId: 'role-sales',
  roleCode: 'sales',
  isAdmin: false,
  authSource: 'password',
};

const examPolicy = {
  id: 'exam-sales',
  title: '门店安全与服务规范',
  targetRoleId: 'role-sales',
  categoryIds: ['category-sales'],
  courseIds: ['enterprise-1'],
  questionCount: 2,
  passThreshold: 80,
  timeLimitMinutes: 15,
  status: 'published',
};

async function mockLearnerApis(page: Page) {
  let attemptCount = 0;

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, identity: learnerIdentity }),
    }),
  );
  await page.route('**/api/courses/enterprise-1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, scenes: [] }),
    }),
  );
  await page.route('**/api/courses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        courses: [
          {
            id: 'enterprise-1',
            name: '门店安全操作与突发事件应对',
            description: '岗位必修课程',
            createdAt: '2026-07-09T00:00:00.000Z',
            updatedAt: '2026-07-10T00:00:00.000Z',
            generationComplete: true,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/exams', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, exams: [examPolicy] }),
    }),
  );
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
            { source: 'course_assessment', courseId: 'enterprise-1', questionId: 'q1' },
            { source: 'course_assessment', courseId: 'enterprise-1', questionId: 'q2' },
          ],
        },
      }),
    }),
  );
  await page.route('**/api/exams/exam-sales/attempts', (route) => {
    attemptCount += 1;
    if (attemptCount === 1) {
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
}

async function seedLocalCourse(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('MAIC-Database');
        request.onsuccess = (event) => {
          const database = (event.target as IDBOpenDBRequest).result;
          const transaction = database.transaction(['stages'], 'readwrite');
          const now = Date.now();
          transaction.objectStore('stages').put({
            id: 'local-course-1',
            name: '本地服务话术练习课',
            description: '当前浏览器课程',
            createdAt: now,
            updatedAt: now,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockLearnerApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'zh-CN');
    localStorage.setItem(
      'user-profile-storage',
      JSON.stringify({
        state: { avatar: '/avatars/user.png', nickname: '张琪', bio: '' },
        version: 0,
      }),
    );
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '早上好，张琪' })).toBeVisible();
  await seedLocalCourse(page);
  await page.reload();
  await expect(page.getByText('本地服务话术练习课')).toBeVisible();
});

test('separates learner courses and completes the recoverable exam flow', async ({ page }) => {
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主题设置' })).toBeVisible();
  await expect(page.getByText('企业课程', { exact: true })).toBeVisible();
  await expect(page.getByText('本地导入', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /本地课程 1/ }).click();
  await expect(page.getByText('本地服务话术练习课')).toBeVisible();
  await expect(page.getByText('门店安全操作与突发事件应对')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /重命名本地服务话术练习课/ })).toBeVisible();

  await page.getByRole('button', { name: /全部 2/ }).click();
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
  await expect(page.getByLabel('A. 未处理异常')).toBeChecked();

  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: '考核通过' })).toBeVisible();
  await expect(page.getByText('100')).toBeVisible();
  await page.screenshot({ path: 'output/playwright/learner-home-result-desktop.png' });
  await page.getByRole('button', { name: '完成并返回' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/generation-preview');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '早上好，张琪' })).toBeVisible();
});

test('keeps the learner home and exam dialog within a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '早上好，张琪' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /进入考核/ }).click();
  await page.getByRole('button', { name: '开始答题' }).click();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox?.width).toBeLessThanOrEqual(390);
  expect(dialogBox?.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'output/playwright/learner-home-exam-mobile-production.png' });
});
