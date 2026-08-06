import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SYSTEM_COURSE_CATEGORIES } from '@/lib/courses/system-categories';

const migration = readFileSync('drizzle/0009_host_sso_category_deep_links.sql', 'utf8');
const sharedScopeMigration = readFileSync(
  'drizzle/0010_learner_forum_catalog_refinement.sql',
  'utf8',
);
const platformOnlyMigration = readFileSync(
  'drizzle/0011_platform_fixed_categories_shared.sql',
  'utf8',
);
const tenantCourseMigration = readFileSync(
  'drizzle/0012_shared_category_tenant_courses.sql',
  'utf8',
);
const authRepository = readFileSync('lib/auth/repository.ts', 'utf8');

describe('system course category migration', () => {
  test('defines the stable five-key contract without seeding tenant copies', () => {
    expect(SYSTEM_COURSE_CATEGORIES).toEqual([
      { categoryKey: 'management', name: '管理知识培训', sortOrder: 10 },
      { categoryKey: 'professional', name: '专业知识培训', sortOrder: 20 },
      { categoryKey: 'tob-sales', name: 'ToB销售培训', sortOrder: 30 },
      { categoryKey: 'toc-sales', name: 'ToC销售培训', sortOrder: 40 },
      { categoryKey: 'company-policy', name: '公司制度培训', sortOrder: 50 },
    ]);
    expect(migration).not.toContain('course_categories_tenant_key_unique');
    expect(migration).not.toContain('INSERT INTO "course_categories"');
    expect(authRepository).not.toContain('SYSTEM_COURSE_CATEGORIES');
    expect(authRepository).not.toContain('.insert(courseCategories)');
  });

  test('stores only hashes for replay and one-time login records', () => {
    expect(migration).toContain('"code_hash" text NOT NULL');
    expect(migration).toContain('"request_id_hash" text NOT NULL');
    expect(migration).not.toMatch(/"code" text/);
  });

  test('creates one platform-owned set of five fixed categories', () => {
    expect(sharedScopeMigration).toContain('course_categories_platform_key_unique');
    expect(sharedScopeMigration).toContain('category."scope" = \'platform\'');
    expect(sharedScopeMigration).toContain(
      'lower(btrim(category."name")) = lower(btrim(fixed.name))',
    );
    expect(sharedScopeMigration).toMatch(
      /category\."category_key" = fixed\.category_key\s+OR lower\(btrim\(category\."name"\)\) = lower\(btrim\(fixed\.name\)\)/,
    );
    expect(sharedScopeMigration).toContain('source_category."category_key" IS NOT NULL');
    expect(sharedScopeMigration).toContain(
      'platform courses must be mapped to one of the five fixed categories before migration',
    );
    expect(sharedScopeMigration).toContain(
      '("category_key" IS NULL AND lower(btrim("name")) NOT IN',
    );
  });

  test('rejects in-use tenant copies before deleting unused fixed-category rows', () => {
    expect(platformOnlyMigration).toContain('SELECT 1;');
    expect(platformOnlyMigration).toContain('ownership-aware remap');
  });

  test('splits the trigger function from data statements for postgres migration execution', () => {
    expect(tenantCourseMigration).toContain('$$ LANGUAGE plpgsql;\n--> statement-breakpoint\n');
    expect(tenantCourseMigration).toContain('SET category_id = platform_category.id');
    expect(tenantCourseMigration).toContain('SET category_ids = (');
    expect(tenantCourseMigration).not.toContain('FROM LATERAL');
    expect(tenantCourseMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "course_categories_category_key_check"',
    );
    expect(tenantCourseMigration).toContain(
      "DELETE FROM course_categories\nWHERE scope = 'tenant'\n  AND category_key IS NOT NULL;",
    );
  });
});
