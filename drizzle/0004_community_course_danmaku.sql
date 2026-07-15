CREATE TABLE IF NOT EXISTS "course_danmaku" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "course_id" uuid NOT NULL,
  "scene_key" varchar(128) NOT NULL,
  "action_id" varchar(128) NOT NULL,
  "action_offset_ms" integer NOT NULL,
  "author_id" uuid NOT NULL,
  "content" varchar(200) NOT NULL,
  "input_source" varchar(16) DEFAULT 'text' NOT NULL,
  "status" varchar(32) DEFAULT 'visible' NOT NULL,
  "client_request_id" varchar(128),
  "deleted_at" timestamp with time zone,
  "moderated_by" uuid,
  "moderation_reason" text,
  "moderated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "course_danmaku_action_offset_check" CHECK ("action_offset_ms" >= 0),
  CONSTRAINT "course_danmaku_content_check" CHECK (char_length(btrim("content")) BETWEEN 1 AND 200),
  CONSTRAINT "course_danmaku_input_source_check" CHECK ("input_source" IN ('text', 'voice')),
  CONSTRAINT "course_danmaku_status_check" CHECK ("status" IN ('visible', 'hidden', 'deleted_by_author', 'deleted_by_admin'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_danmaku" ADD CONSTRAINT "course_danmaku_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_danmaku" ADD CONSTRAINT "course_danmaku_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_danmaku" ADD CONSTRAINT "course_danmaku_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_danmaku_course_scene_status_created_idx" ON "course_danmaku" USING btree ("course_id", "scene_key", "status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_danmaku_course_scene_action_idx" ON "course_danmaku" USING btree ("course_id", "scene_key", "action_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_danmaku_author_created_idx" ON "course_danmaku" USING btree ("author_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_danmaku_author_course_request_idx" ON "course_danmaku" USING btree ("author_id", "course_id", "client_request_id");
