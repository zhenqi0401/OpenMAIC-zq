import type { Page, Route } from '@playwright/test';
import { expect, test } from '../fixtures/base';

const courseId = 'course-danmaku-e2e';

function json(route: Route, payload: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
}

async function installDanmakuPlayerApi(page: Page) {
  let sentBody: Record<string, unknown> | null = null;

  await page.route('**/api/auth/session', (route) =>
    json(route, {
      authenticated: true,
      identity: {
        userId: 'learner-danmaku',
        roleId: 'role-sales',
        roleCode: 'sales',
        isAdmin: false,
        authSource: 'password',
      },
    }),
  );
  await page.route(`**/api/courses/${courseId}`, (route) =>
    json(route, {
      success: true,
      content: {
        course: {
          id: courseId,
          name: '弹幕布局验收课',
          description: 'E2E',
          generationComplete: true,
        },
        stage: {
          id: courseId,
          name: '弹幕布局验收课',
          createdAt: 1,
          updatedAt: 1,
        },
        scenes: [
          {
            id: 'scene-danmaku-1',
            stageId: courseId,
            type: 'slide',
            title: '弹幕布局验收',
            order: 0,
            content: {
              type: 'slide',
              canvas: {
                id: 'slide-danmaku-1',
                viewportSize: 1000,
                viewportRatio: 0.5625,
                theme: {
                  backgroundColor: '#ffffff',
                  themeColors: ['#7c3aed'],
                  fontColor: '#111827',
                  fontName: 'Microsoft Yahei',
                },
                elements: [
                  {
                    type: 'text',
                    id: 'title-danmaku-1',
                    content: '弹幕布局验收',
                    left: 80,
                    top: 80,
                    width: 840,
                    height: 120,
                  },
                ],
              },
            },
            actions: [
              {
                id: 'action-danmaku-1',
                type: 'speech',
                agent: 'teacher',
                text: '这是一段用于检查弹幕输入栏布局的讲解。',
              },
            ],
          },
        ],
        outlines: [],
      },
    }),
  );
  await page.route(`**/api/courses/${courseId}/danmaku**`, async (route) => {
    if (route.request().method() === 'POST') {
      sentBody = route.request().postDataJSON() as Record<string, unknown>;
      return json(
        route,
        {
          success: true,
          danmaku: {
            id: 'danmaku-e2e-1',
            ...sentBody,
            createdAt: '2026-07-20T00:00:00.000Z',
          },
        },
        201,
      );
    }
    return json(route, { success: true, danmaku: [], nextCursor: null });
  });
  await page.route(`**/api/courses/${courseId}/start`, (route) => json(route, { success: true }));

  return {
    getSentBody: () => sentBody,
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'zh-CN');
    localStorage.removeItem('openmaic-danmaku-enabled');
  });
});

test('moves danmaku controls out of the canvas and follows presentation auto-hide', async ({
  page,
}) => {
  const api = await installDanmakuPlayerApi(page);
  await page.goto(`/classroom/${courseId}`);

  const composer = page.getByTestId('danmaku-composer');
  const input = page.getByLabel('弹幕内容');
  await expect(composer).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭弹幕' })).toBeVisible();
  await expect(page.getByTestId('danmaku-overlay')).toBeAttached();
  await expect
    .poll(() =>
      composer.evaluate((element) => element.closest('[data-testid="danmaku-overlay"]') === null),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await input.fill('布局测试弹幕');
  await page.getByRole('button', { name: '发送' }).click();
  await expect.poll(() => api.getSentBody()?.content).toBe('布局测试弹幕');
  await expect(input).toHaveValue('');

  await page.getByRole('button', { name: '关闭弹幕' }).click();
  await expect(page.getByTestId('danmaku-composer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开启弹幕' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('openmaic-danmaku-enabled')))
    .toBe('false');
  await page.getByRole('button', { name: '开启弹幕' }).click();

  const fullscreenButton = page.getByRole('button', { name: '全屏' });
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await fullscreenButton.click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await expect(page.getByTestId('danmaku-composer')).toBeVisible();
    await expect(page.getByTestId('danmaku-composer')).toBeHidden({ timeout: 5_000 });

    await page.mouse.move(300, 220);
    await expect(page.getByTestId('danmaku-composer')).toBeVisible();
    await page.getByLabel('弹幕内容').focus();
    await page.waitForTimeout(3_300);
    await expect(page.getByTestId('danmaku-composer')).toBeVisible();
  }
});

test('keeps the composer inside a phone viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installDanmakuPlayerApi(page);
  await page.goto(`/classroom/${courseId}`);

  const composer = page.getByTestId('danmaku-composer');
  await expect(composer).toBeVisible();
  const box = await composer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  await page.getByLabel('弹幕内容').fill('手机端弹幕');
  await expect(page.getByLabel('弹幕内容')).toHaveValue('手机端弹幕');
  await expect(page.getByRole('button', { name: '关闭弹幕' })).toBeVisible();
});
