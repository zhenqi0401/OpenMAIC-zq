ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "course_progress"
SET
  "started_at" = COALESCE("started_at", "completed_at", "updated_at"),
  "last_viewed_at" = COALESCE("last_viewed_at", "updated_at", "completed_at", now());
--> statement-breakpoint
ALTER TABLE "course_progress" ALTER COLUMN "started_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "course_progress" ALTER COLUMN "started_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_progress" ALTER COLUMN "last_viewed_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "course_progress" ALTER COLUMN "last_viewed_at" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_progress_course_id_idx" ON "course_progress" USING btree ("course_id");
