import { describe, expect, test } from 'vitest';

import config from '@/drizzle.config';

describe('Drizzle config', () => {
  test('points Drizzle at the Slice-00 schema and migration folder', () => {
    expect(config).toMatchObject({
      schema: './lib/storage/schema/index.ts',
      out: './drizzle',
      dialect: 'postgresql',
    });
  });

  test('uses DATABASE_URL as the PostgreSQL connection source', () => {
    expect(config.dbCredentials).toEqual({ url: process.env.DATABASE_URL ?? '' });
  });
});
