-- Tenant-owned courses may use a platform fixed category.  The category remains
-- platform-owned, while the course scope/tenant_id controls visibility.
ALTER TABLE "course_categories" DROP CONSTRAINT IF EXISTS "course_categories_category_key_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "course_categories_tenant_key_unique";
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
    IF NEW.scope = 'platform' THEN
      IF NEW.tenant_id IS NOT NULL OR expected_scope IS DISTINCT FROM 'platform' THEN RAISE EXCEPTION 'platform course and category ownership must match'; END IF;
    ELSIF NEW.scope = 'tenant' THEN
      IF expected_scope IS DISTINCT FROM 'platform' AND expected_tenant IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'course and category ownership must match'; END IF;
      IF expected_scope IS DISTINCT FROM 'platform' AND expected_scope IS DISTINCT FROM 'tenant' THEN RAISE EXCEPTION 'tenant course and category scope must match'; END IF;
    ELSE
      RAISE EXCEPTION 'course scope must be platform or tenant';
    END IF;
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM course_categories AS category
    WHERE category.scope = 'tenant'
      AND category.category_key IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM course_categories AS platform_category
        WHERE platform_category.scope = 'platform'
          AND platform_category.category_key = category.category_key
      )
  ) THEN
    RAISE EXCEPTION 'platform fixed category is missing for a tenant category copy';
  END IF;
END;
$$;
--> statement-breakpoint
UPDATE courses AS course
SET category_id = platform_category.id
FROM course_categories AS tenant_category
JOIN course_categories AS platform_category
  ON platform_category.scope = 'platform'
 AND platform_category.category_key = tenant_category.category_key
WHERE course.category_id = tenant_category.id
  AND tenant_category.scope = 'tenant'
  AND tenant_category.category_key IS NOT NULL;
--> statement-breakpoint
UPDATE exam_policies AS policy
SET category_ids = mapped.category_ids
FROM LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN tenant_category.id IS NULL THEN category_id
        ELSE to_jsonb(platform_category.id::text)
      END
      ORDER BY ordinality
    ),
    '[]'::jsonb
  ) AS category_ids
  FROM jsonb_array_elements(policy.category_ids) WITH ORDINALITY AS elements(category_id, ordinality)
  LEFT JOIN course_categories AS tenant_category
    ON tenant_category.scope = 'tenant'
   AND tenant_category.category_key IS NOT NULL
   AND elements.category_id #>> '{}' = tenant_category.id::text
  LEFT JOIN course_categories AS platform_category
    ON platform_category.scope = 'platform'
   AND platform_category.category_key = tenant_category.category_key
) AS mapped
WHERE policy.category_ids IS NOT NULL;
--> statement-breakpoint
DELETE FROM course_categories
WHERE scope = 'tenant'
  AND category_key IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_categories"
  ADD CONSTRAINT "course_categories_category_key_check"
  CHECK (("scope" = 'platform' AND "category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy')) OR ("scope" = 'tenant' AND "category_key" IS NULL AND lower(btrim("name")) NOT IN ('管理知识培训', '专业知识培训', 'tob销售培训', 'toc销售培训', '公司制度培训')));
