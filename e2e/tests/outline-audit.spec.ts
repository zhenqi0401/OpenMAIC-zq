import { test, expect } from '../fixtures/base';
import { GenerationPreviewPage } from '../pages/generation-preview.page';
import { createSettingsStorage } from '../fixtures/test-data/settings';
import { mockSceneContentResponse } from '../fixtures/test-data/scene-content';

const SETTINGS = createSettingsStorage({ reviewOutlineEnabled: true });

function reviewSession(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    sessionId: 'outline-audit-e2e',
    requirements: {
      requirement: '课程必须准确介绍退款审批流程。',
      trainingCourseType: 'other',
    },
    pdfText: '',
    pdfImages: [],
    imageStorageIds: [],
    sceneOutlines: [
      {
        id: 'scene-1',
        type: 'slide',
        title: '错误标题',
        description: '介绍退款审批流程。',
        keyPoints: ['退款审批'],
        order: 1,
      },
    ],
    languageDirective: '使用中文授课。',
    currentStep: 'generating',
    previewPhase: 'review',
    ...overrides,
  });
}

test.describe('DeepSeek 大纲对抗审核', () => {
  test('建议在应用前不改大纲，应用后准确进入下游生成', async ({ page, mockApi }) => {
    await page.addInitScript(
      ({ settings, session }) => {
        localStorage.setItem('settings-storage', settings);
        localStorage.setItem('locale', 'zh-CN');
        sessionStorage.setItem('generationSession', session);
      },
      { settings: SETTINGS, session: reviewSession() },
    );

    await page.route('**/api/generate/outline-audit', async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          result: {
            auditId: 'audit-changes',
            baseRevision: body.outlineRevision,
            verdict: 'changes_proposed',
            summary: '发现一个标题错误。',
            findings: [
              {
                id: 'fix-title',
                severity: 'warning',
                category: 'internal_conflict',
                relatedSceneIds: ['scene-1'],
                reason: '标题与场景说明不一致。',
                evidence: [],
                before: '错误标题',
                after: '退款审批流程',
                operations: [
                  {
                    type: 'update_field',
                    sceneId: 'scene-1',
                    field: 'title',
                    value: '退款审批流程',
                  },
                ],
              },
            ],
            providerId: 'deepseek',
            modelId: 'deepseek-v4-flash',
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    let submittedTitle: string | undefined;
    await page.route('**/api/generate/scene-content', async (route) => {
      const body = route.request().postDataJSON();
      submittedTitle = body.outline.title;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mockSceneContentResponse,
          effectiveOutline: body.outline,
        }),
      });
    });
    await mockApi.mockSceneActions();

    const preview = new GenerationPreviewPage(page);
    await preview.goto();
    await preview.waitForEditor();
    const titleInput = page.getByPlaceholder('场景标题').first();
    await expect(titleInput).toHaveValue('错误标题');
    await expect(page.getByText('标题与场景说明不一致。')).toBeVisible();
    await expect(preview.confirmOutlinesButton).toBeDisabled();

    await page.getByLabel('选择建议：标题与场景说明不一致。').check();
    await page.getByRole('button', { name: /应用所选修改/ }).click();
    await expect(titleInput).toHaveValue('退款审批流程');
    await expect(page.getByText('所有审核建议均已处理')).toBeVisible();
    await expect(preview.confirmOutlinesButton).toBeEnabled();

    await preview.confirmOutlines();
    await preview.waitForRedirectToClassroom();
    expect(submittedTitle).toBe('退款审批流程');
  });

  test('审核失败时确认保持禁用，人工跳过必须二次确认', async ({ page, mockApi }) => {
    await page.addInitScript(
      ({ settings, session }) => {
        localStorage.setItem('settings-storage', settings);
        localStorage.setItem('locale', 'zh-CN');
        sessionStorage.setItem('generationSession', session);
      },
      { settings: SETTINGS, session: reviewSession() },
    );
    await page.route('**/api/generate/outline-audit', (route) =>
      route.fulfill({
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          auditError: {
            code: 'configuration_missing',
            message: 'not configured',
            retryable: false,
          },
        }),
      }),
    );
    await mockApi.mockSceneContent();
    await mockApi.mockSceneActions();

    const preview = new GenerationPreviewPage(page);
    await preview.goto();
    await preview.waitForEditor();
    await expect(page.getByText('DeepSeek 审核未完成')).toBeVisible();
    await expect(preview.confirmOutlinesButton).toBeDisabled();
    await page.getByRole('button', { name: '人工确认跳过' }).click();
    await expect(
      page.getByRole('heading', { name: '确认在 DeepSeek 审核未完成时继续？' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '确认人工跳过' }).click();
    await expect(preview.confirmOutlinesButton).toBeEnabled();
    await preview.confirmOutlines();
    await preview.waitForRedirectToClassroom();
  });

  for (const mode of ['interactive', 'task-engine'] as const) {
    test(`${mode} 模式不请求审核接口`, async ({ page, mockApi }) => {
      const modeSession =
        mode === 'interactive'
          ? reviewSession({
              requirements: { requirement: '互动课程', interactiveMode: true },
            })
          : reviewSession({
              requirements: { requirement: '任务课程', taskEngineMode: true },
              taskEngineMode: true,
            });
      await page.addInitScript(
        ({ settings, session }) => {
          localStorage.setItem('settings-storage', settings);
          localStorage.setItem('locale', 'zh-CN');
          sessionStorage.setItem('generationSession', session);
        },
        { settings: SETTINGS, session: modeSession },
      );
      let auditRequests = 0;
      await page.route('**/api/generate/outline-audit', (route) => {
        auditRequests += 1;
        return route.abort();
      });
      await mockApi.mockSceneContent();
      await mockApi.mockSceneActions();

      const preview = new GenerationPreviewPage(page);
      await preview.goto();
      await preview.waitForEditor();
      await expect(page.getByText('DeepSeek 对抗审核')).toHaveCount(0);
      await preview.confirmOutlines();
      await preview.waitForRedirectToClassroom();
      expect(auditRequests).toBe(0);
    });
  }
});
