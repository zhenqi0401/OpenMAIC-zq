# SLICE-01：后端存储与查询 API

## 声明
- **实现需求**：REQ-017~020, REQ-034~046
- **实现架构**：ARCH-003, ARCH-013~021, ARCH-032, ARCH-033, ARCH-036, ARCH-044
- **拥有路径**：`app/api/admin/`, `app/api/courses/`, `app/api/host/`, `app/api/storage/`, `lib/storage/`, `lib/host-api/`
- **产出接口**：后台 CRUD API、学员课程 API、宿主查询 API、OSS 上传元数据 API
- **依赖切片**：SLICE-00, SLICE-07

## 任务

### Task 1：数据库访问层
- 封装 Drizzle DB 实例和事务工具。
- 所有读写走服务端权威数据；IndexedDB 不作为后端数据来源。

### Task 2：课程与内容存储 API
- 课程 CRUD：草稿、发布、下架、分类、可见范围。
- 场景、outlines、agents、actions、whiteboard 写入 PostgreSQL。
- 媒体上传走 OSS 预签名 URL，数据库保存 `ossKey`、mime、size、prompt、params。

### Task 3：管理员后台 API
- 角色、邀请码、用户角色、课程分类、课程可见范围、阶段考核策略 CRUD。
- 所有 `/api/admin/*` 必须校验管理员权限。

### Task 4：学员课程 API
- `GET /api/courses` 只返回已发布且当前角色可见课程。
- `GET /api/courses/:id` 校验可见范围后返回完整课程数据。
- `PATCH /api/courses/:id/progress` 保存播放进度。

### Task 5：OpenMAIC 管理后台看板 API
- `GET /api/admin/dashboard` 返回课程完成率、测评通过率、阶段考核通过率和学员明细入口数据。
- 支持按课程、角色、时间范围过滤。

### Task 6：宿主查询 API
- `GET /api/host/summary`
- `GET /api/host/courses/:id/progress`
- `GET /api/host/assessments`
- `GET /api/host/exams`
- 使用 API Key/Secret 鉴权；不要求宿主接收回调，不允许宿主直连数据库。

### Task 7：降级与兼容
- 开发环境未配置后端时可提示不可用或进入本地演示模式，但企业正式流程以后端为准。
- 老 IndexedDB 课程不自动迁移；可继续通过原 ZIP 功能人工搬运，但不作为企业主流程。

### Task 8：测试
- 课程可见范围过滤。
- 管理员/学员 API 权限。
- 宿主 API Key 成功/失败。
- OSS 元数据写入和读取。


• 完成情况
  Slice-01 已完成，并已把 /goal 标记为完成。主要改动：

  - 新增企业后端存储层：lib/storage/enterprise-service.ts、lib/storage/enterprise-repository.ts、lib/storage/db.ts
  - 新增 Slice-01 API：/api/admin/*、/api/courses/*、/api/host/*、/api/storage/*
  - 数据库结构补齐媒体元数据 size_bytes：lib/storage/schema/index.ts、drizzle/0000_slice_00_foundation.sql
  - 权限模型按 Slice-01 落地：管理员 API 走 requireCurrentAdmin()；学员课程 API 走当前会话角色可见性；宿主查询 API 走
    Bearer API Key/Secret

  - 补了看板/宿主查询的 courseId、roleId、userId、时间范围过滤，并用 TDD 先看到失败再实现
  - 新增测试：tests/storage/slice01-service.test.ts、tests/storage/slice01-routes.test.ts

  验证结果

  - pnpm.cmd test 通过：226 files，1799 tests
  - pnpm.cmd lint 通过：0 errors，15 warnings；这些 warning 在既有文件里，非本次 Slice-01 引入
  - pnpm.cmd build 通过
  - 目标文件 Prettier check 通过

  遗留问题
  Slice-01 功能侧没有已知遗留。工作区里仍有本次任务外的既有脏改动/未跟踪目录，例如 docs/*、缓存、模型目录等，我没有回滚
  或整理它们。