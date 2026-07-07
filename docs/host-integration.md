# 宿主系统集成说明：入口与看板查询
> 版本 v0.1 · 2026-07-01 · 辅助文档。需求来源见 `docs/PRD.md`，技术契约见 `docs/technical-design.md`。

## 集成边界

宿主系统首版只承担两件事：

1. **入口**：提供进入 OpenMAIC 的按钮或 iframe 页面。管理员入口通过宿主 SSO 传 `hostUserId`，OpenMAIC 自动绑定管理员账号。
2. **看板查询**：宿主后端用 API Key 调用 OpenMAIC 查询 API，展示课程学习、课后测评和阶段考核数据。

宿主系统不直接访问 OpenMAIC 数据库，也不需要实现回调接收接口。OpenMAIC 数据库是私有权威数据源。

## 管理员入口

管理员从宿主进入 OpenMAIC 时，宿主后端生成一次 SSO 请求：

```http
POST /api/auth/host-sso
Content-Type: application/json
Authorization: Bearer <host-sso-signature-or-token>

{
  "hostUserId": "host-user-123"
}
```

OpenMAIC 行为：

- 如果 `hostUserId` 没有绑定用户，创建一个管理员账号并绑定。
- 如果已经绑定，复用原管理员账号。
- 返回 OpenMAIC 会话交换结果，宿主前端再打开 OpenMAIC 页面或 iframe。

首版只要求宿主传 `hostUserId`，不强制传手机号、姓名或宿主角色。

## 学员入口

学员账号由 OpenMAIC 自己维护：

- 学员用手机号 + 密码 + 邀请码注册。
- 邀请码绑定 OpenMAIC 内部角色。
- 学员登录后看到已发布且对其角色可见的课程列表。

宿主可以提供普通入口跳转到 OpenMAIC 登录页，但不需要替学员创建账号。

## 看板查询 API

宿主看板由宿主后端调用 OpenMAIC 查询 API。不要在宿主前端暴露 API Key。

### 鉴权

```http
Authorization: Bearer <OPENMAIC_HOST_API_KEY>
```

API Key 由 OpenMAIC 管理员或部署方生成，可停用和轮换。

### 汇总数据

```http
GET /api/host/summary?from=2026-07-01&to=2026-07-31
```

返回示例：

```json
{
  "courses": {
    "published": 12,
    "learnersStarted": 240,
    "learnersCompleted": 180,
    "completionRate": 75
  },
  "assessments": {
    "attempts": 320,
    "passed": 210,
    "passRate": 65
  },
  "exams": {
    "attempts": 96,
    "passed": 70,
    "passRate": 73
  }
}
```

### 课程学习明细

```http
GET /api/host/courses/{courseId}/progress?roleId={roleId}
```

用途：宿主看某门课下哪些学员开始、完成、未完成。

### 课后测评记录

```http
GET /api/host/assessments?courseId={courseId}&userId={userId}
```

用途：查看每次课后测评提交，包含失败尝试和通过尝试。

### 阶段考核记录

```http
GET /api/host/exams?examPolicyId={examPolicyId}&roleId={roleId}
```

用途：查看阶段考核参与、分数、通过状态和用时。

## postMessage 的用途

postMessage 只用于 iframe 页面即时通知，例如：

- iframe 初始化完成。
- 课程加载完成。
- 学员刚完成测评。
- 学员刚完成课程。
- 学员刚提交阶段考核。

这些消息不作为宿主看板的权威数据。宿主看板应通过查询 API 获取 OpenMAIC 后端记录。

## 不做的集成方式

- 不让宿主直接读写 OpenMAIC PostgreSQL 表。
- 首版不要求 OpenMAIC 回调宿主接口。
- 不把 postMessage 当作最终数据同步通道。
- 不要求宿主系统维护 OpenMAIC 学员账号、课程可见范围或阶段考核策略。
