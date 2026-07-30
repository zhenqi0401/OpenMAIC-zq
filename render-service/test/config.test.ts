/** Config resolves env once at import, so each case reloads the module. */
import { describe, it, expect, afterEach, vi } from 'vitest';

const KEYS = ['RENDER_MAX_JOBS_PER_USER', 'RENDER_PRODUCER_WORKERS'] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

async function loadConfig() {
  vi.resetModules();
  const mod = await import('../src/config.js');
  return mod.config;
}

describe('config maxJobsPerUser', () => {
  it('does not allow zero to disable the per-owner guard', async () => {
    process.env.RENDER_MAX_JOBS_PER_USER = '0';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });

  it('accepts a positive override', async () => {
    process.env.RENDER_MAX_JOBS_PER_USER = '5';
    expect((await loadConfig()).maxJobsPerUser).toBe(5);
  });

  it('falls back to the default (1) for negative or non-numeric values', async () => {
    process.env.RENDER_MAX_JOBS_PER_USER = '-3';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
    process.env.RENDER_MAX_JOBS_PER_USER = 'nonsense';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });

  it('falls back to the default when unset', async () => {
    delete process.env.RENDER_MAX_JOBS_PER_USER;
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });
});

describe('config producerWorkers', () => {
  it('defaults to one explicit capture worker', async () => {
    delete process.env.RENDER_PRODUCER_WORKERS;
    expect((await loadConfig()).producerWorkers).toBe(1);
  });

  it('accepts a positive worker count and caps unsafe values at eight', async () => {
    process.env.RENDER_PRODUCER_WORKERS = '2';
    expect((await loadConfig()).producerWorkers).toBe(2);
    process.env.RENDER_PRODUCER_WORKERS = '99';
    expect((await loadConfig()).producerWorkers).toBe(8);
  });

  it('falls back to one for zero or invalid values', async () => {
    process.env.RENDER_PRODUCER_WORKERS = '0';
    expect((await loadConfig()).producerWorkers).toBe(1);
    process.env.RENDER_PRODUCER_WORKERS = 'invalid';
    expect((await loadConfig()).producerWorkers).toBe(1);
  });
});
