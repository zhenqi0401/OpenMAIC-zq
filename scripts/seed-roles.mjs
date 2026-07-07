import { readFile } from 'node:fs/promises';
import path from 'node:path';

import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL?.trim();

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
