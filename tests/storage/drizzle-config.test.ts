import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('Drizzle config', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  test('points Drizzle at the Slice-00 schema and migration folder', async () => {
    const { default: config } = await import('@/drizzle.config');

    expect(config).toMatchObject({
      schema: './lib/storage/schema/index.ts',
      out: './drizzle',
      dialect: 'postgresql',
    });
  });

  test('parses quoted local env values', async () => {
    const { parseEnvFile } = await import('@/drizzle.config');

    expect(parseEnvFile('DATABASE_URL="postgres://from-env-local"\n# ignored')).toEqual({
      DATABASE_URL: 'postgres://from-env-local',
    });
  });

  test('uses shell DATABASE_URL before local env files', async () => {
    const { resolveDatabaseUrl } = await import('@/drizzle.config');

    expect(
      resolveDatabaseUrl(
        { DATABASE_URL: 'postgres://already-set' },
        { DATABASE_URL: 'postgres://from-env-local' },
      ),
    ).toBe('postgres://already-set');
  });

  test('falls back to loaded env files when shell DATABASE_URL is blank', async () => {
    const { resolveDatabaseUrl } = await import('@/drizzle.config');

    expect(resolveDatabaseUrl({ DATABASE_URL: '' }, { DATABASE_URL: 'postgres://from-env-local' })).toBe(
      'postgres://from-env-local',
    );
  });
});
