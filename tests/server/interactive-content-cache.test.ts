import { describe, expect, it, vi } from 'vitest';
import {
  createInteractiveRequestFingerprint,
  digestSecret,
  InteractiveRequestCoalescer,
} from '@/lib/server/interactive-content-cache';

const result = (id: number) => ({ content: { id }, effectiveOutline: { id: `outline-${id}` } });

describe('interactive request fingerprint', () => {
  it('is stable across object key order but changes with scoped inputs and secret digests', () => {
    expect(createInteractiveRequestFingerprint({ b: 2, a: { y: 2, x: 1 } })).toBe(
      createInteractiveRequestFingerprint({ a: { x: 1, y: 2 }, b: 2 }),
    );
    expect(createInteractiveRequestFingerprint({ run: 'a' })).not.toBe(
      createInteractiveRequestFingerprint({ run: 'b' }),
    );
    expect(digestSecret('key-a')).not.toBe(digestSecret('key-b'));
    expect(digestSecret('key-a')).not.toContain('key-a');
  });
});

describe('interactive request coalescing cache', () => {
  it('coalesces concurrent work and reuses a successful result within the TTL', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const generate = vi.fn(async () => {
      await gate;
      return result(1);
    });
    const cache = new InteractiveRequestCoalescer();

    const first = cache.run('same', generate);
    const second = cache.run('same', generate);
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([result(1), result(1)]);
    await expect(cache.run('same', generate)).resolves.toEqual(result(1));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures and removes a rejected in-flight promise', async () => {
    const generate = vi
      .fn<() => Promise<ReturnType<typeof result>>>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(result(2));
    const cache = new InteractiveRequestCoalescer();

    await expect(cache.run('retryable', generate)).rejects.toThrow('failed');
    await expect(cache.run('retryable', generate)).resolves.toEqual(result(2));
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('regenerates expired entries', async () => {
    let now = 0;
    const generate = vi.fn().mockResolvedValueOnce(result(1)).mockResolvedValueOnce(result(2));
    const cache = new InteractiveRequestCoalescer({ ttlMs: 10, now: () => now });

    await expect(cache.run('expiring', generate)).resolves.toEqual(result(1));
    now = 10;
    await expect(cache.run('expiring', generate)).resolves.toEqual(result(2));
  });

  it('evicts the earliest-expiring success above the size limit', async () => {
    let now = 0;
    const cache = new InteractiveRequestCoalescer({ ttlMs: 100, maxEntries: 2, now: () => now });
    const generators = [0, 1, 2].map((id) => vi.fn().mockResolvedValue(result(id)));

    await cache.run('first', generators[0]);
    now = 1;
    await cache.run('second', generators[1]);
    now = 2;
    await cache.run('third', generators[2]);
    await cache.run('second', generators[1]);
    expect(generators[1]).toHaveBeenCalledTimes(1);

    await cache.run('first', generators[0]);

    expect(generators[0]).toHaveBeenCalledTimes(2);
  });
});
