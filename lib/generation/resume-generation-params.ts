import { nanoid } from 'nanoid';

type SessionStorageReader = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Load the generation context used when an interrupted classroom resumes.
 *
 * Older sessions do not have a generationRunId. Persist the generated value so
 * every request from this resumed run keeps the same cache/coalescing identity.
 */
export function loadResumeGenerationParams<T extends Record<string, unknown>>(
  storage: SessionStorageReader,
): T & { generationRunId: string } {
  const serialized = storage.getItem('generationParams');
  const parsed: unknown = serialized ? JSON.parse(serialized) : {};
  const params =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T & { generationRunId?: unknown })
      : ({} as T & { generationRunId?: unknown });

  if (typeof params.generationRunId !== 'string' || !params.generationRunId.trim()) {
    params.generationRunId = nanoid();
    storage.setItem('generationParams', JSON.stringify(params));
  }

  return params as T & { generationRunId: string };
}
