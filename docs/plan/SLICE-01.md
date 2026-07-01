# SLICE-01：后端存储服务

## 声明
- **实现需求**：REQ-017, REQ-018, REQ-019, REQ-020, REQ-024, REQ-028, REQ-029, REQ-030, REQ-032
- **实现架构**：ARCH-003, ARCH-008, ARCH-017, ARCH-030~036, ARCH-045, ARCH-049, ARCH-053, ARCH-055
- **拥有路径**：`app/api/storage/`, `lib/storage/api-client.ts`, `lib/storage/exam-bank-client.ts`, `lib/storage/db.ts`, `lib/assessment/exam-assembler.ts`
- **产出接口**：课程 CRUD API、媒体上传 API、同步 API、题库统计/抽题 API、考核结果记录 API、`StorageAPI` 与 `ExamBankAPI` 客户端（ARCH-045, ARCH-049）
- **消费接口**：Drizzle schema（SLICE-00）、`validateSessionToken()`（SLICE-00）
- **依赖切片**：SLICE-00

## 任务

### Task 1：数据库连接池
- 创建 `lib/storage/db.ts`
- 使用 `drizzle-orm/node-postgres` 适配器
- 连接池配置：`max: 10`，从 `DATABASE_URL` 环境变量读取
- 导出 `db` 实例供 API routes 使用
- 开发环境下支持连接池热重载（避免 `next dev` 重复创建连接）

### Task 2：课程 CRUD API
- 创建 `app/api/storage/courses/route.ts` — POST 创建课程、GET 列出租户课程（ARCH-030）
- 创建 `app/api/storage/courses/[id]/route.ts` — GET 获取单课程（含 scenes + outlines）、PUT 更新、DELETE 删除
- 所有路由从 request headers 读取 `x-tenant-id`（middleware 注入）
- 查询自动附加 `tenant_id` 过滤条件（ARCH-053）
- 分页支持：`page`（默认 1）、`pageSize`（默认 20，上限 100）
- 创建课程时同步写入 `outlines` 表和 `scenes` 表

### Task 3：场景 CRUD API
- 创建 `app/api/storage/courses/[id]/scenes/route.ts` — PUT 批量更新场景（ARCH-031）
- 创建 `app/api/storage/courses/[id]/scenes/[sceneId]/route.ts` — PATCH 单场景更新
- 批量更新为事务操作：先删除旧场景，再插入新场景
- 单场景更新：仅更新 `content`、`actions`、`whiteboard`、`title` 字段
- 校验 `course_id` 归属当前租户

### Task 4：阿里云 OSS 集成
- 安装 `ali-oss` 依赖
- 创建 `lib/storage/oss-client.ts`
- 实现 STS 临时凭证获取（通过 `@alicloud/sts20150401` 或直接调用 AssumeRole API）
- 实现 `getSTSCredentials(tenantId, courseId)` — 限定 policy 仅允许写入 `{tenantId}/{courseId}/*` 路径
- 存储路径规范：`{tenantId}/{courseId}/{elementId}.{ext}`

### Task 5：媒体上传 API
- 创建 `app/api/storage/media/presign/route.ts` — POST 返回 STS 临时凭证 + storageKey（ARCH-032）
- 创建 `app/api/storage/media/confirm/route.ts` — POST 确认上传，校验 OSS 文件存在，写入 `media_files` 表
- 创建 `app/api/storage/media/[id]/route.ts` — GET 生成签名 URL 并 302 重定向
- 文件大小校验：单次请求 ≤ 10MB（REQ-024），超大文件走 OSS 分片上传（前端处理）

### Task 6：课程同步 API
- 创建 `app/api/storage/courses/[id]/sync/route.ts`（ARCH-033）
- GET：返回服务端最新课程数据 + `serverUpdatedAt` 时间戳
- POST：接收客户端变更数据 + `clientUpdatedAt`
  - 如果 `clientUpdatedAt >= serverUpdatedAt`：接受客户端数据，更新服务端
  - 如果 `clientUpdatedAt < serverUpdatedAt`：返回 409 CONFLICT + 服务端数据，让客户端决策
- 同步范围：课程元数据 + 全量场景 + 大纲

### Task 7：存储 API 客户端
- 创建 `lib/storage/api-client.ts`（ARCH-045）
- 实现 `StorageAPI` 接口的所有方法
- 所有请求自动携带 `Authorization: Bearer` header
- 统一错误处理：HTTP 错误 → `StorageError`
- 导出单例实例 `storageAPI`

### Task 8：错误码与响应格式
- 复用 `lib/server/api-response.ts` 的 `apiError` / `apiSuccess`
- 新增错误码：`INVALID_TOKEN`, `FORBIDDEN`, `PAYLOAD_TOO_LARGE`, `CONFLICT`, `STORAGE_ERROR`
- 确保所有存储 API 返回一致的响应格式

### Task 9：题库统计与抽题组卷
- 创建 `lib/assessment/exam-assembler.ts` — 服务端抽题逻辑（ARCH-055）
- 创建 `app/api/storage/question-bank/route.ts` — GET 列出题库分类与题量统计（按 `tenant_id` 聚合 courses.category + scenes 的 quiz 题 + courses.assessment_questions）（ARCH-035, REQ-032）
- 创建 `app/api/storage/exams/assemble/route.ts` — POST 接收 `ExamPolicy`，按分类/课程范围过滤候选题、随机/加权抽 `questionCount` 题，返回 `{ examId, questions, questionRefs }`（ARCH-035, REQ-028, REQ-029）
- 抽题只读题源、不复制题目所有权；`questionRefs` 记录每题来源（courseId/sceneId/questionId）
- 题量不足时返回实际题量并标记（供前端/宿主提示）

### Task 10：考核结果记录 API
- 创建 `app/api/storage/exam-results/route.ts`（ARCH-036, REQ-030）
- POST：写入 `exam_results`，`kind` 区分 `course_quiz`/`stage_exam`；`user_id`/`role`/`tenant_id` 从 middleware 注入的 headers 读取（不信任前端传入）
- GET：按 `tenant_id` + `user_id` 查询当前学员结果，支持 `kind`/`courseId` 过滤
- 校验资源租户归属（ARCH-053）

### Task 11：题库/考核客户端
- 创建 `lib/storage/exam-bank-client.ts`（ARCH-049）
- 实现 `ExamBankAPI`：`listQuestionBank()`、`assembleExam(policy)`、`saveExamResult(record)`
- 所有请求自动携带会话鉴权；统一错误处理 → `StorageError`
