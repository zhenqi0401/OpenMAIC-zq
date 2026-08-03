import { describe, expect, test, vi } from 'vitest';

import {
  createEnterpriseStorageService,
  EnterpriseStorageServiceError,
  type EnterpriseRepository,
} from '@/lib/storage/enterprise-service';

function preparedImport() {
  return {
    categoryId: 'category-1',
    createdBy: 'admin-1',
    stage: { id: 'stage-1', name: 'Imported' },
    scenes: [{ id: 'scene-1' }],
    outlines: [{ id: 'outline-1' }],
    binaries: [],
    warnings: [],
  };
}

describe('enterprise course import service', () => {
  test('rejects an invalid category before invoking the atomic repository import', async () => {
    const importEnterpriseCourse = vi.fn();
    const service = createEnterpriseStorageService({
      listCategories: vi.fn().mockResolvedValue([]),
      importEnterpriseCourse,
    } as unknown as EnterpriseRepository);

    await expect(service.importEnterpriseCourse(preparedImport())).rejects.toEqual(
      expect.objectContaining<Partial<EnterpriseStorageServiceError>>({
        code: 'INVALID_REQUEST',
      }),
    );
    expect(importEnterpriseCourse).not.toHaveBeenCalled();
  });

  test('returns warnings with the draft produced by the repository and propagates write failures', async () => {
    const warning = {
      kind: 'audio' as const,
      path: 'audio/missing.mp3',
      reason: 'file_missing',
      message: '音频资源缺失',
    };
    const importedCourse = { id: 'course-1', status: 'draft' };
    const importEnterpriseCourse = vi.fn().mockResolvedValue(importedCourse);
    const service = createEnterpriseStorageService({
      listCategories: vi.fn().mockResolvedValue([{ id: 'category-1' }]),
      importEnterpriseCourse,
    } as unknown as EnterpriseRepository);

    await expect(
      service.importEnterpriseCourse({ ...preparedImport(), warnings: [warning] }),
    ).resolves.toEqual({ course: importedCourse, warnings: [warning] });

    importEnterpriseCourse.mockRejectedValueOnce(new Error('injected transaction failure'));
    await expect(service.importEnterpriseCourse(preparedImport())).rejects.toThrow(
      'injected transaction failure',
    );
  });
});
