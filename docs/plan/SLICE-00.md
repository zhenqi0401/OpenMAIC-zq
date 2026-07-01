# SLICE-00：地基 — 共享类型与安全基础

## 声明
- **实现需求**：REQ-014, REQ-021, REQ-022, REQ-023, REQ-026~030
- **实现架构**：ARCH-010~018, ARCH-047
- **拥有路径**：`lib/embed/message-types.ts`, `lib/security/`, `lib/storage/schema/`, `drizzle.config.ts`, `lib/auth/types.ts`
- **产出接口**：postMessage 类型（含 ExamPolicy）、`validateSessionToken()`、Drizzle schema（含 exam_results、courses.category）、会话/角色/题库类型、环境变量配置
- **消费接口**：无（地基切片）
- **依赖切片**：无

## 任务

### Task 1：postMessage 协议类型定义
- 创建 `lib/embed/message-types.ts`
- 定义 `OpenMAICMessage`、`HostMessage` 信封类型（ARCH-016）
- 定义所有消息类型的 payload 接口：`InitPayload`（仅上下文，无 token/userId）, `LoadCoursePayload`, `StartExamPayload`(= `ExamPolicy`), `QuizResultPayload`, `CourseCompletedPayload`, `ExamResultPayload`, `CoursePublishedPayload`, `RetakePayload`（ARCH-020~027）
- 定义 `ExamPolicy`、`QuestionRef` 类型（ARCH-018）
- 定义消息类型常量枚举
- 导出类型供 embed-bridge、assessment、content-preview、auth 消费

### Task 2：会话 Token 签发与校验（含角色）
- 创建 `lib/security/session-token.ts`
- 实现 `createSessionToken({ userId, role, tenantId })` — 在 HMAC payload 中编码 userId + role + tenantId
- 实现 `validateSessionToken(token)` — 返回 `{ valid, userId, role, tenantId, expiresAt }`（ARCH-047）
- Token 格式：`timestamp.tenantId.userId.role.signature`（HMAC-SHA256）
- 复用现有 `middleware.ts` 的 Web Crypto 模式（Edge 兼容），从「单一全局 ACCESS_CODE」演进为「带身份载荷的会话 token」

### Task 3：会话鉴权 Middleware 扩展
- 创建 `lib/security/embed-auth-middleware.ts`
- 扩展现有 middleware 逻辑：从会话 cookie 或 `Authorization: Bearer` header（嵌入模式）提取并校验会话 token
- 校验通过后将 `x-user-id` / `x-role` / `x-tenant-id` 注入 request headers（供 API route 读取）
- `/api/auth/*` 路径加入白名单（登录本身不需要已有会话）
- 更新 `middleware.ts` 引入此扩展

### Task 4：数据库 Schema 定义（Drizzle ORM）
- 安装 `drizzle-orm` 和 `drizzle-kit`、`pg` 依赖
- 创建 `lib/storage/schema/courses.ts` — courses 表（ARCH-010）含 `assessment_questions` JSONB 与 `category` 字段
- 创建 `lib/storage/schema/scenes.ts` — scenes 表（ARCH-011）
- 创建 `lib/storage/schema/media-files.ts` — media_files 表（ARCH-012）
- 创建 `lib/storage/schema/outlines.ts` — outlines 表（ARCH-013）
- 创建 `lib/storage/schema/exam-results.ts` — exam_results 表（ARCH-017）
- 创建 `lib/storage/schema/index.ts` — 统一导出
- 创建 `drizzle.config.ts` — Drizzle Kit 配置
- 生成初始迁移文件

### Task 5：环境变量与配置
- 在 `.env.example` 中追加新环境变量：
  - `DATABASE_URL` — PostgreSQL 连接串
  - `OSS_REGION`, `OSS_BUCKET`, `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET` — 阿里云 OSS
  - `OSS_STS_ROLE_ARN` — STS 角色 ARN
  - `ALLOWED_EMBED_ORIGINS` — 允许的宿主 origin（逗号分隔）
  - `QUIZ_PASS_THRESHOLD` — 课后测评通过阈值（默认 0.8）
  - `HOST_ACCOUNT_SERVICE_URL` — 宿主账号服务校验地址（联合登录，ARCH-056）
- 创建 `lib/security/origin-validator.ts` — 从 env 读取 origin 白名单，提供 `isOriginAllowed(origin)` 函数

### Task 6：CSP 配置更新
- 更新 `next.config.ts` 的 `headers()` 函数
- 将 `ALLOWED_EMBED_ORIGINS` 同步到 `frame-ancestors`（与现有 `ALLOWED_FRAME_ANCESTORS` 合并或替代）
- 确保嵌入模式下 CSP 允许目标宿主域名

### Task 7：客户端新增类型定义
- 在 `app/generation-preview/types.ts` 扩展 `PreviewPhase` 类型，新增 `'content-review'` 和 `'generating-media'`（ARCH-014）
- 创建 `lib/assessment/types.ts`，定义 `CourseCompletionGate`（ARCH-015）、`ExamResult`/`ExamResultRecord`、`BankStats` 接口
- 创建 `lib/embed/types.ts`，定义 `SceneMediaStatus` 接口（ARCH-014）
- 创建 `lib/auth/types.ts`，定义 `SessionIdentity` 接口（ARCH-018）

### Task 8：docker-compose 扩展
- 在 `docker-compose.yml` 中追加 PostgreSQL 服务
- 配置数据卷持久化
- 添加环境变量引用
