ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "stage_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "generation_status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "generation_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint

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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_scenes_course_id_idx" ON "course_scenes" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_scenes_course_scene_key_idx" ON "course_scenes" USING btree ("course_id","scene_key");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "course_outlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
	"outline" jsonb NOT NULL,
	"generation_status" varchar(32) DEFAULT 'draft' NOT NULL,
	"generation_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_outlines_course_id_idx" ON "course_outlines" USING btree ("course_id");--> statement-breakpoint

ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "scene_key" varchar(128);--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "media_id" varchar(128);--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "media_type" varchar(32);--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "mime_type" varchar(128);--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "prompt" text;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "params" jsonb;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "blob" bytea;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "poster_blob" bytea;--> statement-breakpoint
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
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_files_course_id_idx" ON "media_files" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_files_scene_id_idx" ON "media_files" USING btree ("scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_files_course_media_id_idx" ON "media_files" USING btree ("course_id","media_id");--> statement-breakpoint

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
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_audio_blobs_course_id_idx" ON "course_audio_blobs" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_audio_blobs_course_audio_id_idx" ON "course_audio_blobs" USING btree ("course_id","audio_id");
