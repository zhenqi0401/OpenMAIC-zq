# SLICE-06：前端存储同步

## 声明
- **实现需求**：REQ-025
- **实现架构**：ARCH-004, ARCH-046, ARCH-054
- **拥有路径**：`lib/storage/sync-manager.ts`, `lib/storage/use-course-storage.ts`
- **产出接口**：`useCourseStorage()` Hook（ARCH-046）
- **消费接口**：`StorageAPI` 客户端（SLICE-01，ARCH-045）、Dexie `db`（现有）、`useEmbedBridge()`（SLICE-02，读取 tenantId）
- **依赖切片**：SLICE-00, SLICE-01

## 任务

### Task 1：同步管理器
- 创建 `lib/storage/sync-manager.ts`
- 实现 `SyncManager` 类：
  - 维护待同步操作队列（Zustand store 或独立 class）
  - `enqueue(operation)` — 将写操作加入队列
  - `flush()` — 将队列中的操作按序发送到服务端
  - `startAutoSync(intervalMs)` — 启动定时自动同步（默认 30 秒）
  - `stopAutoSync()` — 停止自动同步
- 网络状态检测：`navigator.onLine` + `online`/`offline` 事件
- 离线时暂停同步，恢复时自动 flush
- 队列持久化到 localStorage（防止页面刷新丢失未同步操作）

### Task 2：useCourseStorage Hook
- 创建 `lib/storage/use-course-storage.ts`（ARCH-046）
- 返回值：
  - `saveCourse(stage, scenes)` — 先写 IndexedDB，再 enqueue 到 SyncManager
  - `loadCourse(courseId)` — 优先调用 `StorageAPI.getCourse()`，失败回退 IndexedDB
  - `syncStatus` — 'synced' | 'syncing' | 'offline' | 'error'
  - `lastSyncAt` — 最后成功同步时间戳
- 内部逻辑：
  - 写入时立即更新 IndexedDB（用户无感知延迟）
  - 后台通过 SyncManager 异步推送到服务端
  - 读取时：嵌入模式 → 服务端优先；独立模式 → IndexedDB 优先

### Task 3：冲突解决策略
- 实现 last-write-wins 策略（ARCH-054）：
  - 同步时携带 `clientUpdatedAt` 时间戳
  - 服务端返回 409 CONFLICT 时，比较时间戳
  - 客户端更新 > 服务端 → 重试提交（强制覆盖标记）
  - 服务端更新 > 客户端 → 接受服务端数据，更新本地 IndexedDB
- 冲突场景在企业培训中极少（同一课程不会被并发编辑），因此策略简单

### Task 4：同步状态 UI 组件
- 创建 `components/sync-status-indicator.tsx`
- 在嵌入模式下显示同步状态图标（位于页面底部或工具栏）：
  - synced → 绿色对勾
  - syncing → 蓝色旋转图标
  - offline → 灰色断网图标 + tooltip "离线模式，编辑内容将在恢复网络后同步"
  - error → 红色感叹号 + tooltip 显示错误信息
- 非嵌入模式且无 `DATABASE_URL` 配置时不显示

### Task 5：现有代码集成点
- 修改 `app/classroom/[id]/page.tsx`：
  - `loadFromStorage()` 逻辑改为调用 `useCourseStorage().loadCourse()`
  - 保持现有 IndexedDB 加载作为 fallback
- 修改 `app/generation-preview/page.tsx`：
  - 课程生成完成后调用 `useCourseStorage().saveCourse()` 持久化
  - 内容预览编辑保存时也通过 `saveCourse()` 同步
- 修改课程删除流程：同步删除服务端数据

### Task 6：媒体文件同步
- 媒体文件（视频/图片/音频）生成完成后：
  - 先存 IndexedDB（现有行为不变）
  - 通过 `StorageAPI.getPresignedUrl()` 获取 STS 凭证
  - 使用 `ali-oss` SDK 直传到 OSS
  - 调用 `StorageAPI.confirmUpload()` 确认
  - 将 `ossKey` 回写到 IndexedDB 的 `MediaFileRecord`（复用现有 `ossKey` 字段）
- 加载时：有 `ossKey` → 从 OSS 加载；无 `ossKey` → 从 IndexedDB 加载
- 上传失败时静默忽略，下次同步重试

### Task 7：渐进式降级
- 当 `DATABASE_URL` 未配置时：
  - `useCourseStorage()` 回退为纯 IndexedDB 模式
  - `syncStatus` 固定为 `'offline'`
  - 所有读写直接操作 IndexedDB（现有行为）
  - 不显示同步状态指示器
- 确保现有独立部署用户不受影响
