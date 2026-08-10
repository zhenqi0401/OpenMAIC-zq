import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  for (const fileName of ['.env.local', '.env']) {
    try {
      const content = await readFile(path.resolve(process.cwd(), fileName), 'utf8');
      const line = content
        .split(/\r?\n/)
        .find((value) => value.trim().startsWith('DATABASE_URL='));
      if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return '';
}

const databaseUrl = await resolveDatabaseUrl();
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const targetUrl = new URL(databaseUrl);
const target = {
  host: targetUrl.hostname,
  port: targetUrl.port || '5432',
  database: targetUrl.pathname.replace(/^\//, ''),
};
const isLocalTarget = target.host === '127.0.0.1' || target.host === 'localhost';

const sqlPath = path.resolve(process.cwd(), 'drizzle/mock-learning-data.sql');
const tenantId = '00000000-0000-4000-8000-000000000001';
const seedSql = (await readFile(sqlPath, 'utf8')).replaceAll(
  '10000000-0000-4000-8000-000000000001',
  tenantId,
);
const plan = {
  target,
  tenantId,
  courses: ['客户需求澄清基础', '销售异议处理实战', '运营复盘方法'],
  states: ['学习中', '待通过测评', '已完成', '选修未开始'],
};

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ dryRun: true, plan, hint: '加 --apply 才会写入数据库' }, null, 2));
  process.exit(0);
}

if (!isLocalTarget) {
  throw new Error(
    `Refusing to apply mock data to non-local database ${target.host}/${target.database}`,
  );
}

const sql = postgres(databaseUrl, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(seedSql);
  });
  console.log(JSON.stringify({ dryRun: false, applied: true, plan }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
