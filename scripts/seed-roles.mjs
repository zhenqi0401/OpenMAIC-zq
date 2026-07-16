import { readFile } from 'node:fs/promises';
import path from 'node:path';

import postgres from 'postgres';

function parseEnvValue(content, key) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0 || line.slice(0, equalsIndex).trim() !== key) continue;
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return '';
}

async function resolveDatabaseUrl() {
  const processValue = process.env.DATABASE_URL?.trim();
  if (processValue) return processValue;

  // Match the local Drizzle configuration: explicit process env wins, then
  // .env.local overrides the repository-level .env fallback.
  for (const fileName of ['.env.local', '.env']) {
    try {
      const content = await readFile(path.resolve(process.cwd(), fileName), 'utf8');
      const value = parseEnvValue(content, 'DATABASE_URL');
      if (value) return value;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return '';
}

const databaseUrl = await resolveDatabaseUrl();

if (!databaseUrl) {
  console.error('DATABASE_URL is required to seed OpenMAIC roles.');
  process.exit(1);
}

const seedRelativePath = 'drizzle/seed.sql';
const seedPath = path.resolve(process.cwd(), ...seedRelativePath.split('/'));
const seedSql = await readFile(seedPath, 'utf8');
const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.unsafe(seedSql);
  console.log('OpenMAIC role seed applied.');
} finally {
  await sql.end({ timeout: 5 });
}
