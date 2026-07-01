# 技术设计：OpenMAIC 企业嵌入式课程平台
> 版本 v0.2 · 2026-06-30 · 主人文档（怎么做）。下游引用请用 ARCH-ID 或本文章节号。
> 上游：`docs/PRD.md`（做什么）。每条设计应能追溯到某条 REQ。
> v0.2 变更：新增登录会话/联合宿主账号服务（ARCH-007）；阶段考核改为从分类课程题库抽题（ARCH-006、ARCH-008）；新增 `exam_results` 表与考核结果双边记录（ARCH-017）；courses 增加 category；postMessage `init`/`start-exam` 协议调整。
> 范围纪律：本设计仅覆盖二开新增/改造，OpenMAIC 原生功能（生成引擎、quiz 判分、课堂播放）按现状复用、不在此重述。

## 1. 技术栈选型

| 层 | 选型 | 理由 | 满足需求 |
|---|---|---|---|
| 框架 | Next.js 16 App Router（现有） | 复用现有项目，前后端一体，API Routes 可扩展为存储服务 | 全部 |
| 前端 | React 19 + Zustand（现有） | 复用现有状态管理，新模块沿用相同模式 | 全部 |
| 客户端存储 | Dexie.js / IndexedDB（现有） | 保留为离线缓存/草稿暂存层 | REQ-025 |
| 关系型数据库 | PostgreSQL（新增） | 课程元数据和结构化数据持久化；选 PG 而非 MySQL 因为 JSON 支持更好、扩展性强 | REQ-017, REQ-018, REQ-020 |
| 对象存储 | 阿里云 OSS（新增） | 媒体文件存储，现有代码已有 `ossKey` 字段预留；使用阿里云 OSS SDK（`ali-oss`） | REQ-018, REQ-024 |
| ORM | Drizzle ORM（新增） | 类型安全、轻量、与 Next.js API Routes 集成好；无需额外运行时 | REQ-017, REQ-019 |
| 对象存储 SDK | `ali-oss`（新增） | 阿里云官方 SDK，支持 STS 临时凭证直传、分片上传 | REQ-018, REQ-024 |
| 鉴权 | HMAC 签名 token（现有 middleware.ts，扩展） | 复用现有机制并扩展为登录会话；token 内编码 userId/role/tenantId，由宿主账号服务联合校验链路签发 | REQ-023, REQ-026, REQ-027 |
| 登录 | 独立登录页 + 联合宿主账号服务（新增） | 账号由宿主管理，OpenMAIC 不存账号密码，登录页提交凭证→宿主账号服务校验→建立会话 | REQ-026, REQ-027 |
| 通信协议 | postMessage（新增） | 浏览器原生 iframe 通信，无需额外依赖 | REQ-013, REQ-014 |

## 2. 系统架构

### 2.1 架构概述

```
┌─────────────────────────────────────────────────────────┐
│              宿主系统（Host · 面向企业管理者）            │
│  · 账号/角色管理 + 账号服务（登录校验源）                 │
│  · 按角色配置/触发阶段考核 · 接收并留存结果               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  iframe  src="openmaic.example.com/embed"         │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │          OpenMAIC Embed App                  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │  │  │
│  │  │  │ 内容预览  │ │ 课程播放  │ │  测评/考核   │ │  │  │
│  │  │  │ & 编辑   │ │ Classroom│ │  Assessment  │ │  │  │
│  │  │  └────┬─────┘ └────┬─────┘ └──────┬──────┘ │  │  │
│  │  │       └──────┬─────┴──────────────┘        │  │  │
│  │  │         Embed Bridge (postMessage)          │  │  │
│  │  └──────────────┬──────────────────────────────┘  │  │
│  └─────────────────┼─────────────────────────────────┘  │
│         postMessage │ ▲                                  │
│                     ▼ │                                  │
│              Host SDK / Listener                         │
└─────────────────────────────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│              OpenMAIC Server (Next.js)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              API Routes (/api/*)                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ 生成API  │ │ 存储API   │ │  评分API          │  │   │
│  │  │(现有)    │ │ (新增)    │ │ (现有quiz-grade) │  │   │
│  │  └─────────┘ └────┬─────┘ └──────────────────┘  │   │
│  └───────────────────┼──────────────────────────────┘   │
│                      │                                   │
│         ┌────────────┼────────────┐                      │
│         ▼            ▼            ▼                      │
│    PostgreSQL    S3/MinIO     LLM APIs                   │
│  (元数据/考核    (媒体文件)   (生成+评分)                  │
│   结果/题库)                                             │
└─────────────────────────────────────────────────────────┘
```

> 学员侧全部操作在 OpenMAIC（登录后）；管理者侧操作在宿主系统。登录会话的身份权威来源是宿主账号服务（ARCH-007）。阶段考核题目从 OpenMAIC 的分类课程题库抽取（ARCH-008），结果在 OpenMAIC 后端与宿主两边记录（ARCH-017）。

### 2.2 关键架构决策

**ARCH-001** 嵌入模式采用 iframe + postMessage（REQ-013, REQ-014）
- OpenMAIC 作为独立部署服务，宿主通过 `<iframe src="...">` 加载
- 双向通信走 postMessage，不引入 WebSocket 或长轮询
- 理由：浏览器原生支持、安全隔离、无额外依赖；现有 `next.config.ts` 已有 `ALLOWED_FRAME_ANCESTORS` 支持（`frame-ancestors` CSP header）

**ARCH-002** 生成流程拆分为「内容生成 → 预览编辑 → 按需媒体生成」三阶段（REQ-001, REQ-003）
- 现有流程：`handleConfirmOutlines()` → 并行调用 `startGeneration()` + `generateMediaForOutlines()`
- 新流程：`handleConfirmOutlines()` → `startGeneration()`（仅内容） → 进入预览阶段 → 用户按需触发 `generateMediaForOutlines()`
- 在 `previewPhase` 状态机中新增 `'content-review'` 状态，位于 `'generating-content'` 之后

**ARCH-003** 后端存储采用「API Routes 内扩展」而非独立微服务（REQ-017, REQ-019）
- 在现有 Next.js 的 `app/api/` 下新增存储相关路由
- 理由：避免引入服务间通信复杂度；现有 HMAC 鉴权可直接复用；部署仍为单容器
- 数据库连接通过 Drizzle ORM，连接池在 API Route 冷启动时初始化

**ARCH-004** 客户端双层存储：IndexedDB（缓存层） + 服务端（持久层）（REQ-017, REQ-025）
- 写入时：先写 IndexedDB（即时响应），后台异步同步到服务端
- 读取时：优先服务端，服务端不可达时回退 IndexedDB
- 冲突策略：服务端 `updatedAt` 为准（last-write-wins）

**ARCH-005** 课后测评作为课程完成的前置门控（REQ-006, REQ-007）
- 在 `classroom-complete` 渲染之前插入测评关卡
- 复用现有 `QuizQuestion` 类型和 `quiz-view` 组件
- 通过率阈值 80% 由服务端可配置（env `QUIZ_PASS_THRESHOLD`，默认 0.8）

**ARCH-006** 综合考核为「按角色从题库抽题 + 渲染评分 + 双边记录」模式（REQ-010, REQ-012, REQ-030, REQ-031）
- 宿主管理员按角色配置考核策略（题库分类范围、抽题数量、时限、阈值），通过 `start-exam` postMessage 触发，传入**策略/选择条件**而非题目本身
- OpenMAIC 从分类课程题库（ARCH-008）按策略与当前学员角色**抽题组卷**，负责渲染、计时、评分
- 结果通过 `exam-result` postMessage 回传宿主，**同时**写入 OpenMAIC 后端 `exam_results` 表（ARCH-017）
- 阶段编排（哪些课程/分类、何时、面向哪个角色）仍由宿主管理员决定；OpenMAIC 不提供管理者编排界面，但**不再是「不存储考核记录」**——结果两边都留存

**ARCH-007** 登录采用「独立登录页 + 联合宿主账号服务」（REQ-026, REQ-027, REQ-023）
- OpenMAIC 进入需登录；账号与角色权威来源是宿主账号服务，OpenMAIC 不存账号密码
- 登录页提交凭证 → OpenMAIC 服务端调用宿主账号服务校验 → 校验通过返回 `{ userId, role, tenantId, displayName }` → OpenMAIC 签发 HMAC 会话 token（编码 userId/role/tenantId）写入 cookie
- 复用现有 `middleware.ts` 的 Web Crypto HMAC 模式，将其从「单一全局 ACCESS_CODE」扩展为「带身份载荷的会话 token」；现有 `AccessCodeGuard` 演进为 `LoginGuard`
- `init` postMessage 不再作为登录凭证，仅传上下文（tenant/theme/locale）；嵌入模式下若未登录，iframe 内展示登录页或按宿主约定的联合登录流程
- 宿主账号服务地址由 env 配置；校验协议（如 POST 凭证 → 返回身份）作为集成契约定义

**ARCH-008** 分类课程题库与抽题组卷（REQ-028, REQ-029, REQ-032）
- 题库为**聚合视图**：题源是课内 quiz 场景题目（`scenes.content`）与课后测评题目（`courses.assessment_questions`），按 `courses.category` + courseId 标签组织；题目实体不复制，抽题只引用
- OpenMAIC 服务端提供：题库分类与题量统计查询（供宿主配置）、按策略抽题组卷（供 `start-exam` 触发时使用）
- 抽题策略：按分类/课程范围筛选候选题 → 按数量随机/加权抽取 → 组装为 `QuizQuestion[]` 交给 `StageExam` 渲染
- 抽出的考卷与作答、判分结果记入 `exam_results`（ARCH-017），不回写来源题目

## 3. 数据模型 / 表结构

### 3.1 服务端数据库表（PostgreSQL，新增）

**ARCH-010** `courses` 表 — 课程元数据（对应客户端 `StageRecord`）（REQ-017, REQ-020）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 课程 ID（与客户端 stage.id 一致） |
| tenant_id | VARCHAR(64) | NOT NULL, INDEX | 租户标识（宿主系统传入） |
| name | VARCHAR(255) | NOT NULL | 课程名称 |
| description | TEXT | | 课程描述 |
| language_directive | TEXT | | 语言指令 |
| style | VARCHAR(64) | | 课程风格 |
| category | VARCHAR(128) | INDEX | 课程分类标签（用于分类课程题库与按角色抽题，ARCH-008） |
| status | VARCHAR(32) | NOT NULL, DEFAULT 'draft' | draft / published / archived |
| assessment_questions | JSONB | | 课后测评题库 QuizQuestion[]，独立于课内 quiz 场景；同时作为阶段考核题库的题源之一 |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

索引：`(tenant_id, updated_at DESC)`

**ARCH-011** `scenes` 表 — 场景数据（对应客户端 `SceneRecord`）（REQ-017）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 场景 ID |
| course_id | UUID | FK → courses.id, ON DELETE CASCADE | |
| type | VARCHAR(32) | NOT NULL | slide / quiz / interactive / pbl |
| title | VARCHAR(255) | NOT NULL | |
| order | INTEGER | NOT NULL | 显示顺序 |
| content | JSONB | NOT NULL | SceneContent JSON |
| actions | JSONB | | Action[] JSON |
| whiteboard | JSONB | | Whiteboard[] JSON |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

索引：`(course_id, order)`

**ARCH-012** `media_files` 表 — 媒体文件元数据（REQ-018）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| course_id | UUID | FK → courses.id, ON DELETE CASCADE | |
| element_id | VARCHAR(128) | NOT NULL | 对应 SceneOutline.mediaGenerations[].elementId |
| type | VARCHAR(16) | NOT NULL | image / video / audio |
| storage_key | VARCHAR(512) | NOT NULL | 对象存储路径 |
| mime_type | VARCHAR(64) | NOT NULL | |
| size | BIGINT | NOT NULL | 字节数 |
| prompt | TEXT | | 生成时的 prompt |
| params | JSONB | | 生成参数 |
| created_at | TIMESTAMPTZ | NOT NULL | |

索引：`(course_id, element_id)` UNIQUE

**ARCH-013** `outlines` 表 — 课程大纲（对应客户端 `StageOutlinesRecord`）（REQ-017）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| course_id | UUID | PK, FK → courses.id | |
| outlines | JSONB | NOT NULL | SceneOutline[] |
| generation_complete | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**ARCH-017** `exam_results` 表 — 课后测评与阶段考核结果（双边记录中 OpenMAIC 这一边）（REQ-030, REQ-011, REQ-009）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 结果记录 ID |
| tenant_id | VARCHAR(64) | NOT NULL, INDEX | 租户标识 |
| user_id | VARCHAR(128) | NOT NULL, INDEX | 学员标识（来自登录会话） |
| role | VARCHAR(64) | | 学员角色（来自登录会话，ARCH-007） |
| kind | VARCHAR(16) | NOT NULL | `course_quiz`（课后测评）/ `stage_exam`（阶段考核） |
| course_id | UUID | FK → courses.id, NULL | 课后测评关联课程；阶段考核可为空 |
| exam_id | VARCHAR(128) | | 阶段考核标识（宿主触发时传入） |
| score | INTEGER | NOT NULL | 0-100 |
| passed | BOOLEAN | NOT NULL | |
| threshold | INTEGER | NOT NULL | 通过阈值（百分比） |
| duration | INTEGER | | 用时（秒，阶段考核） |
| attempt_number | INTEGER | DEFAULT 1 | 尝试次数 |
| details | JSONB | NOT NULL | 各题得分明细（questionId/correct/earned/maxPoints/aiComment?） |
| question_refs | JSONB | | 阶段考核抽题来源引用（courseId/sceneId/questionId），不复制题目实体 |
| created_at | TIMESTAMPTZ | NOT NULL | |

索引：`(tenant_id, user_id, created_at DESC)`、`(tenant_id, exam_id)`

> 题库为聚合视图（ARCH-008），无独立表；分类与题量统计通过对 `courses`（category）、`scenes`（quiz 题）、`courses.assessment_questions` 的查询实时聚合。

### 3.2 客户端新增类型

**ARCH-014** 内容预览状态扩展（REQ-001, REQ-002, REQ-005）

```typescript
// 扩展 GenerationSessionState.previewPhase
type PreviewPhase =
  | 'preparing'           // 现有：初始化
  | 'outline-ready'       // 现有：大纲就绪
  | 'review'              // 现有：大纲审阅
  | 'generating-content'  // 现有：生成内容中
  | 'content-review'      // 新增：内容预览编辑
  | 'generating-media';   // 新增：媒体生成中（按需触发后）

// 场景媒体生成状态
interface SceneMediaStatus {
  sceneId: string;
  hasMedia: boolean;         // 是否有媒体需求
  mediaGenerated: boolean;   // 媒体是否已生成
  contentChanged: boolean;   // 内容编辑后是否变更（需重新生成）
}
```

**ARCH-015** 课后测评状态（REQ-006, REQ-007, REQ-008）

```typescript
// 课后测评题库（独立于课内 quiz 场景）
// 存储在 courses.assessment_questions（服务端）和 StageRecord 扩展字段（客户端）
// 课内 quiz 场景的题目不参与通过判定

// 课程完成门控
interface CourseCompletionGate {
  requiresAssessment: boolean;  // 是否有课后测评题库
  passed: boolean;
  score: number;          // 0-100，仅课后测评题目的准确率
  threshold: number;      // 默认 80
  attempts: number;       // 尝试次数
  lastAttemptAt?: number; // 时间戳
}
```

**ARCH-018** 登录会话身份（REQ-026, REQ-027）

```typescript
// OpenMAIC 会话身份（HMAC token 解码后 + 前端 context）
interface SessionIdentity {
  userId: string;
  role: string;            // 角色，来自宿主账号服务，用于按角色抽题/分发考核
  tenantId: string;
  displayName?: string;
  expiresAt: number;
}

// 阶段考核触发策略（宿主管理员按角色配置，start-exam 传入）
interface ExamPolicy {
  examId: string;
  categories?: string[];   // 题库分类范围（courses.category）
  courseIds?: string[];    // 或显式指定课程范围
  questionCount: number;   // 抽题数量
  role?: string;           // 面向角色（缺省取当前会话角色）
  timeLimit?: number;      // 秒
  passThreshold?: number;  // 0-1，默认 0.8
  title?: string;
}
```

### 3.3 postMessage 协议数据结构

**ARCH-016** postMessage 消息格式（REQ-014）

```typescript
// 所有消息共享的信封格式
interface OpenMAICMessage {
  type: string;           // 消息类型
  source: 'openmaic';     // 固定标识，用于宿主过滤
  payload: unknown;       // 类型特定的载荷
  messageId: string;      // 唯一消息 ID（UUID）
  replyTo?: string;       // 响应哪条消息（请求-响应模式时使用）
}

// 宿主 → OpenMAIC 消息
interface HostMessage {
  type: string;
  source: 'host';
  payload: unknown;
  messageId: string;
}
```

## 4. API 设计

### 4.1 postMessage 协议（宿主 ↔ OpenMAIC）

**ARCH-020** `init` — 宿主初始化 OpenMAIC 上下文（REQ-016）
- 方向：宿主 → OpenMAIC
- 时机：iframe loaded 后立即发送
- 说明：**`init` 仅传上下文，不作为登录凭证**；用户身份以登录会话为准（ARCH-007）
- 输入：
  ```typescript
  {
    type: 'init',
    payload: {
      tenantId: string;        // 租户标识（上下文）
      locale?: string;         // 语言偏好
      theme?: 'light' | 'dark';
      origin: string;          // 宿主 origin，用于校验
    }
  }
  ```
- 输出（OpenMAIC → 宿主）：
  ```typescript
  { type: 'init-ack', payload: { success: boolean; authenticated: boolean } }
  ```
- 说明：`authenticated=false` 时 OpenMAIC 在 iframe 内展示登录页（ARCH-007）

**ARCH-021** `load-course` — 加载课程（REQ-014）
- 方向：宿主 → OpenMAIC
- 输入：`{ type: 'load-course', payload: { courseId: string } }`
- 输出：`{ type: 'course-loaded', payload: { courseId: string; success: boolean } }`

**ARCH-022** `start-exam` — 按策略触发阶段考核（REQ-010, REQ-031）
- 方向：宿主 → OpenMAIC
- 说明：传入**考核策略**（`ExamPolicy`，见 ARCH-018），**不传题目**；OpenMAIC 从分类课程题库按策略与会话角色抽题组卷（ARCH-008）
- 输入：
  ```typescript
  {
    type: 'start-exam',
    payload: ExamPolicy   // { examId, categories?/courseIds?, questionCount, role?, timeLimit?, passThreshold?, title? }
  }
  ```
- 输出：见 ARCH-025 `exam-result`

**ARCH-023** `quiz-result` — 课后测评结果上报（REQ-009）
- 方向：OpenMAIC → 宿主
- 时机：课后测评评分完成后
- 输出：
  ```typescript
  {
    type: 'quiz-result',
    payload: {
      courseId: string;
      passed: boolean;
      score: number;            // 0-100
      threshold: number;
      totalQuestions: number;
      correctCount: number;
      details: Array<{
        questionId: string;
        correct: boolean;
        earned: number;
        maxPoints: number;
      }>;
      attemptNumber: number;
    }
  }
  ```

**ARCH-024** `course-completed` — 课程完成通知（REQ-009）
- 方向：OpenMAIC → 宿主
- 时机：课后测评通过后
- 输出：`{ type: 'course-completed', payload: { courseId: string; score: number } }`

**ARCH-025** `exam-result` — 综合考核结果（REQ-011）
- 方向：OpenMAIC → 宿主
- 输出：
  ```typescript
  {
    type: 'exam-result',
    payload: {
      examId: string;
      passed: boolean;
      score: number;
      threshold: number;
      totalQuestions: number;
      correctCount: number;
      duration: number;         // 实际用时（秒）
      details: Array<{
        questionId: string;
        correct: boolean;
        earned: number;
        maxPoints: number;
        aiComment?: string;     // 简答题反馈
      }>;
    }
  }
  ```

**ARCH-026** `course-published` — 课程发布通知（REQ-014）
- 方向：OpenMAIC → 宿主
- 时机：课程内容确认完成、视频生成完毕后用户点击发布
- 输出：`{ type: 'course-published', payload: { courseId: string; name: string; sceneCount: number } }`

**ARCH-027** `retake` — 重新学习指令（REQ-008）
- 方向：宿主 → OpenMAIC 或 OpenMAIC 内部
- 输入：`{ type: 'retake', payload: { courseId: string } }`
- 行为：重置播放进度，跳转到课程第一个场景

### 4.2 后端存储 API（RESTful，新增）

所有接口前缀：`/api/storage`。鉴权：请求头携带 `Authorization: Bearer <hmac-token>`，复用现有 middleware 校验逻辑。

**ARCH-030** 课程 CRUD（REQ-019）

| 方法 | 路径 | 说明 | 输入 | 输出 |
|---|---|---|---|---|
| POST | `/api/storage/courses` | 创建课程 | `{ name, description?, scenes, outlines }` | `{ id, ...course }` |
| GET | `/api/storage/courses/:id` | 获取课程（含 scenes） | — | `{ course, scenes, outlines }` |
| PUT | `/api/storage/courses/:id` | 更新课程元数据 | `{ name?, description?, status? }` | `{ course }` |
| DELETE | `/api/storage/courses/:id` | 删除课程 | — | `{ success }` |
| GET | `/api/storage/courses` | 列出租户课程 | query: `status`, `page`, `pageSize` | `{ courses[], total }` |

**ARCH-031** 场景 CRUD（REQ-019）

| 方法 | 路径 | 说明 |
|---|---|---|
| PUT | `/api/storage/courses/:id/scenes` | 批量更新场景（全量替换） |
| PATCH | `/api/storage/courses/:id/scenes/:sceneId` | 单场景内容更新 |

**ARCH-032** 媒体文件上传（REQ-018, REQ-024）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/storage/media/presign` | 获取预签名上传 URL |
| POST | `/api/storage/media/confirm` | 确认上传完成，写入元数据 |
| GET | `/api/storage/media/:id` | 获取媒体文件（重定向到 CDN/签名 URL） |

STS 直传流程：
1. 前端请求 `POST /api/storage/media/presign`，传入 `{ courseId, elementId, type, mimeType, size }`
2. 服务端通过阿里云 STS 生成临时凭证（有效期 15 分钟），返回 `{ credentials, bucket, region, storageKey }`
3. 前端使用 `ali-oss` SDK + 临时凭证直传文件到 OSS（支持分片上传）
4. 前端调用 `POST /api/storage/media/confirm`，传入 `{ storageKey, courseId, elementId }`
5. 服务端验证文件存在，写入 `media_files` 表

**ARCH-033** 课程同步（REQ-025）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/storage/courses/:id/sync` | 客户端上传本地变更 |
| GET | `/api/storage/courses/:id/sync` | 获取服务端最新版本 |

同步载荷携带 `clientUpdatedAt` 时间戳，服务端对比后决定合并策略（last-write-wins）。

**ARCH-034** 登录与会话（REQ-026, REQ-027）

| 方法 | 路径 | 说明 | 输入 | 输出 |
|---|---|---|---|---|
| POST | `/api/auth/login` | 联合宿主账号服务校验凭证，签发会话 token（写 cookie） | `{ username, password, tenantId? }` | `{ userId, role, tenantId, displayName }` |
| POST | `/api/auth/logout` | 注销会话 | — | `{ success }` |
| GET | `/api/auth/session` | 返回当前会话身份（`LoginGuard` 用） | — | `{ authenticated, identity? }` |

- `/api/auth/login` 内部调用宿主账号服务（地址 env 配置）校验，成功后用现有 HMAC 模式签发携带 `userId/role/tenantId` 的 token
- 鉴权链路：`middleware.ts` 校验会话 token 并将 `x-user-id` / `x-role` / `x-tenant-id` 注入 request headers，供下游 API 使用

**ARCH-035** 题库与阶段考核组卷（REQ-028, REQ-029, REQ-032, REQ-010）

| 方法 | 路径 | 说明 | 输入 | 输出 |
|---|---|---|---|---|
| GET | `/api/storage/question-bank` | 列出可用题库分类与题量统计（供宿主配置角色策略） | query: `category?` | `{ categories: [{ category, courseCount, questionCount }] }` |
| POST | `/api/storage/exams/assemble` | 按 `ExamPolicy` 从分类课程题库抽题组卷 | `ExamPolicy` | `{ examId, questions: QuizQuestion[], questionRefs }` |

- 抽题只读题源（`scenes` 的 quiz 题 + `courses.assessment_questions`），按 `tenant_id` + `category`/`courseIds` 过滤，随机/加权抽 `questionCount` 题
- `questionRefs` 记录每题来源（courseId/sceneId/questionId），写入 `exam_results.question_refs`

**ARCH-036** 考核结果记录（双边记录之 OpenMAIC 侧）（REQ-030, REQ-009, REQ-011）

| 方法 | 路径 | 说明 | 输入 | 输出 |
|---|---|---|---|---|
| POST | `/api/storage/exam-results` | 持久化课后测评/阶段考核结果到 `exam_results` | `{ kind, courseId?, examId?, score, passed, threshold, duration?, details, questionRefs? }` | `{ id }` |
| GET | `/api/storage/exam-results` | 查询当前学员结果（按 tenant+user） | query: `kind?`, `courseId?` | `{ results[] }` |

- 前端评分完成后：**先**调用本接口持久化（OpenMAIC 侧），**再**通过 postMessage 回传宿主（宿主侧），实现两边记录
- `user_id` / `role` / `tenant_id` 由 middleware 注入，不由前端传入（防篡改）

### 4.3 错误码（统一）

复用现有 `lib/server/api-response.ts` 的 `apiError(errorCode, status, message)` 模式：

| 错误码 | HTTP | 说明 |
|---|---|---|
| INVALID_TOKEN | 401 | token 无效或过期 |
| FORBIDDEN | 403 | 租户不匹配 |
| NOT_FOUND | 404 | 资源不存在 |
| PAYLOAD_TOO_LARGE | 413 | 超过 10MB 限制（REQ-024） |
| CONFLICT | 409 | 同步冲突 |
| STORAGE_ERROR | 500 | 对象存储或数据库错误 |

## 5. 模块地图（切片依据）

| 模块 | 职责 | 边界（不做什么） | 依赖 | 满足需求 |
|---|---|---|---|---|
| **embed-bridge** | iframe 嵌入层：postMessage 收发、origin 校验、消息路由、init 上下文握手 | 不做业务逻辑、不做登录鉴权（登录归 auth） | — | REQ-013~016, REQ-021 |
| **auth** | 登录与会话：独立登录页、联合宿主账号服务校验、会话 token 签发、`LoginGuard`、角色注入 | 不做账号管理（归宿主） | security | REQ-026, REQ-027, REQ-023 |
| **content-preview** | 内容预览与编辑：在大纲确认后展示生成内容、支持编辑、管理媒体生成触发 | 不修改生成引擎本身 | embed-bridge（可选，嵌入时需要） | REQ-001~005 |
| **assessment** | 课后测评门控 + 阶段考核（按角色从题库抽题、渲染、评分、双边记录） | 不做阶段编排逻辑、不为考核生成新题 | embed-bridge（结果上报）、storage-backend（抽题/记录） | REQ-006~012, REQ-028~031 |
| **storage-backend** | 服务端持久化：数据库 schema、ORM、CRUD API、对象存储集成、题库聚合/抽题、考核结果记录 | 不做前端 UI | — | REQ-017~020, REQ-024, REQ-028~030 |
| **storage-sync** | 前端同步层：IndexedDB ↔ 服务端双向同步、离线暂存、冲突解决 | 不做数据库操作（调 storage-backend API） | storage-backend | REQ-025 |
| **security** | 鉴权与安全：多租户 token 校验、CSP 配置、origin 白名单 | 不做业务逻辑 | — | REQ-021~023 |

## 6. 切片间接口契约（防漂移核心）

### embed-bridge 提供的接口

**ARCH-040** `useEmbedBridge()` — Embed Bridge React Hook
- 提供方：embed-bridge
- 消费方：content-preview, assessment, storage-sync
- 输入：无
- 输出：
  ```typescript
  {
    isEmbedded: boolean;                      // 是否处于 iframe 嵌入模式
    hostOrigin: string | null;                // 宿主 origin
    tenantId: string | null;                  // 租户 ID（init 上下文）
    sendToHost: (msg: OpenMAICMessage) => void;  // 向宿主发送消息
    onHostMessage: (type: string, handler: (payload: unknown) => void) => () => void;  // 监听宿主消息，返回取消函数
  }
  ```
- 说明：用户身份（userId/role）不再由 embed-bridge 提供，改由 auth 的 `useSession()`（ARCH-048）提供
- 错误：origin 不在白名单中时 `sendToHost` 静默丢弃并 console.warn

**ARCH-041** `EmbedProvider` — React Context Provider
- 提供方：embed-bridge
- 消费方：app layout（包裹整个应用）
- 行为：在 app mount 时监听 `message` 事件，完成 init 握手，设置 context 值
- 非嵌入模式：`isEmbedded: false`，所有方法为空操作

### content-preview 消费/产出的接口

**ARCH-042** `ContentPreviewPage` — 内容预览页面组件
- 提供方：content-preview
- 消费方：generation-preview page（嵌入到现有生成流程中）
- 输入 props：
  ```typescript
  {
    outlines: SceneOutline[];
    generatedContents: Map<string, SceneContent>;  // sceneId → 生成的内容
    stageId: string;
    onConfirm: (editedContents: Map<string, SceneContent>) => void;  // 确认发布
    onGenerateMedia: (sceneIds: string[]) => void;  // 触发指定场景的媒体生成
    onBack: () => void;  // 返回大纲编辑
  }
  ```
- 输出：通过 `onConfirm` 回调传出编辑后的内容

### assessment 消费/产出的接口

**ARCH-043** `CourseAssessment` — 课后测评门控组件
- 提供方：assessment
- 消费方：classroom page（替代现有 classroom-complete 的直接渲染）
- 输入 props：
  ```typescript
  {
    courseId: string;
    questions: QuizQuestion[];      // 课后测评专用题库（独立于课内 quiz 场景）
    threshold?: number;             // 通过阈值，默认 0.8
    onPass: (score: number) => void;           // 通过回调
    onRetake: () => void;                      // 重学回调
  }
  ```
- 说明：题库来自 `courses.assessment_questions`（见 ARCH-010），与课内 quiz 场景的题目完全独立。是否通过仅看此题库的准确率。

**ARCH-044** `StageExam` — 综合考核渲染组件（按抽题结果渲染）
- 提供方：assessment
- 消费方：embed-bridge（收到 `start-exam` 消息时，先调用 `/api/storage/exams/assemble` 抽题，再渲染）
- 输入 props：
  ```typescript
  {
    examId: string;
    questions: QuizQuestion[];      // 由 storage-backend 按 ExamPolicy 抽题组卷得到（ARCH-035）
    questionRefs?: QuestionRef[];   // 抽题来源引用，随结果一起记录
    timeLimit?: number;
    passThreshold?: number;
    onComplete: (result: ExamResult) => void;  // 考核完成回调（内部先持久化再回传宿主）
  }
  ```
- `ExamResult` 结构同 ARCH-025 的 payload；完成后经 ARCH-036 持久化 + `exam-result` 回传（双边记录）

### storage-backend 提供的接口

**ARCH-045** 存储 API 客户端 — `lib/storage/api-client.ts`
- 提供方：storage-backend（类型定义 + 实际 API 实现）
- 消费方：storage-sync
- 接口：
  ```typescript
  interface StorageAPI {
    getCourse(id: string): Promise<CourseData>;
    saveCourse(data: CourseData): Promise<{ id: string }>;
    updateScenes(courseId: string, scenes: SceneData[]): Promise<void>;
    getPresignedUrl(req: PresignRequest): Promise<{ uploadUrl: string; storageKey: string }>;
    confirmUpload(storageKey: string, courseId: string, elementId: string): Promise<void>;
    syncCourse(courseId: string, localData: SyncPayload): Promise<SyncResult>;
  }
  ```
- 错误：所有方法抛出 `StorageError`，包含 `code`（错误码）和 `message`

### storage-sync 提供的接口

**ARCH-046** `useCourseStorage()` — 前端存储 Hook
- 提供方：storage-sync
- 消费方：content-preview, classroom page, assessment
- 输出：
  ```typescript
  {
    saveCourse: (course: StageRecord, scenes: SceneRecord[]) => Promise<void>;  // 同时写 IndexedDB + 服务端
    loadCourse: (courseId: string) => Promise<{ stage: StageRecord; scenes: SceneRecord[] } | null>;
    syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
    lastSyncAt: number | null;
  }
  ```
- 错误：网络失败时自动回退为 IndexedDB-only 模式，`syncStatus` 变为 `'offline'`

### security 提供的接口

**ARCH-047** `validateSessionToken(token)` — 会话 Token 校验
- 提供方：security
- 消费方：auth、embed-bridge、storage-backend API middleware
- 输入：HMAC 会话 token
- 输出：`{ valid: boolean; userId: string; role: string; tenantId: string; expiresAt: number }`
- 错误：无效 token 返回 `{ valid: false }`

**ARCH-048** `useSession()` / `LoginGuard` — 登录会话（REQ-026, REQ-027）
- 提供方：auth
- 消费方：app layout（`LoginGuard` 包裹）、assessment、storage-sync（读取 userId/role/tenantId）
- `useSession()` 输出：`{ authenticated: boolean; identity: SessionIdentity | null; login(creds): Promise<void>; logout(): Promise<void> }`
- `LoginGuard` 行为：未登录时渲染登录页；登录成功后渲染子树。替代现有 `AccessCodeGuard`

**ARCH-049** 题库/组卷 API 客户端 — `lib/storage/exam-bank-client.ts`
- 提供方：storage-backend
- 消费方：assessment、（题库统计）宿主集成示例
- 接口：
  ```typescript
  interface ExamBankAPI {
    listQuestionBank(category?: string): Promise<BankStats>;          // ARCH-035
    assembleExam(policy: ExamPolicy): Promise<{ examId: string; questions: QuizQuestion[]; questionRefs: QuestionRef[] }>;
    saveExamResult(result: ExamResultRecord): Promise<{ id: string }>; // ARCH-036
  }
  ```

## 7. 关键技术难点与方案

**ARCH-050** 媒体生成从自动触发改为手动触发（REQ-001, REQ-003）
- 难点：现有 `media-orchestrator.ts` 的 `generateMediaForOutlines()` 在 `handleConfirmOutlines()` 中与内容生成并行调用，需要拆开
- 方案：
  1. 在 `generation-preview/page.tsx` 的 `handleConfirmOutlines()` 中移除 `generateMediaForOutlines()` 调用
  2. 内容生成完成后进入 `content-review` 阶段
  3. 预览页面每个场景提供独立的「生成视频/图片」按钮
  4. 按钮触发 `generateMediaForOutlines([singleOutline], stageId)` 或批量版本
  5. 媒体生成状态复用现有 `useMediaGenerationStore`（pending / generating / done / failed）

**ARCH-051** 内容编辑后媒体失效标记（REQ-005）
- 难点：用户编辑内容后，已生成的视频/图片可能不匹配新内容
- 方案：
  1. 内容编辑时对比 diff，若关键字段变更（slide 文案、quiz 题目等），将对应 `SceneMediaStatus.contentChanged` 设为 true
  2. 已生成的媒体不自动删除，但 UI 显示「内容已变更」警告标记
  3. 用户可选择重新生成或保留

**ARCH-052** 课后测评与课内 quiz 的分离（REQ-006, REQ-007）
- 难点：课程中穿插的 quiz 场景（课内练习）与课程结束后的课后测评是两套独立评分体系，课内练习分数不影响是否通过
- 方案：
  1. **课内 quiz**：保持现有行为不变，学习过程中的 quiz 场景照常答题、评分、展示结果，但不参与通过/不通过判定
  2. **课后测评**：课程所有场景播放完毕后，由 `CourseAssessment` 组件渲染一套独立的测评题目。题库由 AI 在课程生成阶段自动生成（仅选择题：单选/多选），存在 `courses.assessment_questions` 字段中，用户可在内容预览阶段编辑。与课内 quiz 场景的题目完全分开
  3. 是否通过仅看课后测评的准确率（≥ 80%），课内 quiz 的得分仅作为学习过程参考
  4. 如果课程没有课后测评题目，跳过测评直接完成
  5. 测评不通过时，仅清除课后测评答题记录，课内 quiz 的答题记录保留；重置播放进度要求重学

**ARCH-053** 多租户数据隔离（REQ-020）
- 难点：不同企业客户的数据必须严格隔离
- 方案：
  1. Token 中编码 `tenantId`，middleware 提取后注入到请求上下文
  2. 所有数据库查询自动附加 `WHERE tenant_id = ?` 条件（Drizzle ORM 层面封装）
  3. 对象存储路径前缀 `{tenantId}/{courseId}/` 实现物理隔离
  4. API 层面校验：请求的资源 `tenant_id` 必须与 token 中的一致

**ARCH-054** 弱网环境下的可用性（REQ-025）
- 难点：内容编辑需要在断网时仍可操作
- 方案：
  1. 所有写操作先写入 IndexedDB（同步写入，保证即时响应）
  2. 后台维护同步队列（Zustand store），网络恢复时自动重试
  3. 同步状态在 UI 上持续显示（已同步 / 同步中 / 离线 / 同步失败）
  4. 冲突时以服务端 `updatedAt` 为准（适合企业培训场景——同一课程不会被并发编辑）

## 8. 目录结构

```
app/
├── api/
│   ├── auth/                        # 新增：登录与会话（ARCH-034）
│   │   ├── login/route.ts           # POST 联合宿主账号服务校验、签发会话
│   │   ├── logout/route.ts          # POST 注销
│   │   └── session/route.ts         # GET 当前会话身份
│   └── storage/                    # 新增：后端存储 API
│       ├── courses/
│       │   ├── route.ts            # POST（创建）、GET（列表）
│       │   └── [id]/
│       │       ├── route.ts        # GET / PUT / DELETE
│       │       ├── scenes/
│       │       │   ├── route.ts    # PUT（批量更新）
│       │       │   └── [sceneId]/
│       │       │       └── route.ts  # PATCH（单场景更新）
│       │       └── sync/
│       │           └── route.ts    # GET / POST（同步）
│       ├── question-bank/
│       │   └── route.ts            # GET（题库分类与题量统计，ARCH-035）
│       ├── exams/
│       │   └── assemble/
│       │       └── route.ts        # POST（按 ExamPolicy 抽题组卷，ARCH-035）
│       ├── exam-results/
│       │   └── route.ts            # POST/GET（考核结果记录，ARCH-036）
│       └── media/
│           ├── presign/
│           │   └── route.ts        # POST（预签名 URL）
│           ├── confirm/
│           │   └── route.ts        # POST（确认上传）
│           └── [id]/
│               └── route.ts        # GET（获取媒体）
├── embed/                          # 新增：嵌入模式入口页
│   └── page.tsx                    # iframe 加载的入口，精简 UI
├── login/                          # 新增：独立登录页（ARCH-007）
│   └── page.tsx
├── generation-preview/
│   └── page.tsx                    # 现有：改造以支持内容预览阶段
└── classroom/
    └── [id]/
        └── page.tsx                # 现有：改造以支持课后测评门控

components/
├── embed/                          # 新增：嵌入相关组件
│   ├── embed-provider.tsx          # EmbedProvider context
│   ├── embed-bridge.ts             # postMessage 收发逻辑
│   └── embed-layout.tsx            # 嵌入模式精简布局
├── auth/                           # 新增：登录与会话（ARCH-007, ARCH-048）
│   ├── login-guard.tsx             # LoginGuard（替代 AccessCodeGuard）
│   └── login-page.tsx              # 独立登录页 UI
├── generation/
│   └── content-preview/            # 新增：内容预览编辑组件
│       ├── content-preview-page.tsx
│       ├── scene-content-editor.tsx # 单场景内容编辑器
│       ├── media-trigger.tsx        # 媒体生成触发按钮
│       └── content-diff.tsx         # 内容变更检测
└── assessment/                     # 新增：测评组件
    ├── course-assessment.tsx        # 课后测评门控
    ├── stage-exam.tsx               # 综合考核渲染（抽题结果）
    ├── assessment-result.tsx        # 测评结果展示
    └── retake-prompt.tsx            # 重学提示

lib/
├── embed/                          # 新增：嵌入层逻辑
│   ├── use-embed-bridge.ts         # useEmbedBridge hook
│   ├── message-types.ts            # postMessage 类型定义
│   ├── origin-validator.ts         # origin 白名单校验
│   └── host-sdk.ts                 # 供宿主系统使用的集成示例代码（首版不独立发包）
├── auth/                           # 新增：登录会话逻辑（ARCH-048, ARCH-056）
│   ├── use-session.ts              # useSession hook
│   └── host-account-client.ts      # 联合宿主账号服务校验客户端
├── storage/                        # 新增：存储层
│   ├── api-client.ts               # 存储 API 客户端
│   ├── exam-bank-client.ts         # 题库/组卷/结果 API 客户端（ARCH-049）
│   ├── sync-manager.ts             # 同步队列管理
│   ├── use-course-storage.ts       # useCourseStorage hook
│   └── schema/                     # 数据库 schema
│       ├── index.ts                # Drizzle schema 定义
│       ├── courses.ts
│       ├── scenes.ts
│       ├── media-files.ts
│       ├── outlines.ts
│       ├── exam-results.ts         # 新增：考核结果表（ARCH-017）
│       └── migrations/             # 数据库迁移文件
├── assessment/                     # 新增：测评逻辑
│   ├── course-gate.ts              # 课后测评门控逻辑
│   ├── exam-assembler.ts           # 按 ExamPolicy 抽题（服务端）
│   └── exam-timer.ts               # 考核计时器
└── security/                       # 新增：安全相关
    ├── session-token.ts            # 会话 token 签发/校验（ARCH-047）
    └── embed-auth-middleware.ts    # API middleware 扩展
```

## 9. 风险 / 待定

| 风险 | 影响 | 缓解方案 |
|---|---|---|
| PostgreSQL 新增运维负担 | 部署复杂度增加 | docker-compose 中追加 pg 服务；首版仅支持 PG，后续可按需添加 SQLite 降级 |
| IndexedDB ↔ 服务端同步的一致性 | 数据丢失或冲突 | last-write-wins 策略足够（单用户编辑场景）；关键操作（发布）强制同步确认 |
| 大体积视频文件上传 | 超时或内存溢出 | 阿里云 OSS STS 临时凭证直传 + `ali-oss` 分片上传，服务端不经手文件流 |
| postMessage 安全性 | XSS 或消息伪造 | origin 白名单 + 消息 source 字段校验 + CSP frame-ancestors |
| 课后测评与课内 quiz 容易混淆 | 用户可能误以为课内 quiz 成绩算入通过判定 | UI 上明确区分：课内 quiz 标记为「课堂练习」，课后测评标记为「结业测评」，仅后者影响通过 |
| 嵌入模式下 cookie 鉴权受第三方 cookie 策略影响 | Safari/Chrome 可能阻止跨域 cookie | 嵌入模式下改用 Authorization header 传会话 token（而非 cookie） |
| 分类课程题库题量不足，抽不够题 | 阶段考核组卷失败或题量偏少 | `assemble` 返回实际抽到的题量并提示；策略可配置"不足则放宽分类范围"；宿主配置时用 `question-bank` 统计预校验 |
| 宿主账号服务不可用导致无法登录 | 学员无法进入 | 校验失败给出明确错误；可配置缓存最近成功会话的有效期；运维监控宿主账号服务连通性 |
| 题库为聚合视图，跨大量课程实时聚合慢 | 组卷/统计接口延迟 | 按 tenant+category 建索引；必要时为题库统计加缓存层（首版直查，后续可加物化） |

**ARCH-055** 按角色从分类课程题库抽题组卷（REQ-028, REQ-029, REQ-031）
- 难点：阶段考核不另行出题，须从既有题源（课内 quiz 题 + 课后测评题）按角色策略抽取，且不破坏题目归属
- 方案：
  1. 题库为聚合视图，不建独立题目表；候选题实时从 `scenes`（quiz 题）与 `courses.assessment_questions` 聚合，按 `tenant_id` + `category`/`courseIds` 过滤
  2. 抽题在服务端完成（`/api/storage/exams/assemble`），按 `questionCount` 随机/加权抽取，组装 `QuizQuestion[]` + `questionRefs`
  3. 角色策略由宿主管理员配置并通过 `start-exam` 传入（`ExamPolicy`），缺省 role 取当前会话角色
  4. 结果记 `exam_results.question_refs`（来源引用），不回写来源题目

**ARCH-056** 联合宿主账号服务登录（REQ-026, REQ-027）
- 难点：账号由宿主管理，OpenMAIC 不存密码，但需建立本地会话用于鉴权与角色
- 方案：
  1. OpenMAIC 登录页提交凭证 → `/api/auth/login` → 服务端调用宿主账号服务校验（地址 env 配置）
  2. 校验成功返回 `{ userId, role, tenantId, displayName }` → 用现有 HMAC 模式签发会话 token 写 cookie
  3. `middleware.ts` 从「单一全局 ACCESS_CODE」扩展为「带身份载荷的会话 token」校验，并注入 `x-user-id`/`x-role`/`x-tenant-id`
  4. 嵌入模式：iframe 内展示登录页；如宿主已有登录态，可按集成约定走联合登录（首版以登录页为准）

### 已确定事项

1. **课后测评题目由 AI 自动生成**：在课程生成阶段，AI 根据课程内容自动生成课后测评题库（与课内内容同步生成），用户可在内容预览阶段编辑测评题目。
2. **课后测评仅支持选择题**（单选/多选）：本地评分，无需调用 AI 评分 API，响应更快、更可靠。
3. **阶段考核题目不另行生成**：从分类课程题库（课内 quiz 题 + 课后测评题）按角色策略抽取组卷（ARCH-008、ARCH-055），与"课后测评由 AI 生成"是两件事——前者抽既有题，后者生成新题。
4. **登录为联合宿主账号服务**：OpenMAIC 提供独立登录页，账号/角色权威在宿主，OpenMAIC 仅校验并承载会话（ARCH-007、ARCH-056）。
5. **考核结果两边记录**：课后测评与阶段考核结果先写 OpenMAIC `exam_results`，再回传宿主（ARCH-017、ARCH-036）。
