import postgres from 'postgres';

import { hashPassword } from '@/lib/security/password';

function value(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const result = index >= 0 ? process.argv[index + 1]?.trim() : '';
  if (!result) throw new Error(`--${name} is required`);
  return result;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const phone = value('phone');
  const displayName = value('display-name');
  const password = process.env.OPENMAIC_BOOTSTRAP_PASSWORD;
  if (!password) throw new Error('OPENMAIC_BOOTSTRAP_PASSWORD is required');
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('Invalid phone');
  if (password.length < 12)
    throw new Error('Bootstrap password must contain at least 12 characters');
  const apply = process.argv.includes('--apply');
  const plan = { tenant: '美视智能', phone, displayName, role: 'admin' };
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, plan }, null, 2)}\n`);
    return;
  }
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      const [role] = await tx<Array<{ id: string; tenant_id: string }>>`
        SELECT r.id, r.tenant_id
        FROM roles r JOIN tenants t ON t.id = r.tenant_id
        WHERE t.company_id = 'internal:meishi-ai' AND r.code = 'admin' AND r.is_admin = true
      `;
      if (!role) throw new Error('Internal administrator role is not seeded');
      const passwordHash = await hashPassword(password);
      await tx`
        INSERT INTO users (tenant_id, phone, password_hash, role_id, status, display_name)
        VALUES (${role.tenant_id}, ${phone}, ${passwordHash}, ${role.id}, 'active', ${displayName})
        ON CONFLICT (phone) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role_id = EXCLUDED.role_id,
          status = 'active',
          display_name = EXCLUDED.display_name,
          updated_at = now()
      `;
    });
    process.stdout.write(`${JSON.stringify({ dryRun: false, applied: true, plan }, null, 2)}\n`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
