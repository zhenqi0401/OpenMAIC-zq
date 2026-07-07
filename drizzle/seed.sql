INSERT INTO roles (code, name, is_admin)
VALUES
  ('admin', '管理员', TRUE),
  ('learner', '学员', FALSE)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_admin = EXCLUDED.is_admin,
  updated_at = now();

WITH admin_role AS (
  SELECT roles.id
  FROM roles
  WHERE roles.code = 'admin'
)
INSERT INTO users (phone, password_hash, role_id, status, display_name)
SELECT
  '13900000000',
  'scrypt$6f70656e6d6169632d746573742d7631$8aa98f14b98e97741ccc2ac552e85379e0c27e9377fa52a1c5b378e32dd16fc3b80364f619d3d4d3484cec58f1ea9c7dcdf9aac3a8608d48e6df682a7685d983',
  admin_role.id,
  'active',
  '测试管理员'
FROM admin_role
ON CONFLICT (phone) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role_id = EXCLUDED.role_id,
  status = EXCLUDED.status,
  display_name = EXCLUDED.display_name,
  updated_at = now();
