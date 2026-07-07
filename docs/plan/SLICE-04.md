# SLICE-04：课后测评与重学

## 声明
- **实现需求**：REQ-006~009, REQ-030, REQ-042, REQ-043
- **实现架构**：ARCH-006, ARCH-018, ARCH-034, ARCH-043
- **拥有路径**：`components/assessment/`, `lib/assessment/`, `app/api/courses/[id]/assessment/`
- **产出接口**：CourseAssessment、测评提交 API、重学门控
- **依赖切片**：SLICE-00, SLICE-01, SLICE-03

## 任务

### Task 1：课后测评题生成
- 课程生成后额外生成课后测评题。
- 首版只生成并接受单选/多选题。
- 管理员可手动重生成或编辑题目。

### Task 2：测评渲染与评分
- 复用现有 quiz UI/逻辑中适合单选/多选的部分。
- 使用 `gradeChoiceQuestions()` 本地评分。
- 不调用 `/api/quiz-grade`，不支持简答题。

### Task 3：提交记录
- 每次提交都创建 `assessment_attempts`。
- 记录 `attemptNumber`、score、passed、answers、details、roleSnapshot、createdAt。

### Task 4：不通过重学
- 不通过时展示错题解析。
- 重置课程完成状态和播放进度。
- 学员必须重新完成课程后才能再次测评。

### Task 5：课程完成
- 测评通过后才标记课程完成。
- 触发 iframe 即时 `course-completed` 消息，但权威结果以后端记录为准。

### Task 6：测试
- 单选/多选评分正确。
- 简答题不会进入测评。
- 失败后不能直接重测。
- 多次提交 attemptNumber 递增。


• 已完成 SLICE-04，目标已标记完成。用时约 21 分 21 秒，累计 token 用量 460380。

  改了什么

  - 新增课后测评领域逻辑：从课程 quiz 场景抽取单选/多选题、过滤主观题、评分、公开题面隐藏答案。
  - 新增学习端测评 API：获取测评、提交作答、记录尝试、失败后重置学习进度。
  - 新增管理端测评 API：手动更新测评题、从现有 quiz 场景重新生成测评题。
  - 接入播放完成页：企业课程完成后先进入课后测评；通过后才触发课程完成；未通过展示解析并要求重新学习。
  - 补充 Slice-04 单元/服务/路由测试，并更新受影响的 storage mock。

  验证结果

  - pnpm.cmd test 通过：1824 个测试全绿。
  - pnpm.cmd lint 通过：0 error，15 个既有 warning。
  - pnpm.cmd build 通过。
  - pnpm.cmd check 未通过：仓库已有大范围 Prettier 风格问题，报告 1068 files；我只对本次触及文件运行了 Prettier，避免把
    全仓格式化混进 Slice-04。

  遗留问题

  - 全仓 pnpm.cmd check 的格式化债务仍在，建议单独开一个格式化 slice 或维护任务处理。
  - 工作区开始时已有多处未提交改动，我没有回滚或覆盖这些用户/既有变更。
  - Slice-04 的播放端接入已完成；如果后续要把“已发布企业课程列表 -> 播放页”的入口做完整，需要依赖/继续前后相邻 slice 的
    learner course UI 工作。