INSERT INTO tenants (id, company_id, name, type, status)
VALUES ('00000000-0000-4000-8000-000000000001', 'internal:meishi-ai', '美视智能', 'internal', 'active')
ON CONFLICT (company_id) DO UPDATE
SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now();

INSERT INTO roles (tenant_id, code, name, is_admin)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin', '管理员', TRUE),
  ('00000000-0000-4000-8000-000000000001', 'learner', '学员', FALSE)
ON CONFLICT (tenant_id, code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_admin = EXCLUDED.is_admin,
  updated_at = now();
