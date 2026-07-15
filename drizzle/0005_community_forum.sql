CREATE TABLE IF NOT EXISTS "forum_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "author_id" uuid NOT NULL,
  "scope" varchar(16) DEFAULT 'global' NOT NULL,
  "course_id" uuid,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "status" varchar(32) DEFAULT 'visible' NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "locked" boolean DEFAULT false NOT NULL,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "moderated_by" uuid,
  "moderation_reason" text,
  "moderated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forum_posts_scope_course_check" CHECK (("scope" = 'global' AND "course_id" IS NULL) OR ("scope" = 'course' AND ("course_id" IS NOT NULL OR "status" = 'archived'))),
  CONSTRAINT "forum_posts_scope_check" CHECK ("scope" IN ('global', 'course')),
  CONSTRAINT "forum_posts_status_check" CHECK ("status" IN ('visible', 'hidden', 'deleted_by_author', 'deleted_by_admin', 'archived')),
  CONSTRAINT "forum_posts_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 160),
  CONSTRAINT "forum_posts_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 10000),
  CONSTRAINT "forum_posts_reply_count_check" CHECK ("reply_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "body" text NOT NULL,
  "status" varchar(32) DEFAULT 'visible' NOT NULL,
  "deleted_at" timestamp with time zone,
  "moderated_by" uuid,
  "moderation_reason" text,
  "moderated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forum_replies_status_check" CHECK ("status" IN ('visible', 'hidden', 'deleted_by_author', 'deleted_by_admin')),
  CONSTRAINT "forum_replies_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 5000)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_status_pinned_created_idx" ON "forum_posts" ("status", "pinned", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_status_pinned_activity_idx" ON "forum_posts" ("status", "pinned", "last_activity_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_course_status_activity_idx" ON "forum_posts" ("course_id", "status", "last_activity_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_author_created_idx" ON "forum_posts" ("author_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_replies_post_status_created_idx" ON "forum_replies" ("post_id", "status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_replies_author_created_idx" ON "forum_replies" ("author_id", "created_at");
