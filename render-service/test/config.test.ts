/** Config resolves env once at import, so each case reloads the module. */
import { describe, it, expect, afterEach, vi } from 'vitest';

const KEY = 'RENDER_MAX_JOBS_PER_USER';
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
  vi.resetModules();
});

async function loadConfig() {
  vi.resetModules();
  const mod = await import('../src/config.js');
  return mod.config;
}

describe('config maxJobsPerUser', () => {
  it('does not allow zero to disable the per-owner guard', async () => {
    process.env[KEY] = '0';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });

  it('accepts a positive override', async () => {
    process.env[KEY] = '5';
    expect((await loadConfig()).maxJobsPerUser).toBe(5);
  });

  it('falls back to the default (1) for negative or non-numeric values', async () => {
    process.env[KEY] = '-3';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
    process.env[KEY] = 'nonsense';
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });

  it('falls back to the default when unset', async () => {
    delete process.env[KEY];
    expect((await loadConfig()).maxJobsPerUser).toBe(1);
  });
});
