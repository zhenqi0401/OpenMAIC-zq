import JSZip from 'jszip';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireCurrentAdmin: vi.fn(),
  importEnterpriseCourse: vi.fn(),
}));

vi.mock('@/lib/auth/current-session', () => ({
  requireCurrentAdmin: mocks.requireCurrentAdmin,
}));

vi.mock('@/lib/storage/enterprise-route-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/storage/enterprise-route-utils')>();
  return {
    ...original,
    getEnterpriseService: () => ({ importEnterpriseCourse: mocks.importEnterpriseCourse }),
  };
});

import { POST } from '@/app/api/admin/courses/import/route';

async function courseFile() {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      formatVersion: 1,
      stage: { name: 'Imported', createdAt: 1, updatedAt: 1 },
      agents: [],
      scenes: [
        {
          type: 'slide',
          title: 'Intro',
          order: 0,
          content: { type: 'slide', canvas: { elements: [] } },
        },
      ],
      mediaIndex: {},
    }),
  );
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'course.maic.zip', {
    type: 'application/zip',
  });
}

async function request() {
  const body = new FormData();
  body.set('file', await courseFile());
  body.set('categoryId', 'category-1');
  return new Request('http://localhost/api/admin/courses/import', { method: 'POST', body });
}

describe('POST /api/admin/courses/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
    mocks.importEnterpriseCourse.mockResolvedValue({
      course: { id: 'course-1', status: 'draft' },
      warnings: [],
    });
  });

  test('imports a validated ZIP for an administrator', async () => {
    const response = await POST(await request());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      course: { id: 'course-1', status: 'draft' },
      warnings: [],
    });
    expect(mocks.importEnterpriseCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'category-1',
        createdBy: 'admin-1',
        scenes: [expect.objectContaining({ title: 'Intro' })],
      }),
    );
  });

  test.each([401, 403])('rejects a session guard response with HTTP %s', async (status) => {
    mocks.requireCurrentAdmin.mockResolvedValue(new Response('denied', { status }));
    const response = await POST(await request());
    expect(response.status).toBe(status);
    expect(mocks.importEnterpriseCourse).not.toHaveBeenCalled();
  });

  test('requires an explicit category and rejects invalid ZIP files', async () => {
    const missingCategory = new FormData();
    missingCategory.set('file', await courseFile());
    expect(
      (
        await POST(
          new Request('http://localhost/api/admin/courses/import', {
            method: 'POST',
            body: missingCategory,
          }),
        )
      ).status,
    ).toBe(400);

    const invalid = new FormData();
    invalid.set('file', new File([new Uint8Array([1, 2, 3])], 'broken.zip'));
    invalid.set('categoryId', 'category-1');
    const response = await POST(
      new Request('http://localhost/api/admin/courses/import', { method: 'POST', body: invalid }),
    );
    expect(response.status).toBe(400);
  });
});
