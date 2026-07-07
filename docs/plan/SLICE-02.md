# SLICE-02：iframe 嵌入与即时消息

## 声明
- **实现需求**：REQ-013~016, REQ-021, REQ-022
- **实现架构**：ARCH-001
- **拥有路径**：`app/embed/`, `components/embed/`, `lib/embed/`
- **产出接口**：EmbedProvider、useEmbedBridge、最小 postMessage 协议
- **依赖切片**：SLICE-00, SLICE-07

## 任务

### Task 1：嵌入入口
- 提供 iframe 可加载入口。
- 嵌入模式隐藏不必要外框 UI。
- 登录仍以 OpenMAIC 会话为准；未登录时展示登录/SSO 流程。

### Task 2：origin 与 CSP
- 校验宿主 origin 白名单。
- 配置 frame-ancestors 允许目标宿主域名。

### Task 3：最小 postMessage
- 支持 `init`：传主题、语言等上下文，不传登录凭证。
- 支持 `load-course`：请求加载指定课程；服务端仍做可见范围校验。
- 支持 `quiz-result`、`course-completed`、`exam-result` 即时通知。
- 不把 postMessage 作为宿主看板权威数据来源。

### Task 4：宿主 SDK 示例
- 提供创建 iframe、发送 init/load-course、监听即时消息的示例。
- 文档说明宿主看板数据应调用 `/api/host/*` 查询 API。

### Task 5：测试
- 非白名单 origin 消息被拒绝。
- iframe 布局无多余导航。
- postMessage 即时通知不影响后端权威记录。
