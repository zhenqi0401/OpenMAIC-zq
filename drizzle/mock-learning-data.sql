-- 本地/演示环境专用：为角色必修路径、课程学习状态和学习数据抽屉提供可重复的展示数据。
-- 不要在生产环境执行；执行前请先完成 drizzle migrations。

INSERT INTO roles (id, tenant_id, code, name, is_admin)
VALUES
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'demo-admin', '演示管理员', TRUE),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'sales', '销售顾问', FALSE),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'operations', '运营专员', FALSE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_admin = EXCLUDED.is_admin, updated_at = now();

-- 演示学员不用于登录，不写手机号，避免与现有租户用户的全局唯一手机号冲突。
INSERT INTO users (id, tenant_id, role_id, status, display_name)
VALUES
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'active', '林晓晨'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'active', '周子涵'),
  ('10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'active', '陈思远'),
  ('10000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'active', '赵安然')
ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, status = EXCLUDED.status, display_name = EXCLUDED.display_name, updated_at = now();

INSERT INTO course_categories (id, tenant_id, scope, name, sort_order)
VALUES ('10000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001', 'tenant', '演示课程', 10)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

INSERT INTO courses (
  id, tenant_id, scope, name, description, category_id, status, visibility_mode,
  stage_snapshot, generation_status, generation_complete, assessment_questions, published_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', 'tenant',
    '客户需求澄清基础', '演示必修课程：用于展示学习中、待通过测评和已完成状态。',
    '10000000-0000-4000-8000-000000000020', 'published', 'all', '{}', 'ready', TRUE,
    '[{"id":"q1","type":"single","question":"需求澄清的第一步是什么？","options":[{"value":"A","label":"确认目标"},{"value":"B","label":"直接报价"}],"answer":["A"],"points":100}]'::jsonb,
    now() - interval '18 days'
  ),
  (
    '10000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', 'tenant',
    '销售异议处理实战', '演示必修课程：用于展示测评失败后的重新学习和重试数据。',
    '10000000-0000-4000-8000-000000000020', 'published', 'all', '{}', 'ready', TRUE,
    '[{"id":"q1","type":"single","question":"处理异议时更适合先做什么？","options":[{"value":"A","label":"复述并确认顾虑"},{"value":"B","label":"立即打断"}],"answer":["A"],"points":100}]'::jsonb,
    now() - interval '12 days'
  ),
  (
    '10000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000001', 'tenant',
    '运营复盘方法', '演示选修课程：用于展示选修标签和社会证明人数。',
    '10000000-0000-4000-8000-000000000020', 'published', 'all', '{}', 'ready', TRUE,
    '[{"id":"q1","type":"single","question":"复盘应优先关注什么？","options":[{"value":"A","label":"事实与行动"},{"value":"B","label":"个人归因"}],"answer":["A"],"points":100}]'::jsonb,
    now() - interval '8 days'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
  generation_status = EXCLUDED.generation_status, generation_complete = EXCLUDED.generation_complete,
  assessment_questions = EXCLUDED.assessment_questions, updated_at = now();

INSERT INTO course_scenes (id, tenant_id, course_id, scene_key, type, title, scene_order, scene_data, content)
VALUES
  ('10000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000201', 'demo-cover-201', 'slide', '客户需求澄清基础', 0, '{}', '{"type":"slide","canvas":{"background":"#eef2ff","elements":[]}}'),
  ('10000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000202', 'demo-cover-202', 'slide', '销售异议处理实战', 0, '{}', '{"type":"slide","canvas":{"background":"#fff7ed","elements":[]}}'),
  ('10000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000203', 'demo-cover-203', 'slide', '运营复盘方法', 0, '{}', '{"type":"slide","canvas":{"background":"#ecfdf5","elements":[]}}')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = now();

INSERT INTO role_learning_path_courses (role_id, course_id, tenant_id, position)
VALUES
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', 0),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', 1),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', 0)
ON CONFLICT (role_id, course_id) DO UPDATE SET position = EXCLUDED.position, updated_at = now();

INSERT INTO course_progress (tenant_id, user_id, course_id, scene_index, action_index, completed, completed_at, started_at, last_viewed_at, updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000201', 0, 1, FALSE, NULL, now() - interval '6 days', now() - interval '2 hours', now() - interval '2 hours'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000201', 1, 0, TRUE, now() - interval '3 days', now() - interval '10 days', now() - interval '3 days', now() - interval '3 days'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000201', 1, 0, TRUE, now() - interval '1 day', now() - interval '5 days', now() - interval '1 day', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000202', 1, 0, TRUE, now() - interval '4 hours', now() - interval '4 days', now() - interval '4 hours', now() - interval '4 hours'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000203', 0, 0, FALSE, NULL, now() - interval '1 day', now() - interval '3 hours', now() - interval '3 hours')
ON CONFLICT (user_id, course_id) DO UPDATE SET
  scene_index = EXCLUDED.scene_index, action_index = EXCLUDED.action_index, completed = EXCLUDED.completed,
  completed_at = EXCLUDED.completed_at, started_at = EXCLUDED.started_at, last_viewed_at = EXCLUDED.last_viewed_at, updated_at = EXCLUDED.updated_at;

INSERT INTO assessment_attempts (id, tenant_id, user_id, course_id, role_snapshot, attempt_number, score, passed, threshold, answers, details, created_at)
VALUES
  ('10000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000201', 'sales', 1, 100, TRUE, 80, '{"q1":"A"}', '[]', now() - interval '3 days'),
  ('10000000-0000-4000-8000-000000000402', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000201', 'operations', 1, 80, TRUE, 80, '{"q1":"A"}', '[]', now() - interval '1 day'),
  ('10000000-0000-4000-8000-000000000403', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000202', 'sales', 1, 40, FALSE, 80, '{"q1":"B"}', '[]', now() - interval '2 days'),
  ('10000000-0000-4000-8000-000000000404', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000202', 'sales', 2, 100, TRUE, 80, '{"q1":"A"}', '[]', now() - interval '4 hours')
ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, passed = EXCLUDED.passed, attempt_number = EXCLUDED.attempt_number, created_at = EXCLUDED.created_at;
