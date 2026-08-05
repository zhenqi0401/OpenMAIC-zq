import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SYSTEM_COURSE_CATEGORIES } from '@/lib/courses/system-categories';

const migration = readFileSync('drizzle/0009_host_sso_category_deep_links.sql', 'utf8');
const sharedScopeMigration = readFileSync(
  'drizzle/0010_learner_forum_catalog_refinement.sql',
  'utf8',
);

describe('system course category migration', () => {
  test('defines the stable five-key contract and tenant-scoped uniqueness', () => {
    expect(SYSTEM_COURSE_CATEGORIES).toEqual([
      { categoryKey: 'management', name: '管理知识培训', sortOrder: 10 },
      { categoryKey: 'professional', name: '专业知识培训', sortOrder: 20 },
      { categoryKey: 'tob-sales', name: 'ToB销售培训', sortOrder: 30 },
      { categoryKey: 'toc-sales', name: 'ToC销售培训', sortOrder: 40 },
      { categoryKey: 'company-policy', name: '公司制度培训', sortOrder: 50 },
    ]);
    expect(migration).toContain('course_categories_tenant_key_unique');
    expect(migration).toMatch(/WHERE "scope" = 'tenant' AND "category_key" IS NOT NULL/);
  });

  test('upgrades exact-name tenant categories before filling missing keys', () => {
    const upgradeAt = migration.indexOf('UPDATE "course_categories" AS category');
    const fillAt = migration.indexOf('INSERT INTO "course_categories"');
    expect(upgradeAt).toBeGreaterThan(0);
    expect(fillAt).toBeGreaterThan(upgradeAt);
    expect(migration).toContain('category."name" = fixed.name');
    expect(migration).toContain('WHERE NOT EXISTS');
    expect(migration).not.toMatch(/DELETE FROM "course_categories"/);
  });

  test('stores only hashes for replay and one-time login records', () => {
    expect(migration).toContain('"code_hash" text NOT NULL');
    expect(migration).toContain('"request_id_hash" text NOT NULL');
    expect(migration).not.toMatch(/"code" text/);
  });

  test('shares the five fixed keys across platform and tenant scopes', () => {
    expect(sharedScopeMigration).toContain('course_categories_platform_key_unique');
    expect(sharedScopeMigration).toContain('category."scope" = \'platform\'');
    expect(sharedScopeMigration).toContain('source_category."category_key" IS NOT NULL');
    expect(sharedScopeMigration).toContain(
      'platform courses must be mapped to one of the five fixed categories before migration',
    );
    expect(sharedScopeMigration).toContain(
      '("category_key" IS NULL AND lower(btrim("name")) NOT IN',
    );
  });
});
