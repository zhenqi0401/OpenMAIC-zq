import { defineConfig } from 'drizzle-kit';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
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

function readEnvFile(fileName: string): Record<string, string> {
  const path = resolve(process.cwd(), fileName);
  return existsSync(path) ? parseEnvFile(readFileSync(path, 'utf8')) : {};
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  localEnv: Record<string, string> = { ...readEnvFile('.env'), ...readEnvFile('.env.local') },
) {
  return env.DATABASE_URL?.trim() || localEnv.DATABASE_URL?.trim() || '';
}

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: './lib/storage/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
