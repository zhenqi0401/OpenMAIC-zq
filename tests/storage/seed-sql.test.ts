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
