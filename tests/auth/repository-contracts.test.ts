import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('auth repository tenant administrator contracts', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/auth/repository.ts'), 'utf8');

  test('serializes role demotions through the tenant administrator-role lock', () => {
    expect(source).toMatch(
      /transitionUserRole[\s\S]*?eq\(roles\.tenantId, input\.actorTenantId\)[\s\S]*?eq\(roles\.isAdmin, true\)[\s\S]*?orderBy\(asc\(roles\.id\)\)[\s\S]*?for\('update'\)/,
    );
    expect(source).toMatch(
      /eq\(users\.id, input\.userId\)[\s\S]*?eq\(users\.tenantId, input\.actorTenantId\)[\s\S]*?for\('update'\)/,
    );
    expect(source).toMatch(
      /eq\(users\.status, 'active'\)[\s\S]*?eq\(roles\.isAdmin, true\)[\s\S]*?activeAdmins[\s\S]*?<= 1/,
    );
  });

  test('writes promotion and demotion audits without profile or secret fields', () => {
    const transitionSource = source.slice(
      source.indexOf('async transitionUserRole'),
      source.indexOf('async deleteTenantUser'),
    );
    expect(transitionSource).toContain(
      "event: promoting ? 'admin_role.promoted' : 'admin_role.demoted'",
    );
    expect(transitionSource).toContain("createHash('sha256').update(target.user.id)");
    expect(transitionSource).toContain('actorUserId: input.actorUserId');
    expect(transitionSource).toContain('previousRoleId: target.role.id');
    expect(transitionSource).toContain('nextRoleId: nextRole.id');
    expect(transitionSource).not.toContain('target.user.phone');
    expect(transitionSource).not.toContain('passwordHash');
    expect(transitionSource).not.toContain('companyId');
  });

  test('returns the persisted role for an existing SSO user instead of restoring admin', () => {
    expect(source).toMatch(
      /where\(and\(eq\(roles\.id, user\.roleId\), eq\(roles\.tenantId, tenant\.id\)\)\)[\s\S]*?role: toAuthRole\(assignedRole\)/,
    );
  });

  test('locks tenant administrator roles before refusing direct administrator deletion', () => {
    expect(source).toMatch(
      /deleteTenantUser[\s\S]*?eq\(roles\.tenantId, input\.actorTenantId\)[\s\S]*?eq\(roles\.isAdmin, true\)[\s\S]*?for\('update'\)[\s\S]*?target\.role\.isAdmin/,
    );
  });
});
