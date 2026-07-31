import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/home.page';
import { GenerationPreviewPage } from '../pages/generation-preview.page';
import { createSettingsStorage } from '../fixtures/test-data/settings';
import { mockSceneContentResponse } from '../fixtures/test-data/scene-content';
import { createMockSceneActionsResponse } from '../fixtures/test-data/scene-actions';

const SETTINGS = createSettingsStorage({ reviewOutlineEnabled: true });

const FIDELITY_OUTLINES = [
  {
    id: 'fidelity-slide',
    type: 'slide',
    title: '退款复核条件',
    description: '讲清楚金额条件与责任人',
    keyPoints: ['退款复核'],
    order: 1,
    trainingCourseType: 'company_policy',
    teachingBrief: { mustCover: ['退款金额超过 5000 元时必须由财务负责人复核'] },
    sourceEvidence: [
      {
        id: 'DOC-001',
        kind: 'document',
        label: '员工退款制度.pdf',
        excerpt:
          '退款金额超过 5000 元时必须由财务负责人复核，并在两个工作日内完成。该摘录用于验证长文本在移动端不会造成横向滚动。',
      },
    ],
  },
  {
    id: 'fidelity-quiz',
    type: 'quiz',
    title: '制度测验',
    description: '检查审批条件',
    keyPoints: ['审批条件'],
    order: 2,
    trainingCourseType: 'company_policy',
    teachingBrief: { mustCover: ['审批时限为两个工作日'] },
    sourceEvidence: [
      {
        id: 'DOC-001',
        kind: 'document',
        label: '员工退款制度.pdf',
        excerpt: '退款金额超过 5000 元时必须由财务负责人复核，并在两个工作日内完成。',
      },
    ],
    quizConfig: { questionCount: 1, difficulty: 'easy', questionTypes: ['single'] },
  },
];

const REVIEW_SESSION = JSON.stringify({
  sessionId: 'fidelity-review-session',
  requirements: {
    requirement: '依据 PDF 制作退款制度培训',
    trainingCourseType: 'company_policy',
  },
  pdfText: '退款金额超过 5000 元时必须由财务负责人复核，并在两个工作日内完成。',
  pdfFileName: '员工退款制度.pdf',
  pdfImages: [],
  imageStorageIds: [],
  sceneOutlines: FIDELITY_OUTLINES,
  languageDirective: '使用中文授课。',
  currentStep: 'generating',
  previewPhase: 'review',
});

const LEGACY_REVIEW_SESSION = JSON.stringify({
  sessionId: 'legacy-review-session',
  requirements: {
    requirement: '使用同一份输入生成课程',
    trainingCourseType: 'other',
  },
  pdfText: '',
  pdfImages: [],
  imageStorageIds: [],
  sceneOutlines: FIDELITY_OUTLINES.map(
    ({ trainingCourseType: _type, teachingBrief: _brief, sourceEvidence: _sources, ...item }) =>
      item,
  ),
  languageDirective: '使用中文授课。',
  currentStep: 'generating',
  previewPhase: 'review',
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test.describe('精品课程输入保真 Demo', () => {
  test('requires a strategy for click/keyboard submit and keeps input while switching', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.addInitScript((settings) => {
      localStorage.setItem('settings-storage', settings);
      localStorage.setItem('locale', 'zh-CN');
    }, SETTINGS);
    const home = new HomePage(page);
    await home.goto();
    await home.fillRequirement('精确保留数字 42 和三个操作步骤');

    await expect(home.enterButton).toBeDisabled();
    await home.textarea.focus();
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
    await expect(page).toHaveURL(/\/$/);

    await home.selectTrainingStrategy(/专业知识培训/);
    await home.selectTrainingStrategy(/原大纲总结式/);
    await expect(home.textarea).toHaveValue('精确保留数字 42 和三个操作步骤');
    await home.selectTrainingStrategy(/专业知识培训/);
    await expect(home.enterButton).toBeEnabled();
    await home.textarea.focus();
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
    await expect(page).toHaveURL(/\/generation-preview/, { timeout: 15_000 });
  });

  test('edits must-cover items, keeps PDF evidence read-only, and persists the outline to IndexedDB', async ({
    page,
    mockApi,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(
      ({ settings, session }) => {
        localStorage.setItem('settings-storage', settings);
        localStorage.setItem('locale', 'zh-CN');
        localStorage.setItem('theme', 'dark');
        sessionStorage.setItem('generationSession', session);
      },
      { settings: SETTINGS, session: REVIEW_SESSION },
    );
    // Classroom probes enterprise storage before falling back to browser-local
    // Stage data. Return a deterministic miss so refresh exercises IndexedDB.
    await page.route('**/api/courses/*', (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: 'not found' }) }),
    );
    await page.route('**/api/admin/courses/*/content', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 404, body: JSON.stringify({ error: 'not found' }) });
      }
      return route.fallback();
    });

    let firstContentOutline: Record<string, unknown> | undefined;
    await page.route('**/api/generate/scene-content', async (route) => {
      const body = route.request().postDataJSON();
      firstContentOutline = body.outline;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mockSceneContentResponse,
          effectiveOutline: body.outline,
        }),
      });
    });
    await page.route('**/api/generate/scene-actions', async (route) => {
      const body = route.request().postDataJSON();
      const response = createMockSceneActionsResponse(body.stageId);
      response.scene.id = `scene-${body.outline.id}`;
      response.scene.title = body.outline.title;
      response.scene.order = body.outline.order;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      });
    });
    await mockApi.mockOutlineAuditPass();

    const preview = new GenerationPreviewPage(page);
    await preview.goto();
    await preview.waitForEditor();
    await expect(page.getByRole('heading', { name: '内容保真' }).first()).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByText('员工退款制度.pdf').first()).toBeVisible();
    await expect(page.getByText('PDF 来源').first()).toBeVisible();
    await expect(page.getByLabel('必须覆盖项 1').first()).toBeEditable();
    await expectNoHorizontalOverflow(page);

    const revised = '退款金额达到 5000 元（含）时必须由财务负责人复核';
    await page.getByLabel('必须覆盖项 1').first().fill(revised);
    await expect(page.getByText('审核结果已过期', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.getByText('DeepSeek 审核通过，无需改动')).toBeVisible();
    // Evidence is rendered as text; no editable control may expose its body or ID.
    await expect(
      page.locator('input[value="DOC-001"], textarea:has-text("退款金额超过 5000 元")'),
    ).toHaveCount(0);

    await preview.confirmOutlines();
    await preview.waitForRedirectToClassroom();
    expect(firstContentOutline).toMatchObject({
      trainingCourseType: 'company_policy',
      teachingBrief: { mustCover: [revised] },
      sourceEvidence: [{ id: 'DOC-001', label: '员工退款制度.pdf' }],
    });

    const persisted = await page.evaluate(async () => {
      const request = indexedDB.open('MAIC-Database');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction('stageOutlines', 'readonly');
      const recordsRequest = transaction.objectStore('stageOutlines').getAll();
      return await new Promise<Array<{ outlines?: typeof FIDELITY_OUTLINES }>>(
        (resolve, reject) => {
          recordsRequest.onsuccess = () => resolve(recordsRequest.result);
          recordsRequest.onerror = () => reject(recordsRequest.error);
        },
      );
    });
    expect(
      persisted.some((record) => record.outlines?.[0]?.teachingBrief.mustCover[0] === revised),
    ).toBe(true);

    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    expect(
      consoleErrors.filter((message) => !message.startsWith('Failed to load resource:')),
    ).toEqual([]);
  });

  test('keeps original outline summary review free of fidelity UI and fields', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(
      ({ settings, session }) => {
        localStorage.setItem('settings-storage', settings);
        localStorage.setItem('locale', 'zh-CN');
        sessionStorage.setItem('generationSession', session);
      },
      { settings: SETTINGS, session: LEGACY_REVIEW_SESSION },
    );
    let submittedOutline: Record<string, unknown> | undefined;
    await page.route('**/api/generate/scene-content', async (route) => {
      const body = route.request().postDataJSON();
      submittedOutline = body.outline;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mockSceneContentResponse, effectiveOutline: body.outline }),
      });
    });
    await mockApi.mockSceneActions();
    await mockApi.mockOutlineAuditPass();

    const preview = new GenerationPreviewPage(page);
    await preview.goto();
    await preview.waitForEditor();
    await expect(page.getByRole('heading', { name: '内容保真' })).toHaveCount(0);
    await expect(page.getByText('员工退款制度.pdf')).toHaveCount(0);
    await preview.confirmOutlines();
    await preview.waitForRedirectToClassroom();
    expect(submittedOutline).not.toHaveProperty('trainingCourseType');
    expect(submittedOutline).not.toHaveProperty('teachingBrief');
    expect(submittedOutline).not.toHaveProperty('sourceEvidence');
  });
});
