import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

function parseEnvFile(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function readEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  return existsSync(path) ? parseEnvFile(readFileSync(path, 'utf8')) : {};
}

const localEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
const databaseUrl = process.env.DATABASE_URL?.trim() || localEnv.DATABASE_URL || '';

if (!databaseUrl) {
  console.error('DATABASE_URL is empty after loading .env.local');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function hasTable(tableName, schemaName = 'public') {
  const rows = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = ${schemaName} and table_name = ${tableName}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function columns(tableName, schemaName = 'public') {
  const rows = await sql`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = ${schemaName} and table_name = ${tableName}
    order by ordinal_position
  `;
  return rows.map((row) => `${row.column_name}:${row.data_type}:${row.is_nullable}`);
}

async function main() {
  console.log('DATABASE_URL loaded:', databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'));

  const migrationTables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'drizzle' or table_name like '%migration%'
    order by table_schema, table_name
  `;
  console.log('migration-like tables:', migrationTables.map((row) => row.table_name));

  if (await hasTable('__drizzle_migrations', 'drizzle')) {
    const rows = await sql`select * from drizzle."__drizzle_migrations" order by 1`;
    console.log('drizzle.__drizzle_migrations rows:', rows);
  }

  for (const table of ['courses', 'media_files', 'course_scenes', 'course_outlines', 'course_audio_blobs']) {
    const exists = await hasTable(table);
    console.log(`${table}:`, exists ? 'exists' : 'missing');
    if (exists) console.log(`  columns:`, await columns(table));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
