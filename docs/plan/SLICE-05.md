# SLICE-05：阶段综合考核

## 声明
- **实现需求**：REQ-010~012, REQ-028~032
- **实现架构**：ARCH-007, ARCH-019, ARCH-020, ARCH-035, ARCH-042
- **拥有路径**：`components/admin/exams/`, `components/assessment/stage-exam.tsx`, `lib/exams/`, `app/api/exams/`, `app/api/admin/exam-policies/`
- **产出接口**：阶段考核策略管理、组卷、考试渲染、提交记录
- **依赖切片**：SLICE-00, SLICE-01, SLICE-04

## 任务

### Task 1：考核策略管理
- 管理员创建阶段考核策略。
- 策略包含目标角色、分类范围、课程范围、题量、时限、通过阈值。
- 课程范围为空时表示所选分类下全部已发布课程。

### Task 2：题库统计
- 后台显示策略候选题量。
- 候选题只统计单选/多选。
- 课内 quiz 和课后测评题都可作为题源。

### Task 3：发布考核
- 管理员发布策略后，符合目标角色的学员可在 OpenMAIC 中看到考核任务。
- 首版不依赖宿主 `start-exam` 触发。

### Task 4：抽题组卷
- 开始考试时服务端按策略抽题。
- 过滤掉简答题和无正确答案题。
- 保存 `questionRefs`，不复制来源题所有权。

### Task 5：考试渲染与评分
- 渲染单选/多选考试。
- 本地或服务端使用相同选择题评分规则。
- 记录分数、通过状态、用时、attemptNumber、roleSnapshot、questionRefs。

### Task 6：测试
- 不同角色只看到自己的考核。
- 只抽单选/多选。
- 分类/课程筛选正确。
- 提交结果写入 `exam_attempts` 并可被看板查询。


• Slice-05 已完成并已标记目标完成。

  改动概要：

  - 新增阶段考核核心逻辑：lib/exams/stage-exam.ts
  - 补齐学员端 API：GET /api/exams、POST /api/exams/[id]/start、POST /api/exams/[id]/attempts
  - 扩展企业存储服务与 Drizzle 仓储，支持考核抽题、提交、exam_attempts 写入和看板查询
  - 新增管理员阶段考核策略 UI：components/admin/exams/ExamPolicyAdminPanel.tsx
  - 新增学员阶段考核入口与答题 UI：components/assessment/StageExamPanel.tsx
  - 增加 Slice-05 测试：服务、路由、管理员 client helper

  验证结果：

  - pnpm.cmd test：235 files / 1834 tests 全通过
  - pnpm.cmd lint：通过，仍有既有 warning，无新增 error
  - pnpm.cmd build：通过
  - pnpm.cmd check：Prettier 全通过

  遗留问题：

  - pnpm.cmd lint 仍报告仓库既有 warning，比如 app/page.tsx 的旧 hook dependency warning 和 importer 包中的旧 warning。
  - 工作区原本已有 docs/*、AGENTS.md 等未提交变更，我按边界保留未回退。