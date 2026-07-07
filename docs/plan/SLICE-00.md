# SLICE-00：地基 — 类型、Schema 与安全基础

## 声明
- **实现需求**：REQ-017~025, REQ-026~046
- **实现架构**：ARCH-003, ARCH-004, ARCH-010~021, ARCH-044
- **拥有路径**：`lib/storage/schema/`, `lib/security/`, `lib/auth/types.ts`, `lib/host-api/types.ts`, `drizzle.config.ts`, `.env.example`
- **产出接口**：数据库 schema、会话 token、宿主 API Key 校验、权限类型、环境变量配置
- **依赖切片**：无

## 任务

### Task 1：数据库 Schema
- 创建 Drizzle schema：`users`, `roles`, `invite_codes`, `course_categories`, `courses`, `course_visibility_roles`, `scenes`, `outlines`, `media_files`, `course_progress`, `assessment_attempts`, `exam_policies`, `exam_policy_courses`, `exam_attempts`, `host_api_keys`。
- 首版按单租户实现；可预留 `tenant_id` 但 UI/API 不暴露租户切换。
- 媒体表只存 metadata 和 `ossKey`，不存 Blob。

### Task 2：共享类型
- 定义 `SessionIdentity`：`userId`, `roleId`, `roleCode`, `isAdmin`, `authSource`。
- 定义 `CourseVisibility`：`{ mode: 'all' | 'roles'; roleIds: string[] }`。
- 定义 `InviteCodeStatus`、`ExamPolicy`、`QuestionRef`、`DashboardSummary`、`HostQueryFilters`。
- 题目相关类型复用现有 `QuizQuestion`，但 assessment/exam 侧只接受 `single` / `multiple`。

### Task 3：会话与密码安全
- 实现密码 hash/verify 工具，使用强 hash 算法。
- 实现 OpenMAIC 会话 token 签发/校验，替代原单一 `ACCESS_CODE` 作为企业版主鉴权。
- API middleware 注入当前用户和管理员权限。

### Task 4：宿主 API Key
- 定义宿主查询 API Key/Secret 生成、hash 存储、校验和停用能力。
- 校验通过后只允许访问 `/api/host/*` 查询接口。
- 明确这些 Key 只供宿主后端使用，不能放到浏览器。

### Task 5：环境变量
- `.env.example` 增加 `DATABASE_URL`、OSS 配置、`SESSION_SECRET`、`HOST_SSO_SECRET`、`HOST_API_KEY_*` 管理说明、`ALLOWED_EMBED_ORIGINS`、`QUIZ_PASS_THRESHOLD`。

### Task 6：CSP 与 origin
- 复用/扩展现有 frame-ancestors 配置。
- postMessage origin 白名单从 env 读取。

### Task 7：迁移与种子
- 提供初始迁移。
- 提供默认管理员角色、默认学员角色和必要的系统配置种子。



• Slice-00 已完成。

  改了什么：

  - 新增 Drizzle/PostgreSQL 地基：drizzle.config.ts、lib/storage/schema/index.ts、drizzle/0000_slice_00_foundation.sql、
    drizzle/meta/*、drizzle/seed.sql。

  - 新增企业鉴权/权限基础：lib/auth/types.ts、lib/auth/session-guard.ts。
  - 新增安全工具：密码 scrypt hash/verify、session token、Host API Key、embed origin allow-list。
  - 新增 Host API 类型与访问守卫：lib/host-api/types.ts、lib/host-api/access.ts。
  验证结果：

  - pnpm.cmd test：通过，221 passed / 1771 tests passed
  - pnpm.cmd lint：通过，0 errors，15 个既有 warnings
  - pnpm.cmd build：通过
  - .\node_modules\.bin\drizzle-kit.CMD check --config drizzle.config.ts：通过
  - 本次 touched TS/JS 文件 Prettier check：通过

  遗留问题：

  - pnpm.cmd check 全仓 Prettier 仍失败，原因是仓库已有大量非本次格式差异（1085 files）。我没有为 Slice-00 格式化全仓，
    避免越界。

  - 工作区里 AGENTS.md、docs/* 等文档已有改动未处理；我没有回滚这些非本次实现改动。
