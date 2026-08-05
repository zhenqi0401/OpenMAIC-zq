ALTER TABLE "course_categories" ADD COLUMN "category_key" varchar(32);
--> statement-breakpoint
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_key_check" CHECK ("category_key" IS NULL OR ("scope" = 'tenant' AND "category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy')));
--> statement-breakpoint
CREATE UNIQUE INDEX "course_categories_tenant_key_unique" ON "course_categories" ("tenant_id", "category_key") WHERE "scope" = 'tenant' AND "category_key" IS NOT NULL;
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
SET "category_key" = fixed.category_key, "updated_at" = now()
FROM fixed
WHERE category."scope" = 'tenant'
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
SELECT tenant."id", 'tenant', fixed.category_key, fixed.name, fixed.sort_order
FROM "tenants" AS tenant
CROSS JOIN fixed
WHERE NOT EXISTS (
  SELECT 1 FROM "course_categories" AS category
  WHERE category."tenant_id" = tenant."id"
    AND category."scope" = 'tenant'
    AND category."category_key" = fixed.category_key
);
--> statement-breakpoint
CREATE TABLE "host_sso_login_exchanges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_hash" text NOT NULL,
  "request_id_hash" text NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "category_key" varchar(32) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "host_sso_login_exchanges_category_key_check" CHECK ("category_key" IN ('management', 'professional', 'tob-sales', 'toc-sales', 'company-policy'))
);
--> statement-breakpoint
ALTER TABLE "host_sso_login_exchanges" ADD CONSTRAINT "host_sso_login_exchanges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "host_sso_login_exchanges" ADD CONSTRAINT "host_sso_login_exchanges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
--> statement-breakpoint
CREATE UNIQUE INDEX "host_sso_login_exchanges_code_hash_unique" ON "host_sso_login_exchanges" ("code_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "host_sso_login_exchanges_request_id_hash_unique" ON "host_sso_login_exchanges" ("request_id_hash");
--> statement-breakpoint
CREATE INDEX "host_sso_login_exchanges_expires_at_idx" ON "host_sso_login_exchanges" ("expires_at");
