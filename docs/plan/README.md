# 切片计划总览

> 上游：`docs/PRD.md`（REQ-ID）、`docs/technical-design.md`（ARCH-ID）
> v0.2 变更：新增 SLICE-07（登录与会话）；SLICE-05 改为按角色从题库抽题 + 双边记录；SLICE-04 课后测评结果持久化；SLICE-00/01 补充会话/角色/题库/考核结果。

## 切片列表

| 切片 | 名称 | 职责 | 依赖 | 满足需求 |
|---|---|---|---|---|
| SLICE-00 | 地基：共享类型与安全基础 | postMessage 类型、会话/角色 token、数据库 schema（含 exam_results、category）、ExamPolicy/题库类型、共享配置 | — | REQ-014, REQ-021~023, REQ-026~030 |
| SLICE-01 | 后端存储服务 | PostgreSQL + 阿里云 OSS、CRUD API、媒体上传、题库聚合/抽题、考核结果记录 | SLICE-00 | REQ-017~020, REQ-024, REQ-028~030 |
| SLICE-02 | iframe 嵌入桥接层 | EmbedProvider、postMessage 收发、origin 校验、init 上下文握手、嵌入布局（不含登录） | SLICE-00 | REQ-013~016, REQ-021 |
| SLICE-03 | 内容预览与编辑 | 生成流程改造、内容预览页、场景编辑器、媒体按需触发、课后测评题目编辑 | SLICE-00 | REQ-001~005 |
| SLICE-04 | 课后测评与重学 | 课后测评门控、AI 自动生成测评题、通过/不通过判定、重学流程、结果持久化+回传 | SLICE-00, SLICE-01, SLICE-03 | REQ-006~009, REQ-030 |
| SLICE-05 | 阶段综合考核 | 按角色从分类课程题库抽题组卷、计时、评分、结果双边记录、宿主消息集成 | SLICE-00, SLICE-01, SLICE-02 | REQ-010~012, REQ-028~031 |
| SLICE-06 | 前端存储同步 | IndexedDB ↔ 服务端同步、离线暂存、冲突解决、同步状态 UI | SLICE-00, SLICE-01 | REQ-025 |
| SLICE-07 | 登录与会话 | 独立登录页、联合宿主账号服务校验、会话 token 签发、LoginGuard、角色注入、middleware 扩展 | SLICE-00 | REQ-026, REQ-027, REQ-023 |

## 依赖关系

```
SLICE-00 (地基)
  ├── SLICE-01 (后端存储)
  │     ├── SLICE-06 (前端同步)
  │     ├── SLICE-04 (课后测评：结果持久化)
  │     └── SLICE-05 (阶段考核：抽题+记录)
  ├── SLICE-02 (嵌入桥接)
  │     └── SLICE-05 (阶段考核)
  ├── SLICE-03 (内容预览)
  │     └── SLICE-04 (课后测评)
  └── SLICE-07 (登录与会话，独立于其它业务切片，建议早做)
```

## 集成检查点

1. **SLICE-00 完成后**：验证类型定义编译通过、会话 token 签发/校验单元测试通过、数据库迁移可执行（含 exam_results、category）
2. **SLICE-07 完成后**：验证未登录被 LoginGuard 拦截、联合宿主账号服务校验成功后建立会话、middleware 注入 userId/role/tenant
3. **SLICE-01 + SLICE-02 完成后**：验证嵌入模式 init 上下文握手、API 鉴权 e2e 通过、题库统计/抽题接口可用
4. **SLICE-03 完成后**：验证生成流程拆分——大纲确认后进入内容预览，视频不自动生成
5. **SLICE-04 完成后**：验证课后测评全流程——课程播放完毕 → 测评 → 通过/重学 → 结果两边记录
6. **SLICE-05 完成后**：验证管理员按角色触发 → OpenMAIC 从题库抽题组卷 → 评分 → 结果两边记录 + 回传
7. **全部完成后**：端到端验证——登录 → 课程生成 → 预览编辑 → 学习 → 课后测评 → 阶段考核 → 结果回传宿主且本地留存

