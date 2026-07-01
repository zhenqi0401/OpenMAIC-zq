# SLICE-07：登录与会话

## 声明
- **实现需求**：REQ-026, REQ-027, REQ-023
- **实现架构**：ARCH-007, ARCH-018, ARCH-034, ARCH-047, ARCH-048, ARCH-056
- **拥有路径**：`app/login/`, `app/api/auth/`, `components/auth/`, `lib/auth/`
- **产出接口**：`/api/auth/*`、`useSession()` Hook、`LoginGuard` 组件（ARCH-048）
- **消费接口**：`createSessionToken()`/`validateSessionToken()`（SLICE-00）、`SessionIdentity` 类型（SLICE-00）
- **依赖切片**：SLICE-00
- **说明**：OpenMAIC 进入需登录；账号/角色权威在宿主账号服务，OpenMAIC 仅联合校验并承载会话。替代现有 `AccessCodeGuard`。

## 任务

### Task 1：联合宿主账号服务校验客户端
- 创建 `lib/auth/host-account-client.ts`（ARCH-056）
- 实现 `verifyCredentials({ username, password, tenantId? })` — 调用 `HOST_ACCOUNT_SERVICE_URL`（env，SLICE-00 Task 5）校验
- 成功返回 `{ userId, role, tenantId, displayName }`；失败返回明确错误
- 校验协议作为集成契约：POST 凭证 → 返回身份；超时/不可达走错误处理（见风险表）

### Task 2：登录/注销/会话 API
- 创建 `app/api/auth/login/route.ts`（ARCH-034）
  - POST 接收凭证 → 调 `verifyCredentials()` → 成功后用 `createSessionToken({ userId, role, tenantId })` 签发会话 token → 写 `openmaic_session` cookie（HttpOnly）
  - 嵌入模式可同时在响应体返回 token（供 `Authorization: Bearer` 使用，规避第三方 cookie 限制）
- 创建 `app/api/auth/logout/route.ts` — POST 清除会话 cookie
- 创建 `app/api/auth/session/route.ts` — GET 校验当前会话并返回 `{ authenticated, identity? }`

### Task 3：middleware 会话校验对接
- 与 SLICE-00 Task 3 的 `embed-auth-middleware.ts` 对接：`middleware.ts` 校验 `openmaic_session` cookie 或 `Authorization: Bearer` token
- 白名单：`/api/auth/*`、`/login`、健康检查
- 未登录的页面请求放行（前端 `LoginGuard` 弹登录）；未登录的 `/api/*` 返回 401

### Task 4：useSession Hook
- 创建 `lib/auth/use-session.ts`（ARCH-048）
- 输出：`{ authenticated, identity, login(creds), logout() }`
- `login()` → POST `/api/auth/login`；`logout()` → POST `/api/auth/logout`
- 挂载时 GET `/api/auth/session` 获取当前身份；身份含 `role`，供 SLICE-05 抽题取角色

### Task 5：LoginGuard 与登录页
- 创建 `components/auth/login-guard.tsx`（ARCH-048）——替代现有 `AccessCodeGuard`
  - 未登录时渲染登录页，已登录渲染子树
  - 错误兜底：会话查询失败默认要求登录（与现有 `AccessCodeGuard` 一致的安全默认）
- 创建 `components/auth/login-page.tsx` / `app/login/page.tsx` —— 独立登录页 UI（账号 + 凭证），调用 `useSession().login()`
- 修改 `app/layout.tsx`：用 `LoginGuard` 包裹（替换 `AccessCodeGuard`）；与 `EmbedProvider`（SLICE-02）协同——嵌入模式同样经 `LoginGuard`

### Task 6：兼容与降级
- 若未配置 `HOST_ACCOUNT_SERVICE_URL`：保留现有单一 `ACCESS_CODE` 行为作为降级（独立部署不接宿主时仍可用）
- 文档说明两种模式：联合宿主登录（企业集成） vs 单一 ACCESS_CODE（独立部署）
