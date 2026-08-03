CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" varchar(16) DEFAULT 'company' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_company_id_unique" UNIQUE("company_id"),
	CONSTRAINT "tenants_type_check" CHECK ("type" IN ('internal', 'company')),
	CONSTRAINT "tenants_status_check" CHECK ("status" IN ('active', 'suspended'))
);
--> statement-breakpoint
INSERT INTO "tenants" ("id", "company_id", "name", "type")
VALUES ('00000000-0000-4000-8000-000000000001', 'internal:meishi-ai', '美视智能', 'internal')
ON CONFLICT ("company_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_code_unique";
--> statement-breakpoint
UPDATE "roles" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "users" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "invite_codes" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "course_categories" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "courses" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "course_scenes" child SET "tenant_id" = parent."tenant_id" FROM "courses" parent WHERE child."course_id" = parent."id";
UPDATE "course_outlines" child SET "tenant_id" = parent."tenant_id" FROM "courses" parent WHERE child."course_id" = parent."id";
UPDATE "media_files" child SET "tenant_id" = parent."tenant_id" FROM "courses" parent WHERE child."course_id" = parent."id";
UPDATE "course_audio_blobs" child SET "tenant_id" = parent."tenant_id" FROM "courses" parent WHERE child."course_id" = parent."id";
UPDATE "assessment_attempts" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."user_id" = parent."id";
UPDATE "exam_policies" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "exam_attempts" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."user_id" = parent."id";
UPDATE "host_api_keys" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "course_danmaku" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."author_id" = parent."id";
UPDATE "forum_posts" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."author_id" = parent."id";
--> statement-breakpoint
ALTER TABLE "course_categories" ADD COLUMN "scope" varchar(16) DEFAULT 'tenant' NOT NULL;
ALTER TABLE "courses" ADD COLUMN "scope" varchar(16) DEFAULT 'tenant' NOT NULL;
ALTER TABLE "course_progress" ADD COLUMN "tenant_id" uuid;
ALTER TABLE "forum_replies" ADD COLUMN "tenant_id" uuid;
ALTER TABLE "community_moderation_audit" ADD COLUMN "tenant_id" uuid;
--> statement-breakpoint
UPDATE "course_progress" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."user_id" = parent."id";
UPDATE "forum_replies" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."author_id" = parent."id";
UPDATE "community_moderation_audit" child SET "tenant_id" = parent."tenant_id" FROM "users" parent WHERE child."moderator_id" = parent."id";
--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "invite_codes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "course_progress" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "assessment_attempts" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "exam_policies" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "exam_attempts" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "host_api_keys" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "course_danmaku" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "forum_posts" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "forum_replies" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "community_moderation_audit" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "exam_policies" ADD CONSTRAINT "exam_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "host_api_keys" ADD CONSTRAINT "host_api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "course_danmaku" ADD CONSTRAINT "course_danmaku_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
ALTER TABLE "community_moderation_audit" ADD CONSTRAINT "community_moderation_audit_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_code_unique" ON "roles" ("tenant_id", "code");
CREATE UNIQUE INDEX "course_categories_platform_name_unique" ON "course_categories" ("name") WHERE "scope" = 'platform';
CREATE UNIQUE INDEX "course_categories_tenant_name_unique" ON "course_categories" ("tenant_id", "name") WHERE "scope" = 'tenant';
CREATE INDEX "courses_scope_tenant_status_idx" ON "courses" ("scope", "tenant_id", "status");
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_scope_tenant_check" CHECK (("scope" = 'platform' AND "tenant_id" IS NULL) OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL));
ALTER TABLE "courses" ADD CONSTRAINT "courses_scope_tenant_check" CHECK (("scope" = 'platform' AND "tenant_id" IS NULL) OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL));
ALTER TABLE "courses" ADD CONSTRAINT "courses_platform_visibility_check" CHECK ("scope" <> 'platform' OR "visibility_mode" = 'all');
--> statement-breakpoint
CREATE TABLE "platform_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" varchar(64) NOT NULL,
	"actor" varchar(128) NOT NULL,
	"source_course_id" uuid,
	"target_course_id" uuid,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_audit_log_source_course_id_courses_id_fk" FOREIGN KEY ("source_course_id") REFERENCES "courses"("id") ON DELETE SET NULL,
	CONSTRAINT "platform_audit_log_target_course_id_courses_id_fk" FOREIGN KEY ("target_course_id") REFERENCES "courses"("id") ON DELETE SET NULL
);
CREATE INDEX "platform_audit_log_created_at_idx" ON "platform_audit_log" ("created_at");
--> statement-breakpoint
CREATE TABLE "security_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"event" varchar(64) NOT NULL,
	"subject_hash" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE INDEX "security_audit_log_created_at_idx" ON "security_audit_log" ("created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_tenant_relationships() RETURNS trigger AS $$
DECLARE expected_tenant uuid;
DECLARE expected_scope varchar(16);
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    SELECT tenant_id INTO expected_tenant FROM roles WHERE id = NEW.role_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'user and role tenants must match'; END IF;
  ELSIF TG_TABLE_NAME = 'invite_codes' THEN
    SELECT tenant_id INTO expected_tenant FROM roles WHERE id = NEW.role_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'invite and role tenants must match'; END IF;
  ELSIF TG_TABLE_NAME = 'courses' THEN
    SELECT tenant_id, scope INTO expected_tenant, expected_scope FROM course_categories WHERE id = NEW.category_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id OR expected_scope IS DISTINCT FROM NEW.scope THEN RAISE EXCEPTION 'course and category ownership must match'; END IF;
    IF NEW.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by AND tenant_id = NEW.tenant_id) THEN RAISE EXCEPTION 'course creator tenant must match'; END IF;
  ELSIF TG_TABLE_NAME = 'course_visibility_roles' THEN
    SELECT tenant_id, scope INTO expected_tenant, expected_scope FROM courses WHERE id = NEW.course_id;
    IF expected_scope = 'platform' THEN RAISE EXCEPTION 'platform courses cannot have role visibility'; END IF;
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = NEW.role_id AND tenant_id = expected_tenant) THEN RAISE EXCEPTION 'course and visibility role tenants must match'; END IF;
  ELSIF TG_TABLE_NAME IN ('course_scenes', 'course_outlines', 'media_files', 'course_audio_blobs') THEN
    SELECT tenant_id INTO expected_tenant FROM courses WHERE id = NEW.course_id;
    NEW.tenant_id := expected_tenant;
  ELSIF TG_TABLE_NAME IN ('course_progress', 'assessment_attempts') THEN
    SELECT tenant_id INTO expected_tenant FROM users WHERE id = NEW.user_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'learning record and user tenants must match'; END IF;
  ELSIF TG_TABLE_NAME IN ('course_danmaku', 'forum_posts', 'forum_replies') THEN
    SELECT tenant_id INTO expected_tenant FROM users WHERE id = NEW.author_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'community content and author tenants must match'; END IF;
  ELSIF TG_TABLE_NAME = 'exam_policies' THEN
    SELECT tenant_id INTO expected_tenant FROM roles WHERE id = NEW.target_role_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'exam policy and target role tenants must match'; END IF;
  ELSIF TG_TABLE_NAME = 'exam_attempts' THEN
    SELECT tenant_id INTO expected_tenant FROM users WHERE id = NEW.user_id;
    IF expected_tenant IS DISTINCT FROM NEW.tenant_id OR NOT EXISTS (SELECT 1 FROM exam_policies WHERE id = NEW.exam_policy_id AND tenant_id = NEW.tenant_id) THEN RAISE EXCEPTION 'exam attempt ownership must match'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER users_tenant_role_guard AFTER INSERT OR UPDATE ON "users" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER invite_codes_tenant_role_guard AFTER INSERT OR UPDATE ON "invite_codes" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER courses_tenant_category_guard AFTER INSERT OR UPDATE ON "courses" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER course_visibility_roles_tenant_guard AFTER INSERT OR UPDATE ON "course_visibility_roles" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER course_progress_tenant_guard AFTER INSERT OR UPDATE ON "course_progress" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER assessment_attempts_tenant_guard AFTER INSERT OR UPDATE ON "assessment_attempts" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER course_danmaku_tenant_guard AFTER INSERT OR UPDATE ON "course_danmaku" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER forum_posts_tenant_guard AFTER INSERT OR UPDATE ON "forum_posts" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER forum_replies_tenant_guard AFTER INSERT OR UPDATE ON "forum_replies" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER exam_policies_tenant_guard AFTER INSERT OR UPDATE ON "exam_policies" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE CONSTRAINT TRIGGER exam_attempts_tenant_guard AFTER INSERT OR UPDATE ON "exam_attempts" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE TRIGGER course_scenes_inherit_tenant BEFORE INSERT OR UPDATE ON "course_scenes" FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE TRIGGER course_outlines_inherit_tenant BEFORE INSERT OR UPDATE ON "course_outlines" FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
CREATE TRIGGER media_files_inherit_tenant BEFORE INSERT OR UPDATE ON "media_files" FOR EACH ROW WHEN (NEW.course_id IS NOT NULL) EXECUTE FUNCTION enforce_tenant_relationships();
CREATE TRIGGER course_audio_blobs_inherit_tenant BEFORE INSERT OR UPDATE ON "course_audio_blobs" FOR EACH ROW EXECUTE FUNCTION enforce_tenant_relationships();
