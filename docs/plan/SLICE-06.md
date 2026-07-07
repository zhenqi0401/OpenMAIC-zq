# SLICE-06：前端缓存与弱网恢复

## 声明
- **实现需求**：REQ-025
- **实现架构**：ARCH-003
- **拥有路径**：`lib/storage/sync-manager.ts`, `lib/storage/use-course-storage.ts`, `components/sync-status-indicator.tsx`
- **产出接口**：后端权威 + IndexedDB 缓存的课程存取层
- **依赖切片**：SLICE-00, SLICE-01

## 任务

### Task 1：缓存定位调整
- 明确 IndexedDB 只保存已加载课程、草稿、播放恢复点和媒体本地副本。
- 正式课程列表、发布状态、可见范围、测评/考核结果以后端为准。

### Task 2：课程读取
- 优先从后端加载课程。
- 后端不可用时，可读取 IndexedDB 缓存并提示离线/缓存状态。

### Task 3：草稿保存
- 管理员编辑草稿时可本地暂存。
- 发布/保存正式版本必须成功写后端。

### Task 4：媒体缓存
- OSS 是媒体权威来源。
- IndexedDB 可缓存 Blob 以优化本地播放，但不能作为跨设备来源。

### Task 5：同步状态 UI
- 显示 synced / syncing / offline / error。
- 管理员保存失败时给出明确提示，不能假装发布成功。

### Task 6：测试
- 后端可用时读写后端。
- 后端不可用时只读缓存并提示。
- 发布操作后端失败时失败，不落为成功状态。
