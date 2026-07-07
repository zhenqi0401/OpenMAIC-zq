# SLICE-07：账号、角色与管理员入口

## 声明
- **实现需求**：REQ-026, REQ-027, REQ-033, REQ-034, REQ-035, REQ-036
- **实现架构**：ARCH-004, ARCH-030, ARCH-031, ARCH-040
- **拥有路径**：`app/login/`, `app/register/`, `app/api/auth/`, `components/auth/`, `lib/auth/`, `components/admin/`
- **产出接口**：登录/注册/会话 API、宿主 SSO 绑定 API、后台入口权限
- **依赖切片**：SLICE-00

## 任务

### Task 1：手机号密码注册登录
- 实现 `POST /api/auth/register`：校验手机号、密码、邀请码；创建用户并写入邀请码绑定角色。
- 实现 `POST /api/auth/login` / `logout` / `session`。
- 首版不做短信验证码、找回密码和多因素认证。

### Task 2：邀请码注册
- 注册时校验邀请码启用状态、有效期和绑定角色。
- 邀请码只作为初始角色分配；岗位变更由管理员修改用户角色。

### Task 3：宿主 SSO 管理员绑定
- 实现 `POST /api/auth/host-sso`。
- 宿主请求只需传 `hostUserId` 并通过签名校验。
- 首次进入创建管理员用户并绑定 `hostUserId`；后续自动登录同一管理员账号。

### Task 4：会话守卫
- 替换原 `AccessCodeGuard` 企业版主流程。
- 未登录用户进入登录页；注册入口只面向学员。
- 管理员权限由当前用户角色的 `isAdmin` 决定。

### Task 5：统一首页分流
- 所有用户登录后默认进入课程列表。
- 管理员在课程列表页看到一个简洁后台入口按钮。
- 普通学员不显示后台入口，也不能直接访问后台路由。

### Task 6：用户角色管理入口
- 管理后台中提供用户列表和修改用户当前角色的能力。
- 历史学习/测评/考核记录保留提交时的角色快照，不随当前角色变化回写。

### Task 7：测试
- 注册成功、邀请码失效/过期/错误失败。
- 宿主 SSO 首次创建管理员、二次复用绑定账号。
- 普通学员访问后台返回 403 或跳转。


• Slice-07 已完成并验证。

  改动要点：

  - 新增账号服务与仓储：注册、登录、session、host SSO、邀请码 hash/校验、用户角色修改，见 lib/auth/
    service.ts:159。

  - 新增 auth API：/api/auth/register、login、logout、session、host-sso，并写入 openmaic_session 签名
    cookie。

  - 新增后台用户 API：GET /api/admin/users、PATCH /api/admin/users/[id]/role，普通学员访问返回 403。
  - 替换主流程守卫：app/layout.tsx 改用 session guard；登录/注册页已加入；首页管理员可见后台入口；新增最小后
    台用户角色管理页。

  - 保留 Slice-07 边界：未扩展课程发布、考试、看板、host 查询 API 等其它 Slice。

  验证结果：

  - pnpm.cmd test：通过，224 个测试文件、1784 个测试全绿。
  - pnpm.cmd lint：通过，仍有 15 个既有 warning，无新增 error。
  - pnpm.cmd build：通过。
  - 额外跑了 touched files 的 Prettier check：通过。
  - pnpm.cmd check：失败，原因是仓库大量既有文件不符合当前 Prettier endOfLine: lf 检查，不限于本次改动。

  遗留问题：

  - 管理后台的角色修改首版是最小入口，使用 roleId 输入；更完整的角色/邀请码维护属于后续后台 CRUD 扩展。
  - Next 构建提示 middleware 文件约定已 deprecated，建议后续迁到 proxy。