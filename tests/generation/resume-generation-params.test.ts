import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadResumeGenerationParams } from '@/lib/generation/resume-generation-params';

function sessionStorageWith(initialParams: Record<string, unknown>) {
  let value = JSON.stringify(initialParams);
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
    readParams: () => JSON.parse(value) as Record<string, unknown>,
  };
}

describe('loadResumeGenerationParams', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and persists a run ID without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {});
    const storage = sessionStorageWith({ generatedCourseId: 'course-1' });

    const params = loadResumeGenerationParams(storage);

    expect(params.generationRunId).toEqual(expect.any(String));
    expect(params.generationRunId).not.toBe('');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith('generationParams', expect.any(String));
    expect(storage.readParams()).toEqual({
      generatedCourseId: 'course-1',
      generationRunId: params.generationRunId,
    });
  });

  it('reuses an existing non-empty run ID without rewriting the session', () => {
    const storage = sessionStorageWith({
      generatedCourseId: 'course-1',
      generationRunId: 'existing-run',
    });

    const params = loadResumeGenerationParams(storage);

    expect(params.generationRunId).toBe('existing-run');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
