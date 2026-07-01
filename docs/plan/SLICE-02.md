# SLICE-02：iframe 嵌入桥接层

## 声明
- **实现需求**：REQ-013, REQ-014, REQ-015, REQ-016, REQ-021
- **实现架构**：ARCH-001, ARCH-020~027, ARCH-040, ARCH-041
- **拥有路径**：`lib/embed/`, `components/embed/`, `app/embed/`
- **产出接口**：`useEmbedBridge()` Hook（ARCH-040）、`EmbedProvider`（ARCH-041）、嵌入入口页
- **消费接口**：postMessage 类型定义（SLICE-00）、`isOriginAllowed()`（SLICE-00）；登录会话由 SLICE-07 提供（embed-bridge 不做鉴权）
- **依赖切片**：SLICE-00
- **说明**：本切片只做嵌入与消息协议；**用户身份/登录归 SLICE-07（auth）**，`init` 仅传上下文（tenant/theme/locale），不作为登录凭证（ARCH-020）

## 任务

### Task 1：Embed Bridge 核心逻辑
- 创建 `lib/embed/embed-bridge.ts`
- 实现 `EmbedBridge` 类：
  - `constructor(allowedOrigins: string[])` — 初始化 origin 白名单
  - `listen()` — 注册 `window.addEventListener('message', ...)` 监听器
  - `destroy()` — 移除监听器
  - `sendToHost(msg: OpenMAICMessage)` — 调用 `window.parent.postMessage()`，校验 origin
  - `onMessage(type: string, handler)` — 注册消息处理器，返回取消函数
  - `handleInit(payload: InitPayload)` — 处理 init 上下文握手（设置 tenant/theme/locale），**不校验登录 token**（登录归 SLICE-07）
- 消息过滤：忽略 `source !== 'host'` 的消息
- origin 校验：`event.origin` 不在白名单中时静默丢弃 + `console.warn`

### Task 2：EmbedProvider React Context
- 创建 `components/embed/embed-provider.tsx`（ARCH-041）
- 创建 `EmbedContext`，值类型对应 ARCH-040 的 `useEmbedBridge()` 输出
- `EmbedProvider` 组件：
  - mount 时创建 `EmbedBridge` 实例
  - 检测 `window.self !== window.top` 判断嵌入模式
  - 非嵌入模式：提供空操作默认值，`isEmbedded: false`
  - 嵌入模式：等待 `init` 消息完成上下文握手，设置 `tenantId`、`hostOrigin`（userId/role 由 SLICE-07 的 `useSession()` 提供，不在此设置）
- 创建 `lib/embed/use-embed-bridge.ts` — 简单 `useContext` 包装

### Task 3：嵌入模式入口页
- 创建 `app/embed/page.tsx`
- 精简 UI：无顶部导航、无侧边栏、无 footer（REQ-015）
- 使用独立的 `EmbedLayout` 组件包裹
- 根据 postMessage 指令路由到不同视图：
  - `load-course` → 跳转到 classroom
  - `start-exam` → 渲染 StageExam（SLICE-05 提供）
  - 默认 → 显示等待初始化状态

### Task 4：嵌入布局组件
- 创建 `components/embed/embed-layout.tsx`（REQ-015）
- 全屏无边框布局，隐藏 OpenMAIC 自身的导航元素
- 支持通过 `init` 消息传入的 `theme` 参数切换主题色
- 支持通过 `init` 消息传入的 `locale` 参数设置语言

### Task 5：宿主集成示例
- 创建 `lib/embed/host-sdk.ts`
- 提供宿主系统使用的示例代码：
  - `createOpenMAICIframe(container, config)` — 创建 iframe 并发送 init
  - `onMessage(iframe, type, handler)` — 监听 OpenMAIC 消息
  - `sendCommand(iframe, type, payload)` — 向 OpenMAIC 发送指令
- 代码注释详细说明使用方法
- 不作为 npm 包发布，仅作为集成参考

### Task 6：EmbedProvider 集成到 App Layout
- 修改 `app/layout.tsx`，在 `LoginGuard`（SLICE-07）外层（或平级）包裹 `EmbedProvider`
- 登录始终由 `LoginGuard` 把关（嵌入与独立模式一致）；`EmbedProvider` 仅负责上下文与消息路由
- 非嵌入模式保持现有行为不变

### Task 7：postMessage 消息路由
- 在 `EmbedProvider` 中实现消息路由逻辑
- 收到 `load-course` → 使用 Next.js router 导航到 `/classroom/{courseId}`
- 收到 `start-exam` → 设置 context state 渲染 StageExam
- 收到 `retake` → 重置课程进度，导航到课程首页
- 发送 `init-ack` / `course-loaded` / `quiz-result` / `course-completed` / `exam-result` / `course-published`
