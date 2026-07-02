import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: ReturnType<typeof drizzle> | null = null;

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for OpenMAIC enterprise storage');
  }
  return databaseUrl;
}

export function getDb() {
  if (!dbClient) {
    sqlClient = postgres(getDatabaseUrl());
    dbClient = drizzle(sqlClient);
  }
  return dbClient;
}

export function runDbTransaction<T>(
  operation: Parameters<ReturnType<typeof getDb>['transaction']>[0],
): Promise<T> {
  return getDb().transaction(operation) as Promise<T>;
}
