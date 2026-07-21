# 技术设计：OpenMAIC 企业课程与考核平台
> 版本 v0.11 · 2026-07-14 · 主人文档（怎么做）。上游：`docs/PRD.md`。下游引用请用 ARCH-ID。
> v0.11 变更：补充后台客户端分页、首页唯一课程草稿入口、阶段考核长课程范围选择及草稿并发安全删除方案。
> v0.10 变更：新增学员端企业课程分类筛选契约、三个默认分类数据迁移及空分类常驻展示方案。
> v0.9 变更：学员注册 API 补充 `name`，规范化后写入 `users.display_name`；认证页按生产双栏原型补齐字段校验和响应式交互。
> v0.8 变更：新增角色化学员首页、本地 ZIP 课程隔离、学员生成页路由门控和阶段考核响应式覆盖层方案。
> v0.7 变更：CHANGE-01 不再启用 OSS；课程相关视频、图片、音频和生成内容全部以 PostgreSQL 为权威存储。
> v0.6 变更：按 CHANGE-01 重划课程存储边界；PostgreSQL 成为课程列表、课程内容、课程草稿和音频 Blob 的唯一权威源，IndexedDB 降级为浏览器运行态。
> v0.5 变更：补充后台管理 UI 闭环，明确角色、邀请码、用户角色和后台首页看板必须有前端入口；新增 SLICE-08 作为 API 之后的后台补全切片。
> v0.4 变更：身份权威改为 OpenMAIC 自有账号；宿主 SSO 只做管理员账号绑定；新增最小管理员后台、课程可见范围、邀请码、阶段考核发布、OpenMAIC 看板和宿主查询 API；后端为权威数据源。

## 1. 技术栈选型

| 层 | 选型 | 理由 | 满足需求 |
|---|---|---|---|
| 框架 | Next.js App Router（现有） | 复用当前前后端一体结构，API Routes 可承载企业后端 | 全部 |
| 前端状态 | React + Zustand（现有） | 复用当前课程生成、课堂和 Pro Mode 状态模式 | REQ-001~005 |
| 本地运行态 | Dexie / IndexedDB（现有） | 保存浏览器运行态和独立 ZIP 本地课程；不保存企业课程内容，不改变现有 schema | REQ-025, REQ-050, REQ-052 |
| 数据库 | PostgreSQL（新增） | 课程、场景、大纲、课程媒体 Blob、账号、角色、可见范围、测评/考核结果需要后端权威存储与结构化查询 | REQ-017~020, REQ-030, REQ-047, REQ-048 |
| ORM | Drizzle ORM（新增） | 类型安全、轻量、适合 Next.js API Routes | REQ-019 |
| 课程媒体存储 | PostgreSQL bytea / 媒体分表 | CHANGE-01 期间不启用 OSS；视频、图片、音频等课程相关 Blob 全部通过 PostgreSQL 保存，并通过后端鉴权接口读取 | REQ-018, REQ-024 |
| 鉴权 | 签名会话 cookie + 宿主 API Key/Secret | OpenMAIC 自有用户会话；宿主后端查询 API 单独鉴权 | REQ-023, REQ-046 |
| 嵌入通信 | iframe + postMessage | 只做前端即时通知/控制，权威数据走后端 API | REQ-013~016 |

## 2. 架构决策

**ARCH-001** iframe 嵌入模式（REQ-013~016, REQ-021, REQ-022）
- OpenMAIC 可独立访问，也可被宿主 iframe 嵌入。
- postMessage 仅保留 `init`、`load-course`、`quiz-result`、`course-completed`、`exam-result` 等即时消息。
- postMessage 不作为登录凭证，也不作为宿主看板权威数据源。

**ARCH-002** 课程生成与编辑复用原生能力（REQ-001~005）
- 大纲生成完成后默认停留在现有大纲预览/编辑阶段。
- 大纲确认后沿用现有完整课程和媒体生成链路。
- 课程生成后编辑统一复用 Pro Mode / AI 编辑助手 / quiz surface，只新增权限门控。

**ARCH-003** 后端为企业业务权威数据源（REQ-017~020, REQ-025, REQ-047, REQ-048, REQ-050, REQ-052）
- PostgreSQL 是课程列表、课程草稿、课程内容、课程媒体 Blob、学习进度、测评和考核结果的唯一权威源。
- 视频、图片、音频等课程相关 Blob 全部存 PostgreSQL；CHANGE-01 不引入 OSS 课程媒体存储。
- IndexedDB 保存浏览器运行态和独立 ZIP 本地课程，不保存企业课程列表、课程草稿、企业课程场景、大纲或媒体 Blob。
- 不再做 IndexedDB 课程内容与后端课程内容的双向同步；管理员保存/发布必须成功写 PostgreSQL。

**ARCH-004** OpenMAIC 自有账号体系（REQ-026, REQ-027, REQ-033~036）
- OpenMAIC 自己维护用户、角色、邀请码和权限。
- 学员用姓名 + 手机号 + 密码 + 邀请码注册；姓名写入账号显示名，邀请码决定初始角色。
- 宿主 SSO 传 `hostUserId`，OpenMAIC 自动创建/绑定管理员用户。
- 首版单租户，管理员拥有全系统管理权限。

**ARCH-005** 课程可见范围与发布（REQ-037~041）
- 课程创建后为草稿；发布后才进入学员课程列表。
- AI 课程生成开始前必须先创建 PostgreSQL 课程草稿并绑定分类；分类是后台管理和阶段考核筛选字段。
- `POST /api/admin/courses` 继续作为首页生成链路的建稿接口；后台课程管理仅消费列表、更新、发布、下架、可见范围和删除能力，不直接创建课程草稿。
- 课程可见范围为 `all` 或 `roles`。
- 学员课程列表由服务端按发布状态和当前用户角色过滤。

**ARCH-006** 课后测评门控（REQ-006~009, REQ-042, REQ-043）
- 课后测评独立于课内 quiz，题型首版仅单选/多选。
- 每次提交都落库，记录 attemptNumber、score、passed、answers、details、roleSnapshot。
- 不通过时重置课程播放进度，必须重新完成课程后再次测评。
- 课程内容变更后给管理员提示，可手动重生成或编辑测评题。

**ARCH-007** 阶段考核由 OpenMAIC 管理员发布（REQ-010~012, REQ-028~032）
- 管理员按角色配置阶段考核策略：分类范围、课程范围、题量、时限、通过阈值。
- 课程范围使用 `Popover + Command` 搜索多选，仅列出所选分类内的已发布课程；`courseIds = []` 表示所选分类下全部课程，分类变化时清空具体课程选择。
- 题源来自课内 quiz + 课后测评题，但只抽单选/多选，简答题过滤。
- 发布后符合角色的学员在 OpenMAIC 中看到考核任务并参加。
- 草稿可发布或删除，已发布可下架为 `archived`，已归档可重新发布；已发布和已归档策略禁止删除。

**ARCH-008** 宿主查询集成（REQ-044~046）
- OpenMAIC 管理后台首页展示精简看板。
- 宿主看板通过 OpenMAIC 查询 API 获取数据，不直连数据库，不接收回调。
- 宿主查询 API 用服务端 API Key/Secret 鉴权，禁止前端暴露密钥。

**ARCH-009** 管理后台 UI 闭环（REQ-034, REQ-035, REQ-044）
- 管理后台不仅暴露 `/api/admin/*`，还必须提供前端可操作入口。
- 后台首页先展示精简看板摘要和明细入口，再提供角色、邀请码、用户角色和课程管理区域。
- 角色管理消费 `ARCH-032` 的角色 API；邀请码管理消费 `ARCH-032` 的邀请码 API；看板消费 `ARCH-032` 的 dashboard API。
- 首版只做单页后台分区，不引入复杂侧边栏、组织树或多租户管理。
- 看板学员明细和课程管理列表均在客户端对完整 API 结果按每页 10 条分页；应用或重置筛选回到第一页，刷新、删除和数据减少时由共享分页计算钳制当前页，不改变现有 API。

## 3. 数据模型

**ARCH-010** `users` — OpenMAIC 用户（REQ-026, REQ-033, REQ-035）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 用户 ID |
| phone | VARCHAR(32), UNIQUE, NULL | 学员手机号；宿主 SSO 管理员可为空 |
| password_hash | TEXT, NULL | 本地账号密码 hash；SSO 管理员可为空 |
| host_user_id | VARCHAR(128), UNIQUE, NULL | 宿主 SSO 绑定键 |
| role_id | UUID FK | 当前单一角色 |
| status | VARCHAR(16) | active / disabled |
| display_name | VARCHAR(128) | 显示名；学员注册时来自 `name` |
| created_at / updated_at | TIMESTAMPTZ | 时间 |

**ARCH-011** `roles` — 内部角色（REQ-027, REQ-035）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 角色 ID |
| code | VARCHAR(64), UNIQUE | 角色标识 |
| name | VARCHAR(128) | 角色名称 |
| is_admin | BOOLEAN | 是否管理员角色 |
| created_at / updated_at | TIMESTAMPTZ | 时间 |

**ARCH-012** `invite_codes` — 邀请码（REQ-034）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 邀请码记录 |
| code_hash | TEXT UNIQUE | 邀请码 hash，不明文存储 |
| role_id | UUID FK | 注册后绑定角色 |
| enabled | BOOLEAN | 是否启用 |
| expires_at | TIMESTAMPTZ, NULL | 过期时间 |
| created_by | UUID FK | 创建管理员 |
| created_at | TIMESTAMPTZ | 创建时间 |

**ARCH-013** `courses` — 课程元数据（REQ-017, REQ-037~041）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 课程 ID |
| name / description | TEXT | 课程基本信息 |
| category_id | UUID FK | 课程分类 |
| status | VARCHAR(16) | draft / published / archived |
| visibility_mode | VARCHAR(16) | all / roles |
| stage_snapshot | JSONB | 可还原课堂运行所需的 Stage 元数据 |
| generation_status / generation_complete | VARCHAR / BOOLEAN | 课程生成进度和完成状态 |
| assessment_questions | JSONB | 课后测评题 QuizQuestion[]，只保留单选/多选 |
| created_by | UUID FK | 创建管理员 |
| published_at | TIMESTAMPTZ, NULL | 发布时间 |
| created_at / updated_at | TIMESTAMPTZ | 时间 |

**ARCH-014** `course_visibility_roles` — 课程角色可见范围（REQ-039~041）

| 字段 | 类型 | 说明 |
|---|---|---|
| course_id | UUID FK | 课程 |
| role_id | UUID FK | 可见角色 |

**ARCH-015** `course_categories` — 课程分类（REQ-037, REQ-031）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 分类 ID |
| name | VARCHAR(128) | 分类名称 |
| sort_order | INTEGER | 排序 |
| created_at / updated_at | TIMESTAMPTZ | 时间 |

**ARCH-016** `course_scenes` / `course_outlines` / `media_files` / `course_audio_blobs` — 课程内容（REQ-017, REQ-018, REQ-024, REQ-047）
- `course_scenes` 保存每个可播放 Scene 的完整 JSONB 快照，同时保留 `course_id`、`scene_key`、`scene_order`、`type`、`title` 等可查询字段。
- `course_outlines` 保存完整 SceneOutline[]、`generation_complete` 和更新时间。
- `media_files` 保存视频、图片等课程媒体 Blob 及其元数据：`course_id`、`scene_key`、`media_id`、type、mime、size、prompt、params、bytea blob、poster_bytea、created_at；不保存 OSS key。
- `course_audio_blobs` 保存课程音频 Blob：`course_id`、`scene_key`、`audio_id`、mime、size、text、voice、bytea blob、created_at。
- 课堂读取接口必须能直接还原 `{ course, stage, scenes, outlines, mediaManifest, audioManifest }`，前端不再从 IndexedDB 读取课程内容。

**ARCH-017** `course_progress` — 学习进度（REQ-008, REQ-041）

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id / course_id | UUID | 联合唯一 |
| scene_index / action_index | INTEGER | 播放位置 |
| completed | BOOLEAN | 是否完成学习部分 |
| completed_at | TIMESTAMPTZ, NULL | 完成时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**ARCH-018** `assessment_attempts` — 课后测评记录（REQ-006~009, REQ-030, REQ-042）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 尝试记录 |
| user_id / course_id | UUID | 学员和课程 |
| role_snapshot | VARCHAR(64) | 提交时角色 |
| attempt_number | INTEGER | 第几次提交 |
| score | INTEGER | 0-100 |
| passed | BOOLEAN | 是否通过 |
| threshold | INTEGER | 通过阈值 |
| answers / details | JSONB | 答案和逐题结果 |
| created_at | TIMESTAMPTZ | 提交时间 |

**ARCH-019** `exam_policies` / `exam_policy_courses` — 阶段考核策略（REQ-012, REQ-031）
- `exam_policies`：title、target_role_id、category_ids、question_count、time_limit、pass_threshold、status。
- `exam_policy_courses`：策略选择的课程；为空时表示策略分类下全部已发布课程。

**ARCH-020** `exam_attempts` — 阶段考核记录（REQ-010, REQ-011, REQ-032）
- 结构与 `assessment_attempts` 类似，额外保存 `exam_policy_id`、duration、question_refs。

**ARCH-021** `host_api_keys` — 宿主查询 API Key（REQ-045, REQ-046）
- 保存 keyId、secretHash、enabled、allowedOrigins/notes、createdAt、lastUsedAt。

## 4. API 契约

**ARCH-030** 自有账号 API（REQ-026, REQ-034）
- `POST /api/auth/register`：`{ name, phone, password, inviteCode }` → 将规范化姓名写入 `users.display_name`，创建学员账号并登录。
- `POST /api/auth/login`：`{ phone, password }` → 登录。
- `POST /api/auth/logout`：注销。
- `GET /api/auth/session`：返回当前用户、角色和权限。

**ARCH-031** 宿主 SSO 管理员绑定（REQ-033）
- `POST /api/auth/host-sso`：宿主后端用签名请求提交 `{ hostUserId, displayName, phone, timestamp }`；签名原文为按该字段顺序序列化、无额外空白的紧凑 JSON，`timestamp` 为 Unix 秒。
- 若未绑定则用宿主姓名、手机号创建管理员用户；若已绑定则同步姓名、手机号并返回 OpenMAIC 会话交换结果。
- 该接口只用于宿主入口，不用于学员注册。

**ARCH-032** 管理后台 API（REQ-035~041, REQ-044, REQ-047, REQ-048）
- 角色：`GET/POST/PATCH /api/admin/roles`
- 邀请码：`GET/POST/PATCH /api/admin/invite-codes`
- 用户：`GET /api/admin/users`、`PATCH /api/admin/users/:id/role`
- 分类：`GET/POST/PATCH /api/admin/categories`
- 课程：`GET /api/admin/courses`、`POST /api/admin/courses`、`GET/PATCH /api/admin/courses/:id/content`、`PATCH /api/admin/courses/:id/visibility`、`POST /api/admin/courses/:id/publish`、`POST /api/admin/courses/:id/archive`
- 看板：`GET /api/admin/dashboard`

**ARCH-033** 学员课程 API（REQ-041, REQ-047, REQ-055）
- `GET /api/courses`：返回 `{ success, courses, categories }`。`courses` 按当前用户角色返回已发布可见课程并保留 `categoryId/categoryName`；`categories` 返回全部后台分类 `{ id, name, sortOrder }[]`，不按课程可见性裁剪。
- `GET /api/courses/:id`：从 PostgreSQL 加载可见课程完整内容；无权限返回 403。响应形状为：
  ```ts
  {
    course: EnterpriseCourse,
    stage: Stage,
    scenes: Scene[],
    outlines: SceneOutline[],
    mediaManifest: Array<{ mediaId: string; url: string; type: 'image' | 'video'; mimeType: string; sizeBytes: number }>,
    audioManifest: Array<{ audioId: string; url: string; mimeType: string; sizeBytes: number }>
  }
  ```
- `PATCH /api/courses/:id/progress`：保存学习进度。
- `GET /api/courses/:id/media/:mediaId`：鉴权后流式返回课程视频/图片 Blob；普通学员仅可读取自己可见课程的媒体。
- `GET /api/courses/:id/audio/:audioId`：鉴权后流式返回课程音频 Blob；普通学员仅可读取自己可见课程的音频。

**ARCH-034** 课后测评 API（REQ-006~009, REQ-042, REQ-043）
- `GET /api/courses/:id/assessment`：获取课后测评题。
- `POST /api/courses/:id/assessment/attempts`：提交答案并评分；只接受单选/多选题。
- `POST /api/admin/courses/:id/assessment/regenerate`：管理员手动重生成测评题。

**ARCH-035** 阶段考核 API（REQ-010~012, REQ-031, REQ-032）
- `GET/POST/PATCH /api/admin/exam-policies`：管理员维护考核策略。
- `PATCH /api/admin/exam-policies/:id` 提交 `{ status: "archived" }` 下架已发布考核。
- `DELETE /api/admin/exam-policies/:id`：仅删除草稿；不存在返回 404，非草稿返回 409，成功返回被删除策略。
- `POST /api/admin/exam-policies/:id/publish`：发布考核。
- `GET /api/exams`：学员获取可参加考核。
- `POST /api/exams/:id/start`：服务端按策略抽单选/多选题组卷。
- `POST /api/exams/:id/attempts`：提交并评分。

**ARCH-036** 宿主查询 API（REQ-045, REQ-046）
- `GET /api/host/summary`：课程、测评、考核汇总。
- `GET /api/host/courses/:id/progress`：课程学习明细。
- `GET /api/host/assessments`：课后测评尝试记录。
- `GET /api/host/exams`：阶段考核尝试记录。
- 鉴权：`Authorization: Bearer <apiKey>` 或 `X-OpenMAIC-Key`；服务端只保存 hash。

## 5. 模块地图

| 模块 | 职责 | 不做什么 | 满足需求 |
|---|---|---|---|
| auth | 自有登录、注册、会话、宿主 SSO 绑定 | 不接短信验证码 | REQ-026, REQ-033 |
| admin | 后台首页看板、角色/邀请码/用户角色/分类/课程/考核策略管理 UI，并消费管理 API | 不做复杂组织架构、多租户后台或 BI 报表 | REQ-034~041, REQ-044 |
| course-authoring | 大纲确认、Pro Mode 权限门控、发布/可见范围 | 不做新编辑器 | REQ-001~005 |
| storage | PostgreSQL 课程权威存储、课程媒体 Blob 存储、课程读取契约 | 不让宿主直连 DB；不再做 IndexedDB 课程内容同步；CHANGE-01 不接入 OSS | REQ-017~025, REQ-047, REQ-048 |
| assessment | 课后测评题生成、单选/多选评分、重学门控 | 不做主观题评分 | REQ-006~009, REQ-042 |
| exam | 阶段考核策略、抽题、发布、提交评分 | 不生成新题 | REQ-010~012, REQ-028~032 |
| embed | iframe/postMessage 即时通信 | 不承载权威数据 | REQ-013~016 |
| host-api | 宿主查询 API 和 API Key 鉴权 | 不做回调 | REQ-045~046 |
| learner-home | 按身份分流首页、合并课程来源、企业课程分类筛选、本地课程管理和阶段考核入口 | 不生成课程，不上传或同步本地课程 | REQ-049~055 |

## 6. 关键技术方案

**ARCH-039** 后台 UI 与 API 完成口径
- `REQ-035` 与 `REQ-044` 的完成口径是“API + 管理员可操作前端入口”。
- 角色、邀请码和看板 API 可在 `SLICE-01` 先完成，但 UI 闭环由 `SLICE-08` 消费这些 API 补齐。
- 用户角色修改不得长期依赖手填 `roleId`；后台 UI 应使用角色列表下拉选择。
- 课程列表不提供手工建稿表单，主列表说明课程来自首页生成；右侧仅保留分类维护和发布结构摘要。
- 阶段考核表单和列表必须为考核名称、目标角色、题量、通过线、限时、题源范围、候选题、状态和操作提供可见字段标题，不依赖 placeholder 解释数据。
- 阶段考核草稿删除由仓储使用 `id + status = draft` 条件执行，课程映射依赖现有外键级联清理；条件删除失败后再区分 404 与 409，避免并发状态变化误删已发布或已归档策略。

**ARCH-040** 邀请码安全
- 邀请码只展示一次明文，数据库保存 hash。
- 注册时校验启用状态、过期时间和绑定角色。
- 邀请码只决定初始角色，后续岗位变更由管理员修改用户角色。

**ARCH-041** 课程可见范围过滤
- `visibility_mode = all`：所有学员可见。
- `visibility_mode = roles`：当前用户 `role_id` 命中 `course_visibility_roles` 才可见。
- 草稿/下架课程只对管理员可见。

**ARCH-045** 课程生成持久化流程（REQ-017, REQ-037, REQ-047, REQ-048）
- 首页生成入口在进入生成流程前必须确认当前用户具备课程管理权限，并要求选择课程分类。
- 生成第一步创建 `courses` 草稿和 `stage_snapshot`；失败则不进入企业课程生成。
- 每生成一个 Scene 后写入 `course_scenes`，并更新 `course_outlines`、`stage_snapshot.currentSceneId`、`generation_status`。
- 视频和图片生成完成后写入 `media_files` 的 PostgreSQL Blob 字段，Scene 中保留稳定 `mediaId`。
- TTS 生成完成后写入 `course_audio_blobs`，Scene 中保留稳定 `audioId`。
- 生成完成后设置 `generation_complete = true`；后台课程管理页读取 PostgreSQL 后即可看到该课程草稿。

**ARCH-046** IndexedDB 运行态边界（REQ-025, REQ-047, REQ-050, REQ-052）
- IndexedDB 可保存设置、表单草稿、临时 UI 状态、播放引擎瞬时状态、当前会话恢复标记和独立 ZIP 本地课程。
- 企业课程列表、课程草稿、课程场景、课程大纲、课程媒体 Blob 不进入 IndexedDB。
- `/classroom/:id` 根据首页课程来源加载：企业课程按 PostgreSQL `course_id` 读取，本地课程沿用 IndexedDB；两者不做双向同步。

**ARCH-047** 课程媒体 Blob 存储约束（REQ-018, REQ-024）
- `media_files.blob` 和 `course_audio_blobs.blob` 使用 PostgreSQL bytea 存储，分别按 `course_id + media_id`、`course_id + audio_id` 唯一。
- 写入前校验单条媒体大小、单条音频大小和课程累计媒体大小，超限时返回明确错误。
- 课程详情 API 只返回 `mediaManifest` 和 `audioManifest`，不内联 base64 媒体；播放时通过鉴权媒体/音频接口流式读取。

**ARCH-048** 角色化首页分流（REQ-049）
- 根布局的 `AuthSessionGuard` 继续负责登录门控；`app/page.tsx` 在自己的 session 请求完成前只渲染骨架，避免管理员生成工作台向学员短暂闪现。
- `identity.isAdmin = true` 继续渲染现有生成工作台、设置、Agent、PPTX 脚手架和课程处理流程；普通学员渲染独立学习首页。
- 学员页复用现有头像资料 store、语言切换、主题切换、退出和 ZIP 导入，不挂载生成输入、Agent 或设置入口。

**ARCH-049** 首页课程统一视图与本地隔离（REQ-050~052, REQ-055）
- `loadHomeCourses()` 并行读取一次 `/api/courses` 与现有 Dexie `listStages()`；同一学员 API 响应中的企业课程和完整分类列表进入首页加载结果，课程统一推导 `source: 'enterprise' | 'local'` 后按更新时间合并；IndexedDB schema 不变。
- 企业课程打开 `/classroom/:id`，不提供重命名或删除；本地课程复用 `renameStage()`、`deleteStageData()` 和 `useImportClassroom()`。
- 学员调用 `useImportClassroom()` 时不传 `onImported` 企业持久化回调；因此 ZIP 只写 IndexedDB，不调用企业课程创建、发布、进度或测评接口。
- 搜索与来源筛选只作用于统一视图；加载失败保留显式错误和重试入口，不把企业 API 失败静默降级成“没有课程”。

**ARCH-052** 学员端企业课程分类目录（REQ-055）
- 数据迁移按 `sort_order = 10/20/30` 初始化“员工手册”“公司规范规章制度”“新员工入职”；迁移按名称跳过已存在分类，不增加系统保护字段，管理员后续可正常改名。
- 分类查询按 `sort_order`、名称和 ID 稳定排序。`GET /api/courses` 并行读取可见课程与完整分类；课程仍使用 ARCH-041 的发布状态和角色可见性过滤，分类列表不据此裁剪。
- 学员首页在来源筛选下常驻显示“全部分类”和完整分类标签。选择具体分类时来源切换为企业课程；选择全部来源或本地课程时分类重置为全部分类。
- 分类筛选只匹配企业课程 `categoryId`，搜索继续作用于当前筛选结果，来源数量仍统计未应用分类/搜索前的统一课程集合。
- 空分类保留全部标签并显示“该分类暂无可学课程”；标签支持深色模式、键盘焦点、`aria-pressed` 和窄屏自动换行。

**ARCH-050** 学员阶段考核覆盖层（REQ-054）
- `GET /api/exams` 继续由服务端按当前 `roleId` 返回已发布策略；首页入口只消费现有策略字段。
- 使用现有 Radix Dialog 承载介绍、答题、提交中、错误和结果状态；开始与提交继续调用 `POST /api/exams/:id/start`、`POST /api/exams/:id/attempts`，请求结构不变。
- Dialog 在未提交答题状态关闭时拦截并确认；提交失败不清空 `answers`，提交成功展示 score、passed、attemptNumber 和 threshold，只有“完成并返回”关闭结果页。

**ARCH-051** 生成页前端路由门控（REQ-053）
- `getAuthRedirect()` 将 `/generation-preview` 视为管理员页面；普通学员重定向 `/`，管理员不受影响。
- 不新增或调整 `/api/generate/*` 权限、请求或响应结构。

**ARCH-042** 题库抽题过滤
- 候选题来自所选课程的 quiz scenes 和 `courses.assessment_questions`。
- 服务端抽题前过滤 `type in ('single', 'multiple')`。
- 抽题结果保存 `question_refs`，不复制来源题所有权。

**ARCH-043** 测评不通过重学
- 测评提交失败后，服务端将 `course_progress.completed = false`，并重置播放位置。
- 下一次测评前必须重新完成课程学习部分。

**ARCH-044** 宿主查询安全
- 宿主 API Key 只能由宿主后端使用。
- 支持分页、时间范围、courseId、roleId、userId 过滤。
- 返回数据来自 OpenMAIC 后端权威表，不读取浏览器缓存。

## 7. 目录结构建议

```text
app/
  api/
    auth/
    admin/
    courses/
    exams/
    host/
    storage/
  admin/
  login/
  register/
  classroom/[id]/
components/
  admin/
  auth/
  authoring/
  assessment/
  embed/
lib/
  auth/
  admin/
  storage/
  assessment/
  exams/
  host-api/
  authoring/
  security/
```

## 8. 风险与约束

| 风险 | 影响 | 缓解 |
|---|---|---|
| 自有账号体系比原 ACCESS_CODE 重很多 | 开发量上升 | 先做手机号密码、单角色、单租户，不做验证码和组织树 |
| 管理后台膨胀 | 偏离“简洁”要求 | 首版只保留看板、课程、分类、角色、邀请码、用户角色、考核策略 |
| 阶段考核题量不足 | 无法组卷 | 管理端策略保存时显示候选单选/多选题量 |
| 宿主查询 API 暴露密钥 | 数据泄露 | 只允许宿主后端调用，Key hash 存储，可停用轮换 |
| IndexedDB 与后端冲突 | 数据不一致 | 企业课程主链路不再从 IndexedDB 读取课程内容 |
| 课程媒体 Blob 全部进入 PostgreSQL | 数据库备份和查询体积上升 | 限制单条/单课程媒体大小，详情 API 不内联媒体，媒体接口流式读取 |
