-- Fixed 精品课程 categories are platform-owned and shared by every tenant.
-- Tenant copies must be unused before they can be removed safely.
ALTER TABLE "course_categories" DROP CONSTRAINT "course_categories_category_key_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "course_categories_tenant_key_unique";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "courses" AS course
    JOIN "course_categories" AS category ON category."id" = course."category_id"
    WHERE category."scope" = 'tenant' AND category."category_key" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'tenant courses still reference tenant copies of fixed platform categories';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "exam_policies" AS policy
    JOIN "course_categories" AS category ON policy."category_ids" ? category."id"::text
    WHERE category."scope" = 'tenant' AND category."category_key" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'exam policies still reference tenant copies of fixed platform categories';
  END IF;
END;
$$;
--> statement-breakpoint
DELETE FROM "course_categories"
WHERE "scope" = 'tenant' AND "category_key" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_categories"
  ADD CONSTRAINT "course_categories_category_key_check"
  CHECK (("scope" = 'platform' AND "category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy')) OR ("scope" = 'tenant' AND "category_key" IS NULL AND lower(btrim("name")) NOT IN ('管理知识培训', '专业知识培训', 'tob销售培训', 'toc销售培训', '公司制度培训')));
