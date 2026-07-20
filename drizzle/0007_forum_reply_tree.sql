ALTER TABLE "forum_replies" ADD COLUMN "parent_reply_id" uuid;
--> statement-breakpoint
ALTER TABLE "forum_replies" ADD COLUMN "depth" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_parent_reply_id_forum_replies_id_fk" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_depth_check" CHECK ("depth" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_parent_depth_check" CHECK (("parent_reply_id" IS NULL AND "depth" = 1) OR ("parent_reply_id" IS NOT NULL AND "depth" BETWEEN 2 AND 5));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_replies_post_parent_created_idx" ON "forum_replies" ("post_id", "parent_reply_id", "created_at", "id");
