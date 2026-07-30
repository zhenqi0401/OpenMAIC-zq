import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryJobStore } from '../src/job-store.js';
import type { RenderJobRecord } from '../src/types.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('InMemoryJobStore terminal TTL', () => {
  it('reaps terminal records and invokes artifact cleanup', async () => {
    vi.useFakeTimers();
    const onReap = vi.fn();
    const store = new InMemoryJobStore(1000, onReap);
    const record: RenderJobRecord = {
      id: 'expired-job',
      owner: 'owner',
      status: 'succeeded',
      progress: 1,
      currentStage: 'complete',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      projectDir: '/tmp/expired-job',
      outputPath: '/tmp/expired-job/output.mp4',
    };
    await store.create(record);

    await vi.advanceTimersByTimeAsync(61_000);

    await expect(store.get(record.id)).resolves.toBeNull();
    expect(onReap).toHaveBeenCalledWith(record);
  });
});
