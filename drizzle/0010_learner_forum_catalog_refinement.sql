ALTER TABLE "course_danmaku" DROP CONSTRAINT "course_danmaku_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "course_danmaku" ADD CONSTRAINT "course_danmaku_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "course_categories" DROP CONSTRAINT "course_categories_category_key_check";
--> statement-breakpoint
WITH fixed(category_key, name, sort_order) AS (
  VALUES
    ('management', '管理知识培训', 10),
    ('professional', '专业知识培训', 20),
    ('tob-sales', 'ToB销售培训', 30),
    ('toc-sales', 'ToC销售培训', 40),
    ('company-policy', '公司制度培训', 50)
)
UPDATE "course_categories" AS category
SET "category_key" = fixed.category_key,
    "sort_order" = fixed.sort_order,
    "updated_at" = now()
FROM fixed
WHERE category."scope" = 'platform'
  AND category."name" = fixed.name
  AND category."category_key" IS NULL;
--> statement-breakpoint
WITH fixed(category_key, name, sort_order) AS (
  VALUES
    ('management', '管理知识培训', 10),
    ('professional', '专业知识培训', 20),
    ('tob-sales', 'ToB销售培训', 30),
    ('toc-sales', 'ToC销售培训', 40),
    ('company-policy', '公司制度培训', 50)
)
INSERT INTO "course_categories" ("tenant_id", "scope", "category_key", "name", "sort_order")
SELECT NULL, 'platform', fixed.category_key, fixed.name, fixed.sort_order
FROM fixed
WHERE NOT EXISTS (
  SELECT 1
  FROM "course_categories" AS category
  WHERE category."scope" = 'platform'
    AND category."category_key" = fixed.category_key
);
--> statement-breakpoint
WITH promoted AS (
  SELECT DISTINCT ON (audit."target_course_id")
    audit."target_course_id",
    source_category."category_key"
  FROM "platform_audit_log" AS audit
  JOIN "courses" AS source_course ON source_course."id" = audit."source_course_id"
  JOIN "course_categories" AS source_category ON source_category."id" = source_course."category_id"
  WHERE audit."operation" = 'course.promote'
    AND audit."result" = 'success'
    AND audit."target_course_id" IS NOT NULL
    AND source_category."category_key" IS NOT NULL
  ORDER BY audit."target_course_id", audit."created_at" DESC
)
UPDATE "courses" AS target
SET "category_id" = platform_category."id",
    "updated_at" = now()
FROM promoted, "course_categories" AS platform_category, "course_categories" AS current_category
WHERE target."id" = promoted."target_course_id"
  AND target."scope" = 'platform'
  AND platform_category."scope" = 'platform'
  AND platform_category."category_key" = promoted."category_key"
  AND current_category."id" = target."category_id"
  AND current_category."category_key" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "courses" AS course
    JOIN "course_categories" AS category ON category."id" = course."category_id"
    WHERE course."scope" = 'platform'
      AND category."category_key" IS NULL
  ) THEN
    RAISE EXCEPTION 'platform courses must be mapped to one of the five fixed categories before migration';
  END IF;
END;
$$;
--> statement-breakpoint
DELETE FROM "course_categories" AS category
WHERE category."scope" = 'platform'
  AND category."category_key" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "courses" AS course WHERE course."category_id" = category."id"
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "course_categories_platform_key_unique" ON "course_categories" ("category_key") WHERE "scope" = 'platform' AND "category_key" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_key_check" CHECK (("scope" = 'platform' AND "category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy')) OR ("scope" = 'tenant' AND (("category_key" IS NULL AND lower(btrim("name")) NOT IN ('管理知识培训', '专业知识培训', 'tob销售培训', 'toc销售培训', '公司制度培训')) OR "category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy'))));
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_view_count_check" CHECK ("view_count" >= 0);
--> statement-breakpoint
CREATE TABLE "forum_post_views" (
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forum_post_views_post_id_user_id_pk" PRIMARY KEY("post_id", "user_id")
);
--> statement-breakpoint
ALTER TABLE "forum_post_views" ADD CONSTRAINT "forum_post_views_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "forum_post_views" ADD CONSTRAINT "forum_post_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "forum_post_views_user_viewed_idx" ON "forum_post_views" ("user_id", "viewed_at");
