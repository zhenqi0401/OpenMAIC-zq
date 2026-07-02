INSERT INTO roles (code, name, is_admin)
VALUES
  ('admin', '管理员', TRUE),
  ('learner', '学员', FALSE)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_admin = EXCLUDED.is_admin,
  updated_at = now();
