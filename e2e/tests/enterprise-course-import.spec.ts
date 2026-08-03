import JSZip from 'jszip';
import { test, expect } from '../fixtures/base';

test('previews and submits the shared enterprise course import dialog with an explicit category', async ({
  page,
}) => {
  await page.route('**/api/admin/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: [] }),
    }),
  );
  await page.route('**/api/admin/courses?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
      }),
    }),
  );
  await page.route('**/api/admin/courses/import', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        course: { id: 'imported-1', status: 'draft' },
        warnings: [
          {
            kind: 'audio',
            path: 'audio/missing.mp3',
            reason: 'file_missing',
            message: '音频资源缺失：audio/missing.mp3',
          },
        ],
      }),
    });
  });

  await page.goto('/admin?module=courses');
  await expect(page.getByRole('heading', { name: '课程管理' })).toBeVisible();
  await page.getByRole('button', { name: '导入企业课程' }).click();
  const dialog = page.getByRole('dialog', { name: '导入企业课程' });
  await expect(dialog.getByRole('button', { name: '导入并保存为草稿' })).toBeDisabled();

  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      formatVersion: 1,
      stage: { name: '浏览器验收课程', createdAt: 1, updatedAt: 1 },
      agents: [],
      scenes: [
        {
          type: 'slide',
          title: '第一场景',
          order: 0,
          content: { type: 'slide', canvas: { elements: [] } },
        },
      ],
      mediaIndex: {},
    }),
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'acceptance.maic.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
  });
  await expect(dialog.getByText('浏览器验收课程')).toBeVisible();
  await expect(dialog.getByText(/1 个场景/)).toBeVisible();

  await dialog.getByRole('combobox', { name: '课程分类' }).click();
  await page.getByRole('option', { name: 'E2E Category' }).click();
  const submit = dialog.getByRole('button', { name: '导入并保存为草稿' });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByText('校验课程包')).toBeVisible();
  await expect(dialog.getByText('上传资源')).toBeVisible();
  await expect(dialog.getByText('写入数据库')).toBeVisible();
  await expect(dialog.getByText('缺失资源（1）')).toBeVisible();
  await expect(dialog.getByText('音频资源缺失：audio/missing.mp3')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '关闭' })).toBeVisible();
});
