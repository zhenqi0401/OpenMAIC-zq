CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"role_snapshot" varchar(64) NOT NULL,
	"attempt_number" integer NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"threshold" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" varchar(128) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_progress" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"scene_index" integer DEFAULT 0 NOT NULL,
	"action_index" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_progress_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "course_visibility_roles" (
	"course_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "course_visibility_roles_course_id_role_id_pk" PRIMARY KEY("course_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"visibility_mode" varchar(16) DEFAULT 'all' NOT NULL,
	"stage_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generation_status" varchar(32) DEFAULT 'draft' NOT NULL,
	"generation_complete" boolean DEFAULT false NOT NULL,
	"assessment_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"exam_policy_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_snapshot" varchar(64) NOT NULL,
	"attempt_number" integer NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"threshold" integer NOT NULL,
	"duration" integer,
	"answers" jsonb NOT NULL,
	"details" jsonb NOT NULL,
	"question_refs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" text NOT NULL,
	"target_role_id" uuid NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question_count" integer NOT NULL,
	"time_limit" integer,
	"pass_threshold" integer DEFAULT 80 NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_policy_courses" (
	"exam_policy_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "exam_policy_courses_exam_policy_id_course_id_pk" PRIMARY KEY("exam_policy_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "host_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"key_id" varchar(128) NOT NULL,
	"secret_hash" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_origins" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "host_api_keys_key_id_unique" UNIQUE("key_id")
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"code_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"course_id" uuid,
	"scene_id" uuid,
	"scene_key" varchar(128),
	"media_id" varchar(128) NOT NULL,
	"media_type" varchar(32) NOT NULL,
	"mime_type" varchar(128),
	"size_bytes" integer,
	"prompt" text,
	"params" jsonb,
	"blob" bytea NOT NULL,
	"poster_blob" bytea,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_audio_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"course_id" uuid NOT NULL,
	"scene_key" varchar(128),
	"audio_id" varchar(128) NOT NULL,
	"mime_type" varchar(128),
	"size_bytes" integer NOT NULL,
	"text" text,
	"voice" varchar(128),
	"blob" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_outlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"course_id" uuid NOT NULL,
	"outline" jsonb NOT NULL,
	"generation_status" varchar(32) DEFAULT 'draft' NOT NULL,
	"generation_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "course_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"course_id" uuid NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"phone" varchar(32),
	"password_hash" text,
	"host_user_id" varchar(128),
	"role_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_host_user_id_unique" UNIQUE("host_user_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_visibility_roles" ADD CONSTRAINT "course_visibility_roles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_visibility_roles" ADD CONSTRAINT "course_visibility_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_course_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."course_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_policy_id_exam_policies_id_fk" FOREIGN KEY ("exam_policy_id") REFERENCES "public"."exam_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_policies" ADD CONSTRAINT "exam_policies_target_role_id_roles_id_fk" FOREIGN KEY ("target_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_policy_courses" ADD CONSTRAINT "exam_policy_courses_exam_policy_id_exam_policies_id_fk" FOREIGN KEY ("exam_policy_id") REFERENCES "public"."exam_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_policy_courses" ADD CONSTRAINT "exam_policy_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_scene_id_course_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."course_scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_audio_blobs" ADD CONSTRAINT "course_audio_blobs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_outlines" ADD CONSTRAINT "course_outlines_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_scenes" ADD CONSTRAINT "course_scenes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_attempts_user_course_idx" ON "assessment_attempts" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "course_audio_blobs_course_id_idx" ON "course_audio_blobs" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_audio_blobs_course_audio_id_idx" ON "course_audio_blobs" USING btree ("course_id","audio_id");--> statement-breakpoint
CREATE INDEX "courses_category_id_idx" ON "courses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "courses_status_idx" ON "courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exam_attempts_policy_user_idx" ON "exam_attempts" USING btree ("exam_policy_id","user_id");--> statement-breakpoint
CREATE INDEX "invite_codes_role_id_idx" ON "invite_codes" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "media_files_course_id_idx" ON "media_files" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_course_media_id_idx" ON "media_files" USING btree ("course_id","media_id");--> statement-breakpoint
CREATE INDEX "course_scenes_course_id_idx" ON "course_scenes" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_scenes_course_scene_key_idx" ON "course_scenes" USING btree ("course_id","scene_key");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_host_user_id_idx" ON "users" USING btree ("host_user_id");
