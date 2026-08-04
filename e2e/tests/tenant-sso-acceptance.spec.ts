import { createHmac, randomUUID } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';

loadEnvConfig(process.cwd());

type SsoPayload = {
  hostUserId: string;
  displayName: string;
  phone: string;
  companyId: string;
  companyName: string;
  timestamp: number;
};

type SessionJson = {
  authenticated: boolean;
  user?: { id: string; role: { id: string; code: string; isAdmin: boolean } };
  tenant?: { name: string };
  identity?: { tenantId: string; roleId: string; isAdmin: boolean };
};

const enabled = process.env.RUN_TENANT_ACCEPTANCE === '1';
const databaseUrl = process.env.DATABASE_URL;
const ssoSecret = process.env.HOST_SSO_SECRET;

function sign(payload: SsoPayload): string {
  if (!ssoSecret) throw new Error('HOST_SSO_SECRET is required');
  return createHmac('sha256', ssoSecret).update(JSON.stringify(payload)).digest('hex');
}

function phoneFactory() {
  let value = Number(String(Date.now()).slice(-9));
  return () =>
    `18${String(((value++ % 1_000_000_000) + 1_000_000_000) % 1_000_000_000).padStart(9, '0')}`;
}

async function postSso(page: Page, payload: SsoPayload, signature = sign(payload)) {
  return page.request.post('/api/auth/host-sso', {
    data: payload,
    headers: { 'x-openmaic-signature': signature },
  });
}

async function readSession(page: Page): Promise<SessionJson> {
  const response = await page.request.get('/api/auth/session');
  expect(response.status()).toBe(200);
  return response.json() as Promise<SessionJson>;
}

async function cleanupAcceptanceData(
  sql: postgres.Sql,
  input: { companyIds: string[]; tenantIds: string[]; courseIds: string[]; categoryIds: string[] },
) {
  const tenantRows =
    input.companyIds.length > 0
      ? await sql<{ id: string }[]>`
          select id from tenants where company_id in ${sql(input.companyIds)}
        `
      : [];
  const tenantIds = [...new Set([...input.tenantIds, ...tenantRows.map((row) => row.id)])];
  if (tenantIds.length > 0) {
    await sql`delete from security_audit_log where tenant_id in ${sql(tenantIds)}`;
  }
  if (input.courseIds.length > 0) {
    await sql`delete from courses where id in ${sql(input.courseIds)}`;
  }
  if (input.categoryIds.length > 0) {
    await sql`delete from course_categories where id in ${sql(input.categoryIds)}`;
  }
  if (tenantIds.length > 0) {
    await sql`delete from invite_codes where tenant_id in ${sql(tenantIds)}`;
    await sql`delete from users where tenant_id in ${sql(tenantIds)}`;
    await sql`delete from roles where tenant_id in ${sql(tenantIds)}`;
  }
  if (input.companyIds.length > 0) {
    await sql`delete from tenants where company_id in ${sql(input.companyIds)}`;
  }
}

test.describe('真实 PostgreSQL A/B 跨租户与 SSO 冒烟验收', () => {
  test.skip(!enabled, 'Set RUN_TENANT_ACCEPTANCE=1 to run the destructive local acceptance test');

  test('完成内部租户、A、B 的 SSO、Cookie、后台隔离和并发最后管理员矩阵', async ({
    browser,
  }, testInfo) => {
    expect(databaseUrl, 'DATABASE_URL must be configured').toBeTruthy();
    expect(ssoSecret, 'HOST_SSO_SECRET must be configured').toBeTruthy();
    const parsedDatabaseUrl = new URL(databaseUrl!);
    expect(
      ['127.0.0.1', 'localhost', '::1'],
      'Acceptance refuses to mutate a non-loopback database',
    ).toContain(parsedDatabaseUrl.hostname);

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const companyIds = {
      internal: `acceptance:internal:${suffix}`,
      a: `acceptance:a:${suffix}`,
      b: `acceptance:b:${suffix}`,
    };
    const tenantIds: string[] = [];
    const categoryIds = [randomUUID(), randomUUID(), randomUUID()];
    const courseIds = [randomUUID(), randomUUID(), randomUUID()];
    const nextPhone = phoneFactory();
    const baseURL = String(testInfo.project.use.baseURL);
    const sql = postgres(databaseUrl!, { max: 8 });
    const contexts: BrowserContext[] = [];

    const makeContext = async () => {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      return { context, page: await context.newPage() };
    };

    const profiles = {
      internal: {
        hostUserId: `internal-admin-${suffix}`,
        displayName: '内部验收管理员',
        phone: nextPhone(),
        companyId: companyIds.internal,
        companyName: '验收内部租户',
      },
      a1: {
        hostUserId: `tenant-a-admin-${suffix}`,
        displayName: '企业A管理员',
        phone: nextPhone(),
        companyId: companyIds.a,
        companyName: '验收企业A',
      },
      a2: {
        hostUserId: `tenant-a-user-${suffix}`,
        displayName: '企业A第二用户',
        phone: nextPhone(),
        companyId: companyIds.a,
        companyName: '验收企业A',
      },
      b1: {
        hostUserId: `tenant-b-admin-${suffix}`,
        displayName: '企业B管理员',
        phone: nextPhone(),
        companyId: companyIds.b,
        companyName: '验收企业B',
      },
      b2: {
        hostUserId: `tenant-b-user-${suffix}`,
        displayName: '企业B第二用户',
        phone: nextPhone(),
        companyId: companyIds.b,
        companyName: '验收企业B',
      },
    } satisfies Record<string, Omit<SsoPayload, 'timestamp'>>;

    try {
      await sql`
        insert into tenants (id, company_id, name, type, status)
        values (${randomUUID()}, ${companyIds.internal}, ${profiles.internal.companyName}, 'internal', 'active')
      `;

      const internal = await makeContext();
      const a1 = await makeContext();
      const a2 = await makeContext();
      const b1 = await makeContext();
      const b2 = await makeContext();
      const anonymous = await makeContext();

      const expiredPayload = { ...profiles.a1, timestamp: Math.floor(Date.now() / 1000) - 301 };
      expect((await postSso(anonymous.page, expiredPayload)).status()).toBe(401);
      const invalidPayload = { ...profiles.a1, timestamp: Math.floor(Date.now() / 1000) };
      expect((await postSso(anonymous.page, invalidPayload, 'bad-signature')).status()).toBe(401);
      expect((await readSession(anonymous.page)).authenticated).toBe(false);

      const login = async (page: Page, profile: Omit<SsoPayload, 'timestamp'>) => {
        const payload = { ...profile, timestamp: Math.floor(Date.now() / 1000) };
        const response = await postSso(page, payload);
        expect(response.status()).toBe(200);
        const cookies = await page.context().cookies();
        expect(cookies).toContainEqual(
          expect.objectContaining({ name: 'openmaic_session', httpOnly: true, sameSite: 'Lax' }),
        );
        return response.json() as Promise<{
          user: { id: string; role: { id: string; code: string; isAdmin: boolean } };
          identity: { tenantId: string; isAdmin: boolean };
        }>;
      };

      const internalLogin = await login(internal.page, profiles.internal);
      const a1Login = await login(a1.page, profiles.a1);
      const a2Login = await login(a2.page, profiles.a2);
      const b1Login = await login(b1.page, profiles.b1);
      const b2Login = await login(b2.page, profiles.b2);

      expect(internalLogin.user.role).toMatchObject({ code: 'admin', isAdmin: true });
      expect(a1Login.user.role).toMatchObject({ code: 'admin', isAdmin: true });
      expect(a2Login.user.role).toMatchObject({ code: 'learner', isAdmin: false });
      expect(b1Login.user.role).toMatchObject({ code: 'admin', isAdmin: true });
      expect(b2Login.user.role).toMatchObject({ code: 'learner', isAdmin: false });
      tenantIds.push(
        internalLogin.identity.tenantId,
        a1Login.identity.tenantId,
        b1Login.identity.tenantId,
      );

      for (const [page, expectedName] of [
        [internal.page, profiles.internal.companyName],
        [a1.page, profiles.a1.companyName],
        [b1.page, profiles.b1.companyName],
      ] as const) {
        const session = await readSession(page);
        expect(session).toMatchObject({ authenticated: true, tenant: { name: expectedName } });
        expect(JSON.stringify(session)).not.toContain('companyId');
      }

      const rolesAResponse = await a1.page.request.get('/api/admin/roles');
      const rolesBResponse = await b1.page.request.get('/api/admin/roles');
      expect(rolesAResponse.status()).toBe(200);
      expect(rolesBResponse.status()).toBe(200);
      const rolesA = (await rolesAResponse.json()).roles as Array<{
        id: string;
        tenantId: string;
        code: string;
        isAdmin: boolean;
      }>;
      const rolesB = (await rolesBResponse.json()).roles as typeof rolesA;
      expect(rolesA.every((role) => role.tenantId === a1Login.identity.tenantId)).toBe(true);
      expect(rolesB.every((role) => role.tenantId === b1Login.identity.tenantId)).toBe(true);
      const adminRoleA = rolesA.find((role) => role.code === 'admin')!;
      const learnerRoleA = rolesA.find((role) => role.code === 'learner')!;
      const learnerRoleB = rolesB.find((role) => role.code === 'learner')!;

      const promoteA2 = await a1.page.request.patch(`/api/admin/users/${a2Login.user.id}/role`, {
        data: { roleId: adminRoleA.id },
      });
      expect(promoteA2.status()).toBe(200);

      const usersA = await (await a1.page.request.get('/api/admin/users')).json();
      const usersB = await (await b1.page.request.get('/api/admin/users')).json();
      expect(usersA.users.map((user: { id: string }) => user.id)).toEqual(
        expect.arrayContaining([a1Login.user.id, a2Login.user.id]),
      );
      expect(usersA.users.map((user: { id: string }) => user.id)).not.toContain(b2Login.user.id);
      expect(usersB.users.map((user: { id: string }) => user.id)).toEqual(
        expect.arrayContaining([b1Login.user.id, b2Login.user.id]),
      );
      expect(usersB.users.map((user: { id: string }) => user.id)).not.toContain(a2Login.user.id);

      for (const responsePromise of [
        a1.page.request.patch(`/api/admin/users/${b2Login.user.id}/role`, {
          data: { roleId: adminRoleA.id },
        }),
        a1.page.request.patch(`/api/admin/users/${a2Login.user.id}/role`, {
          data: { roleId: learnerRoleB.id },
        }),
        a1.page.request.patch(`/api/admin/users/${b2Login.user.id}/status`, {
          data: { status: 'disabled' },
        }),
        a1.page.request.delete(`/api/admin/users/${b2Login.user.id}`),
      ]) {
        expect((await responsePromise).status()).toBe(404);
      }

      const inviteBResponse = await b1.page.request.post('/api/admin/invite-codes', {
        data: { code: `B${String(Date.now()).slice(-7)}`, roleId: learnerRoleB.id, enabled: true },
      });
      expect(inviteBResponse.status()).toBe(201);
      const inviteBId = (await inviteBResponse.json()).inviteCode.id as string;
      const invitesA = await (await a1.page.request.get('/api/admin/invite-codes')).json();
      expect(invitesA.inviteCodes.map((invite: { id: string }) => invite.id)).not.toContain(
        inviteBId,
      );
      expect(
        (
          await a1.page.request.patch(`/api/admin/invite-codes/${inviteBId}`, {
            data: { enabled: false },
          })
        ).status(),
      ).toBe(404);

      await sql`
        insert into course_categories (id, tenant_id, scope, name, sort_order)
        values
          (${categoryIds[0]}, null, 'platform', ${`验收平台分类-${suffix}`}, 0),
          (${categoryIds[1]}, ${a1Login.identity.tenantId}, 'tenant', ${`验收A分类-${suffix}`}, 0),
          (${categoryIds[2]}, ${b1Login.identity.tenantId}, 'tenant', ${`验收B分类-${suffix}`}, 0)
      `;
      await sql`
        insert into courses (id, tenant_id, scope, name, description, category_id, status, visibility_mode)
        values
          (${courseIds[0]}, null, 'platform', ${`验收平台课程-${suffix}`}, 'platform', ${categoryIds[0]}, 'published', 'all'),
          (${courseIds[1]}, ${a1Login.identity.tenantId}, 'tenant', ${`验收A课程-${suffix}`}, 'tenant-a', ${categoryIds[1]}, 'published', 'all'),
          (${courseIds[2]}, ${b1Login.identity.tenantId}, 'tenant', ${`验收B课程-${suffix}`}, 'tenant-b', ${categoryIds[2]}, 'published', 'all')
      `;

      const coursesA = await (await a1.page.request.get('/api/admin/courses')).json();
      const coursesB = await (await b1.page.request.get('/api/admin/courses')).json();
      expect(coursesA.courses.map((course: { id: string }) => course.id)).toEqual(
        expect.arrayContaining([courseIds[0], courseIds[1]]),
      );
      expect(coursesA.courses.map((course: { id: string }) => course.id)).not.toContain(
        courseIds[2],
      );
      expect(coursesB.courses.map((course: { id: string }) => course.id)).toEqual(
        expect.arrayContaining([courseIds[0], courseIds[2]]),
      );
      expect(
        (
          await a1.page.request.patch(`/api/admin/courses/${courseIds[0]}`, {
            data: { name: '禁止修改平台课程' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await a1.page.request.patch(`/api/admin/courses/${courseIds[2]}`, {
            data: { name: '禁止修改B课程' },
          })
        ).status(),
      ).toBe(404);

      await a1.page.goto('/admin?module=access');
      const identity = a1.page.locator('[data-admin-current-identity]');
      await expect(identity).toContainText(`公司：${profiles.a1.companyName}`);
      await expect(identity).toContainText('角色：企业管理员（admin）');
      await expect(identity).toContainText(`用户：${profiles.a1.displayName}`);
      const identityText = await identity.textContent();
      expect(identityText?.indexOf('公司：')).toBeLessThan(identityText?.indexOf('角色：') ?? -1);
      expect(identityText?.indexOf('角色：')).toBeLessThan(identityText?.indexOf('用户：') ?? -1);

      const renamedTenant = '验收企业A已更名';
      await sql`update tenants set name = ${renamedTenant} where id = ${a1Login.identity.tenantId}`;
      await a1.page.reload();
      await expect(a1.page.locator('[data-admin-current-identity]')).toContainText(
        `公司：${renamedTenant}`,
      );
      expect((await readSession(a1.page)).tenant?.name).toBe(renamedTenant);

      const [demoteA2, demoteA1] = await Promise.all([
        a1.page.request.patch(`/api/admin/users/${a2Login.user.id}/role`, {
          data: { roleId: learnerRoleA.id },
        }),
        a2.page.request.patch(`/api/admin/users/${a1Login.user.id}/role`, {
          data: { roleId: learnerRoleA.id },
        }),
      ]);
      const demotionStatuses = [demoteA2.status(), demoteA1.status()];
      expect(demotionStatuses.filter((status) => status === 200)).toHaveLength(1);
      expect(demotionStatuses.every((status) => [200, 403, 409].includes(status))).toBe(true);
      const [activeAdminsAfterRace] = await sql<{ count: number }[]>`
        select count(*)::int as count
        from users
        join roles on roles.id = users.role_id
        where users.tenant_id = ${a1Login.identity.tenantId}
          and users.status = 'active'
          and roles.is_admin = true
      `;
      expect(activeAdminsAfterRace.count).toBe(1);

      await sql`
        update users
        set role_id = ${adminRoleA.id}, status = 'active'
        where id in ${sql([a1Login.user.id, a2Login.user.id])}
      `;
      const demotePersistedSsoUser = await a2.page.request.patch(
        `/api/admin/users/${a1Login.user.id}/role`,
        { data: { roleId: learnerRoleA.id } },
      );
      expect(demotePersistedSsoUser.status()).toBe(200);
      const reloginPayload = {
        ...profiles.a1,
        companyName: renamedTenant,
        timestamp: Math.floor(Date.now() / 1000),
      };
      const relogin = await postSso(a1.page, reloginPayload);
      expect(relogin.status()).toBe(200);
      expect((await relogin.json()).user.role).toMatchObject({ code: 'learner', isAdmin: false });
      expect(await readSession(a1.page)).toMatchObject({
        authenticated: true,
        identity: { isAdmin: false },
      });
      expect((await a1.page.request.get('/api/admin/roles')).status()).toBe(403);

      const freezeDemotedUser = await a2.page.request.patch(
        `/api/admin/users/${a1Login.user.id}/status`,
        { data: { status: 'disabled' } },
      );
      expect(freezeDemotedUser.status()).toBe(200);
      const frozenReloginPayload = { ...reloginPayload, timestamp: Math.floor(Date.now() / 1000) };
      expect((await postSso(a1.page, frozenReloginPayload)).status()).toBe(401);
      expect((await a1.page.request.get('/api/auth/session')).status()).toBe(401);

      expect(
        (
          await a2.page.request.patch(`/api/admin/users/${a2Login.user.id}/role`, {
            data: { roleId: learnerRoleA.id },
          })
        ).status(),
      ).toBe(409);
      expect(
        (
          await a2.page.request.patch(`/api/admin/users/${a2Login.user.id}/status`, {
            data: { status: 'disabled' },
          })
        ).status(),
      ).toBe(409);

      const internalUsers = await (await internal.page.request.get('/api/admin/users')).json();
      expect(internalUsers.users.map((user: { id: string }) => user.id)).toEqual([
        internalLogin.user.id,
      ]);
      expect(
        (
          await internal.page.request.patch(`/api/admin/courses/${courseIds[0]}`, {
            data: { name: '内部租户也不能修改平台课程' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await internal.page.request.patch(`/api/admin/courses/${courseIds[2]}`, {
            data: { name: '内部租户也不能修改B课程' },
          })
        ).status(),
      ).toBe(404);
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
      await cleanupAcceptanceData(sql, {
        companyIds: Object.values(companyIds),
        tenantIds: [...new Set(tenantIds)],
        courseIds,
        categoryIds,
      });
      await sql.end();
    }
  });
});
