CREATE TABLE IF NOT EXISTS "community_rate_limits" (
  "actor_id" uuid NOT NULL,
  "action_kind" varchar(32) NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "action_count" integer DEFAULT 1 NOT NULL,
  "last_action_at" timestamp with time zone NOT NULL,
  "last_content_hash" varchar(64),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_rate_limits_actor_id_action_kind_pk" PRIMARY KEY("actor_id", "action_kind"),
  CONSTRAINT "community_rate_limits_action_count_check" CHECK ("action_count" >= 1),
  CONSTRAINT "community_rate_limits_action_kind_check" CHECK ("action_kind" IN ('danmaku', 'forum_post', 'forum_reply'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_moderation_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "moderator_id" uuid NOT NULL,
  "target_type" varchar(32) NOT NULL,
  "target_id" uuid NOT NULL,
  "action" varchar(32) NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_moderation_audit_target_type_check" CHECK ("target_type" IN ('danmaku', 'forum_post', 'forum_reply')),
  CONSTRAINT "community_moderation_audit_reason_check" CHECK ("reason" IS NULL OR char_length("reason") <= 500)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_rate_limits" ADD CONSTRAINT "community_rate_limits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_moderation_audit" ADD CONSTRAINT "community_moderation_audit_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_rate_limits_updated_at_idx" ON "community_rate_limits" ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_moderation_audit_target_idx" ON "community_moderation_audit" ("target_type", "target_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_moderation_audit_moderator_created_idx" ON "community_moderation_audit" ("moderator_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_moderation_audit_created_at_idx" ON "community_moderation_audit" ("created_at");
