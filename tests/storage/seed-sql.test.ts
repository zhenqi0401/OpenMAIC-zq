import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { verifyPassword } from '@/lib/security/password';

describe('enterprise seed SQL', () => {
  const seedSql = readFileSync(resolve(process.cwd(), 'drizzle/seed.sql'), 'utf8');

  test('creates the admin and learner roles', () => {
    expect(seedSql).toContain("('admin', '管理员', TRUE)");
    expect(seedSql).toContain("('learner', '学员', FALSE)");
  });

  test('creates a reusable test administrator account without storing plaintext password', async () => {
    expect(seedSql).toContain('INSERT INTO users');
    expect(seedSql).toContain('13900000000');
    expect(seedSql).toContain('测试管理员');
    expect(seedSql).toContain("roles.code = 'admin'");
    expect(seedSql).toContain('ON CONFLICT (phone) DO UPDATE');
    expect(seedSql).not.toContain('admin123');

    const hashMatch = seedSql.match(/scrypt\$[a-f0-9]+\$[a-f0-9]+/);
    expect(hashMatch?.[0]).toBeTruthy();
    await expect(verifyPassword('admin123', hashMatch![0])).resolves.toBe(true);
  });
});

describe('learner category defaults migration', () => {
  const migrationSql = readFileSync(
    resolve(process.cwd(), 'drizzle/0002_learner_category_defaults.sql'),
    'utf8',
  );

  test('initializes three editable categories without duplicating existing names', () => {
    expect(migrationSql).toContain("('员工手册', 10)");
    expect(migrationSql).toContain("('公司规范规章制度', 20)");
    expect(migrationSql).toContain("('新员工入职', 30)");
    expect(migrationSql).toMatch(/WHERE NOT EXISTS\s*\(/i);
    expect(migrationSql).toMatch(/"course_categories"\."name"\s*=\s*defaults\.name/);
    expect(migrationSql).not.toMatch(/system|protected|locked/i);
    expect(migrationSql).not.toMatch(/DO UPDATE/i);
  });
});
