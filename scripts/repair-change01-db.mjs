import { createHash } from 'node:crypto';
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

function migrationFile(tag) {
  const path = resolve(process.cwd(), 'drizzle', `${tag}.sql`);
  const content = readFileSync(path, 'utf8');
  return {
    tag,
    content,
    hash: createHash('sha256').update(content).digest('hex'),
  };
}

function foundationTableNames() {
  const content = readFileSync(
    resolve(process.cwd(), 'drizzle', '0000_slice_00_foundation.sql'),
    'utf8',
  );
  return [...content.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]);
}

const localEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
const databaseUrl = process.env.DATABASE_URL?.trim() || localEnv.DATABASE_URL?.trim() || '';
const shouldApply = process.argv.includes('--apply');

if (!databaseUrl) {
  console.error('DATABASE_URL is empty after loading .env.local');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function hasTable(tx, tableName, schemaName = 'public') {
  const rows = await tx`
    select exists (
      select 1 from information_schema.tables
      where table_schema = ${schemaName} and table_name = ${tableName}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function missingTables(tx, tableNames) {
  const missing = [];
  for (const tableName of tableNames) {
    if (!(await hasTable(tx, tableName))) missing.push(tableName);
  }
  return missing;
}

async function applyRepair(tx) {
  await tx.unsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await tx.unsafe(`
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "stage_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL
  `);
  await tx.unsafe(`
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "generation_status" varchar(32) DEFAULT 'draft' NOT NULL
  `);
  await tx.unsafe(`
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "generation_complete" boolean DEFAULT false NOT NULL
  `);

  await tx.unsafe(`
    CREATE TABLE IF NOT EXISTS "course_scenes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid,
      "course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
      "scene_key" varchar(128) NOT NULL,
      "type" varchar(32) NOT NULL,
      "title" text NOT NULL,
      "scene_order" integer NOT NULL,
      "scene_data" jsonb NOT NULL,
      "content" jsonb NOT NULL,
      "actions" jsonb,
      "whiteboards" jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await tx.unsafe(`
    CREATE INDEX IF NOT EXISTS "course_scenes_course_id_idx"
    ON "course_scenes" USING btree ("course_id")
  `);
  await tx.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "course_scenes_course_scene_key_idx"
    ON "course_scenes" USING btree ("course_id","scene_key")
  `);

  await tx.unsafe(`
    CREATE TABLE IF NOT EXISTS "course_outlines" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid,
      "course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
      "outline" jsonb NOT NULL,
      "generation_status" varchar(32) DEFAULT 'draft' NOT NULL,
      "generation_complete" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await tx.unsafe(`
    CREATE INDEX IF NOT EXISTS "course_outlines_course_id_idx"
    ON "course_outlines" USING btree ("course_id")
  `);

  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "scene_key" varchar(128)
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "media_id" varchar(128)
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "media_type" varchar(32)
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "mime_type" varchar(128)
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "size_bytes" integer
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "prompt" text
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "params" jsonb
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "blob" bytea
  `);
  await tx.unsafe(`
    ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "poster_blob" bytea
  `);
  await tx.unsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'media_files' AND column_name = 'oss_key'
      ) THEN
        ALTER TABLE "media_files" ALTER COLUMN "oss_key" DROP NOT NULL;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'media_files' AND column_name = 'poster_oss_key'
      ) THEN
        ALTER TABLE "media_files" ALTER COLUMN "poster_oss_key" DROP NOT NULL;
      END IF;
    END $$
  `);
  await tx.unsafe(`
    CREATE INDEX IF NOT EXISTS "media_files_course_id_idx"
    ON "media_files" USING btree ("course_id")
  `);
  await tx.unsafe(`
    CREATE INDEX IF NOT EXISTS "media_files_scene_id_idx"
    ON "media_files" USING btree ("scene_id")
  `);
  await tx.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "media_files_course_media_id_idx"
    ON "media_files" USING btree ("course_id","media_id")
  `);

  await tx.unsafe(`
    CREATE TABLE IF NOT EXISTS "course_audio_blobs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid,
      "course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
      "scene_key" varchar(128),
      "audio_id" varchar(128) NOT NULL,
      "mime_type" varchar(128),
      "size_bytes" integer NOT NULL,
      "text" text,
      "voice" varchar(128),
      "blob" bytea NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await tx.unsafe(`
    CREATE INDEX IF NOT EXISTS "course_audio_blobs_course_id_idx"
    ON "course_audio_blobs" USING btree ("course_id")
  `);
  await tx.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "course_audio_blobs_course_audio_id_idx"
    ON "course_audio_blobs" USING btree ("course_id","audio_id")
  `);
}

async function markMigrationsApplied(tx) {
  const journal = JSON.parse(
    readFileSync(resolve(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8'),
  );
  const migrationByTag = new Map([
    ['0000_slice_00_foundation', migrationFile('0000_slice_00_foundation')],
    ['0001_change_01_course_storage', migrationFile('0001_change_01_course_storage')],
  ]);

  await tx.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await tx.unsafe(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  for (const entry of journal.entries) {
    const migration = migrationByTag.get(entry.tag);
    if (!migration) continue;
    await tx`
      insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
      select ${migration.hash}, ${entry.when}
      where not exists (
        select 1 from "drizzle"."__drizzle_migrations" where "created_at" = ${entry.when}
      )
    `;
  }
}

async function main() {
  console.log('DATABASE_URL loaded:', databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'));

  const planned = [
    'add missing CHANGE-01 course columns',
    'create missing course_scenes, course_outlines, and course_audio_blobs tables',
    'add PostgreSQL blob columns to media_files',
    'relax legacy media_files.oss_key NOT NULL constraints if those columns exist',
    'mark drizzle 0000 and 0001 migrations as applied after schema verification',
  ];

  if (!shouldApply) {
    console.log('Dry run. Planned repair actions:');
    for (const action of planned) console.log(`- ${action}`);
    console.log('Run with --apply to modify the database.');
    return;
  }

  await sql.begin(async (tx) => {
    await applyRepair(tx);
    const missing = await missingTables(tx, foundationTableNames());
    if (missing.length > 0) {
      throw new Error(
        `Foundation tables are still missing; refusing to mark migrations: ${missing.join(', ')}`,
      );
    }
    await markMigrationsApplied(tx);
  });

  console.log('CHANGE-01 database repair applied.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
