import { test, expect } from '../fixtures/base';
import type { Page } from '@playwright/test';
import { createSettingsStorage } from '../fixtures/test-data/settings';

const SETTINGS_STORAGE = createSettingsStorage({ sidebarCollapsed: false });

async function seedLegacyEnterpriseClassroom(page: Page) {
  await page.addInitScript((settings) => {
    localStorage.setItem('settings-storage', settings);
    sessionStorage.setItem(
      'generationParams',
      JSON.stringify({ generatedCourseId: 'course-stale' }),
    );
  }, SETTINGS_STORAGE);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('MAIC-Database');
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const tx = db.transaction(['stages', 'scenes', 'stageOutlines'], 'readwrite');
          const now = Date.now();
          tx.objectStore('stages').put({
            id: 'stage-current',
            serverCourseId: 'course-current',
            name: 'Assessment gate course',
            description: '',
            language: 'zh-CN',
            style: 'professional',
            createdAt: now,
            updatedAt: now,
          });
          tx.objectStore('scenes').put({
            id: 'scene-current',
            stageId: 'stage-current',
            type: 'slide',
            title: '课程正文',
            order: 1,
            content: { type: 'slide', canvas: { elements: [] } },
            actions: [],
            createdAt: now,
            updatedAt: now,
          });
          tx.objectStore('stageOutlines').put({
            stageId: 'stage-current',
            outlines: [{ id: 'outline-current', title: '课程正文', order: 1 }],
            generationComplete: true,
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
  );
}

test('legacy classroom opens its own assessment before course completion', async ({ page }) => {
  const requestedCourseIds: string[] = [];
  let assessmentRequestCount = 0;
  await page.route(/\/api\/(?:admin\/)?courses\/stage-current(?:\/content)?$/, (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' }),
  );
  await page.route(
    /\/api\/courses\/(course-current|course-stale)\/(progress|assessment)$/,
    async (route) => {
      const match = route
        .request()
        .url()
        .match(/courses\/(course-[^/]+)\/(progress|assessment)$/);
      const courseId = match?.[1] ?? '';
      const operation = match?.[2];
      requestedCourseIds.push(courseId);
      if (courseId !== 'course-current') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: '{"error":"Course not found"}',
        });
        return;
      }
      if (operation === 'assessment') assessmentRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          operation === 'progress'
            ? { success: true, progress: { completed: true } }
            : {
                success: true,
                assessment: {
                  courseId,
                  threshold: 80,
                  completed: false,
                  canAttempt: true,
                  requiresRelearning: false,
                  questions:
                    assessmentRequestCount === 1
                      ? []
                      : [
                          {
                            id: 'question-1',
                            type: 'single',
                            question: '课程完成前应先看到什么？',
                            options: [
                              { value: 'A', label: '课后测评' },
                              { value: 'B', label: '课程完成页' },
                            ],
                          },
                        ],
                },
              },
        ),
      });
    },
  );

  await seedLegacyEnterpriseClassroom(page);
  await page.goto('/classroom/stage-current');
  await expect(page.getByText('Loading classroom...')).toBeHidden({ timeout: 15_000 });
  await page
    .getByText(/Course complete|课程完成/)
    .first()
    .click();

  await expect(page.getByText('课后测评生成中')).toBeVisible();
  await expect(page.getByText('课程完成前应先看到什么？')).toBeVisible();
  await expect(page.getByText('Course not found', { exact: true })).toBeHidden();
  expect(requestedCourseIds).toEqual(['course-current', 'course-current', 'course-current']);
});
