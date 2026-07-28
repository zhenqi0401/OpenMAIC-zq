import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/base';
import { createSettingsStorage } from '../fixtures/test-data/settings';
import { defaultTheme } from '../fixtures/test-data/scene-content';
import { ClassroomPage } from '../pages/classroom.page';

const STAGE_ID = 'e2e-slide-layout-guard';
const SETTINGS_STORAGE = createSettingsStorage({ sidebarCollapsed: false });

async function seedGuardFixtures(page: Page) {
  await page.addInitScript((settings) => {
    localStorage.setItem('settings-storage', settings);
    localStorage.setItem('locale', 'en-US');
  }, SETTINGS_STORAGE);
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.evaluate(
    ({ stageId, theme }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('MAIC-Database');
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const tx = db.transaction(['stages', 'scenes', 'stageOutlines'], 'readwrite');
          const now = Date.now();
          tx.objectStore('stages').put({
            id: stageId,
            name: '幻灯片布局守卫回归',
            description: '',
            language: 'zh-CN',
            style: 'professional',
            createdAt: now,
            updatedAt: now,
          });

          const canvas = {
            id: 'layout-guard-slide',
            viewportSize: 1000,
            viewportRatio: 0.5625,
            theme,
            elements: [
              {
                id: 'card-background',
                type: 'shape',
                left: 80,
                top: 80,
                width: 420,
                height: 220,
                path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
                viewBox: [1, 1],
                fill: '#2563eb',
                fixedRatio: false,
                rotate: 0,
              },
              {
                id: 'card-text',
                type: 'text',
                left: 100,
                top: 100,
                width: 380,
                height: 180,
                content:
                  '<p style="font-size: 20px; line-height: 1.5; color: white">运行时布局守卫会保留完整中文内容，并在确定安全时扩高文字框与背景卡片。</p><p style="font-size: 18px; color: white">缩放后的课堂画布和缩略图继续使用同一组最终几何数据。</p>',
                defaultFontName: 'Microsoft YaHei',
                defaultColor: '#ffffff',
                lineHeight: 1.5,
                paragraphSpace: 5,
                rotate: 0,
              },
            ],
          };
          tx.objectStore('scenes').put({
            id: 'layout-scene',
            stageId,
            type: 'slide',
            title: '已安全修复的卡片',
            order: 0,
            content: { type: 'slide', canvas },
            actions: [
              {
                id: 'spotlight-repaired-text',
                type: 'spotlight',
                elementId: 'card-text',
                dimOpacity: 0.5,
              },
            ],
            createdAt: now,
            updatedAt: now,
          });
          tx.objectStore('stageOutlines').put({
            stageId,
            outlines: [],
            createdAt: now,
            updatedAt: now,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { stageId: STAGE_ID, theme: defaultTheme },
  );
}

async function renderedGeometry(page: Page) {
  return page.evaluate(() => {
    const background = document.querySelector<HTMLElement>('#screen-element-card-background');
    const text = document.querySelector<HTMLElement>('#screen-element-card-text');
    const backgroundContent = background?.querySelector<HTMLElement>('.element-content');
    const textBox = text?.querySelector<HTMLElement>('.base-element-text');
    const textContent = text?.querySelector<HTMLElement>('.element-content');
    const scaleLayer = text?.parentElement;
    const canvas = scaleLayer?.parentElement;
    if (!backgroundContent || !textBox || !textContent || !canvas) return null;

    const backgroundRect = backgroundContent.getBoundingClientRect();
    const textBoxRect = textBox.getBoundingClientRect();
    const textContentRect = textContent.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      backgroundHeight: backgroundRect.height,
      textBoxHeight: textBoxRect.height,
      textContentBottom: textContentRect.bottom,
      textBoxBottom: textBoxRect.bottom,
      canvasBottom: canvasRect.bottom,
      canvasRatio: canvasRect.width / canvasRect.height,
    };
  });
}

test.describe('generated slide layout guard rendering', () => {
  test('renders repaired geometry proportionally at desktop and compact classroom sizes', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await seedGuardFixtures(page);

    const classroom = new ClassroomPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await classroom.goto(STAGE_ID);
    await classroom.waitForLoaded();
    await expect(page.locator('#screen-element-card-text .base-element-text')).toBeVisible();

    const desktop = await renderedGeometry(page);
    expect(desktop).not.toBeNull();
    expect(desktop!.textContentBottom).toBeLessThanOrEqual(desktop!.textBoxBottom + 1);
    expect(desktop!.textBoxBottom).toBeLessThanOrEqual(desktop!.canvasBottom + 1);
    expect(desktop!.backgroundHeight / desktop!.textBoxHeight).toBeCloseTo(220 / 180, 2);
    expect(desktop!.canvasRatio).toBeCloseTo(16 / 9, 2);

    await page.setViewportSize({ width: 900, height: 650 });
    await expect.poll(() => renderedGeometry(page)).not.toEqual(desktop);
    const compact = await renderedGeometry(page);
    expect(compact).not.toBeNull();
    expect(compact!.textContentBottom).toBeLessThanOrEqual(compact!.textBoxBottom + 1);
    expect(compact!.textBoxBottom).toBeLessThanOrEqual(compact!.canvasBottom + 1);
    expect(compact!.backgroundHeight / compact!.textBoxHeight).toBeCloseTo(220 / 180, 2);
    expect(compact!.canvasRatio).toBeCloseTo(16 / 9, 2);
    expect(compact!.textBoxHeight).toBeLessThan(desktop!.textBoxHeight);

    await page.getByRole('switch', { name: 'Edit course' }).click();
    await expect(page.getByTestId('slide-nav-rail')).toBeVisible();
    await page.locator('[aria-label="Spotlight"]').first().hover();
    await expect(page.locator('svg mask[id="mask-card-text"]')).toHaveCount(1);
    expect(consoleErrors).toEqual([]);
  });
});
