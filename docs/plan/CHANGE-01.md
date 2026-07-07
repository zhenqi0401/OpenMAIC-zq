# CHANGE-01：PostgreSQL 课程权威存储改造

> 状态：待执行  
> 日期：2026-07-06  
> 上游：`docs/PRD.md` v0.7  
> 技术设计：`docs/technical-design.md` v0.7  
> 覆盖需求：REQ-017, REQ-018, REQ-024, REQ-025, REQ-037, REQ-041, REQ-047, REQ-048  
> 覆盖架构：ARCH-003, ARCH-005, ARCH-013, ARCH-016, ARCH-032, ARCH-033, ARCH-045, ARCH-046, ARCH-047

## 目标

将企业课程主链路从“浏览器 IndexedDB 课程内容 + 后端草稿补充”调整为“PostgreSQL 唯一课程权威源”。课程列表、课程草稿、课程场景、大纲、视频/图片/音频等课程媒体 Blob、学习进度、测评和考核均以后端数据库为准；IndexedDB 只保留浏览器运行态。

## 非目标

- 不接入 OSS 作为课程相关内容存储；课程相关视频、图片、音频和生成产物统一进入 PostgreSQL。
- 不新增独立课程编辑器，课程编辑继续复用大纲编辑、Pro Mode 和 AI 编辑助手。
- 不改变课程发布和可见范围规则：草稿仅管理员可见，学员只看已发布且对当前角色可见课程。

## Task 1：文档与契约对齐

- 更新 `docs/PRD.md`：明确课程相关内容只存 PostgreSQL，IndexedDB 不保存企业课程内容，不启用 OSS 课程存储。
- 更新 `docs/technical-design.md`：定义课程数据模型、读取响应、媒体/音频接口和 IndexedDB 运行态边界。
- 在后续实现前用 REQ/ARCH 反查确认任务覆盖完整。

## Task 2：数据库 Schema 改造

- 扩展 `courses`：增加 `stage_snapshot`、`generation_status`、`generation_complete` 等可还原课堂运行态的字段。
- 新增或调整 `course_scenes`：保存完整 `Scene` JSONB，并保留 `course_id`、`scene_key`、`scene_order`、`type`、`title` 等查询字段。
- 新增或调整 `course_outlines`：保存完整 `SceneOutline[]`、生成完成状态和更新时间。
- 新增或调整 `media_files`：按课程保存视频/图片 `media_id`、type、mime、size、prompt、params、bytea blob、poster_bytea。
- 新增 `course_audio_blobs`：按课程保存 `audio_id`、mime、size、text、voice、bytea blob。

## Task 3：后端课程写入服务

- 课程生成开始前必须创建 PostgreSQL 课程草稿并绑定分类。
- 没有课程管理权限、未选择分类或后端写入失败时，阻止进入企业课程生成主流程并显示明确错误。
- 每生成一个 Scene 后写入 `course_scenes`，并更新 `stage_snapshot`、`course_outlines` 和生成状态。
- 视频和图片生成完成后写入 `media_files` 的 PostgreSQL Blob 字段，Scene 中只保留稳定 `mediaId`。
- TTS 生成完成后写入 `course_audio_blobs`，Scene 中只保留稳定 `audioId`。
- 生成完成后设置 `generation_complete = true`。

## Task 4：课程读取 API

- `GET /api/courses` 从 PostgreSQL 返回学员可见课程列表。
- `GET /api/courses/:id` 返回 `{ course, stage, scenes, outlines, mediaManifest, audioManifest }`，可直接驱动课堂播放。
- `GET /api/admin/courses` 返回管理员可见的 draft / published / archived 课程列表。
- `GET/PATCH /api/admin/courses/:id/content` 读取和保存管理员课程内容。
- `GET /api/courses/:id/media/:mediaId` 鉴权后流式返回 PostgreSQL 视频/图片 Blob。
- `GET /api/courses/:id/audio/:audioId` 鉴权后流式返回 PostgreSQL 音频 Blob。

## Task 5：首页和后台课程入口

- 首页不再通过 `listStages()` 读取 IndexedDB 企业课程。
- 登录用户首页调用 `/api/courses` 展示数据库课程。
- 后台课程管理调用 `/api/admin/courses` 展示数据库草稿、已发布和已归档课程。
- 首页课程卡片点击进入 `/classroom/<courseId>`，其中 `<courseId>` 是 PostgreSQL course id。

## Task 6：课堂加载改造

- `/classroom/[id]` 主链路按 PostgreSQL course id 调用 `/api/courses/:id`。
- 将接口返回的 `stage/scenes/outlines/audioManifest` 注入现有 Zustand 运行态，用于课堂播放。
- 播放视频、图片和音频时通过后端媒体 URL 读取，不从 IndexedDB 或 OSS 取课程媒体 Blob。
- 学习进度继续写 `/api/courses/:id/progress`。

## Task 7：IndexedDB 降级清理

- 企业课程主链路不再调用 `saveStageData/loadStageData/listStages` 保存或读取课程内容。
- IndexedDB 保留设置、临时表单、播放引擎瞬时状态、会话恢复标记等浏览器运行态。
- 若后续保留 ZIP/本地导入，应在 UI 和路由上明确标记为本地课程，不与企业课程混用。

## Task 8：迁移与可观测性

- 后台对“草稿存在但内容未保存/生成未完成”的课程显示明确状态。
- 记录生成写库失败原因：分类缺失、未登录、非管理员、数据库写入失败、音频超限。

## 验收标准

- 新生成课程在 PostgreSQL 中有 `courses`、`course_scenes`、`course_outlines` 和必要媒体/音频记录。
- 管理员生成课程后，后台课程管理可以看到该草稿。
- 学员换浏览器登录后，可以从首页看到已发布可见课程，并打开对应内容。
- 课堂播放不依赖 IndexedDB 或 OSS 中的课程、场景、大纲或媒体 Blob。
- 媒体 Blob 不内联在课程详情 API 中，而是通过鉴权媒体/音频接口读取。
