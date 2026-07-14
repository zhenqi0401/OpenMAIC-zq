INSERT INTO "course_categories" ("name", "sort_order")
SELECT defaults.name, defaults.sort_order
FROM (
  VALUES
    ('员工手册', 10),
    ('公司规范规章制度', 20),
    ('新员工入职', 30)
) AS defaults(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM "course_categories"
  WHERE "course_categories"."name" = defaults.name
);
