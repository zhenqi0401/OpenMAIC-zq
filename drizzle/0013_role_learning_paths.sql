CREATE TABLE IF NOT EXISTS "role_learning_path_courses" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE RESTRICT,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "role_learning_path_courses_pkey" PRIMARY KEY ("role_id", "course_id"),
  CONSTRAINT "role_learning_path_courses_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_learning_path_courses_role_position_unique"
  ON "role_learning_path_courses" ("role_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_learning_path_courses_course_id_idx"
  ON "role_learning_path_courses" ("course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_learning_path_courses_tenant_id_idx"
  ON "role_learning_path_courses" ("tenant_id");
