# SLICE-05：阶段综合考核

## 声明
- **实现需求**：REQ-010, REQ-011, REQ-012, REQ-028, REQ-029, REQ-030, REQ-031
- **实现架构**：ARCH-006, ARCH-008, ARCH-017, ARCH-022, ARCH-025, ARCH-035, ARCH-036, ARCH-044, ARCH-055
- **拥有路径**：`components/assessment/stage-exam.tsx`, `lib/assessment/exam-timer.ts`
- **产出接口**：`StageExam` 组件（ARCH-044）
- **消费接口**：`useEmbedBridge()`（SLICE-02）、`ExamBankAPI`（SLICE-01：`assembleExam`/`saveExamResult`）、`useSession()`（SLICE-07：当前角色）、`QuizQuestion` 类型（现有）、`gradeChoiceQuestions()`（现有）、postMessage 类型（SLICE-00）
- **依赖切片**：SLICE-00, SLICE-01, SLICE-02
- **说明**：阶段考核**不为考核生成新题**，题目由 SLICE-01 的 `assembleExam(ExamPolicy)` 从分类课程题库抽取（题源 = 课内 quiz 题 + 课后测评题）；结果两边记录。

## 任务

### Task 1：综合考核渲染组件
- 创建 `components/assessment/stage-exam.tsx`（ARCH-044）
- Props：`{ examId, questions, questionRefs?, timeLimit?, passThreshold?, onComplete }`（questions 为抽题组卷结果）
- 全屏渲染模式（覆盖其他内容）
- UI 流程：
  1. 考核介绍页：标题、题目数量、时限（如有）、「开始考核」按钮
  2. 答题页：逐题或全部展示（根据题量选择）
  3. 提交确认对话框
  4. 结果页：分数、通过/不通过、各题详情

### Task 2：考核计时器
- 创建 `lib/assessment/exam-timer.ts`
- 实现 `useExamTimer(timeLimit?: number)` Hook：
  - 返回 `{ timeRemaining, isExpired, start, pause, reset }`
  - 时间到自动提交（调用 `onTimeUp` 回调）
  - UI 显示倒计时（分:秒 格式）
  - 最后 60 秒红色闪烁警告
- 无 `timeLimit` 时不显示计时器

### Task 3：考核评分逻辑
- 题源以选择题为主（课内 quiz 题 + 课后测评题），复用 `gradeChoiceQuestions()` 本地评分
- 若抽到简答题（题源中存在时）：调用 `/api/quiz-grade` 逐题评分
- 计算总分、通过/不通过、各题得分详情
- 组装 `ExamResult` 结构（ARCH-025 payload）

### Task 4：考核结果两边记录
- 评分完成后调用 `onComplete(examResult)`
- `EmbedProvider`/`StageExam` 中（REQ-030）：
  - **先**调用 `ExamBankAPI.saveExamResult({ kind: 'stage_exam', examId, score, passed, threshold, duration, details, questionRefs })` 持久化到 OpenMAIC 后端（ARCH-036）
  - **再**通过 postMessage 发送 `exam-result` 回传宿主（ARCH-025）
- payload 包含 `examId, passed, score, threshold, totalQuestions, correctCount, duration, details`
- `duration` 为实际用时（秒），从计时器获取

### Task 5：抽题 + 消息集成
- 在 `EmbedProvider` 的消息路由中处理 `start-exam`（ARCH-022，payload 为 `ExamPolicy`）：
  - 校验 payload 合法（examId 存在、questionCount > 0）
  - 调用 `ExamBankAPI.assembleExam(policy)` 抽题组卷（role 缺省取 `useSession()` 当前角色）（ARCH-035, ARCH-055）
  - 题量不足时按策略提示或放宽分类范围（首版：返回实际题量并提示）
  - 设置 context state 切换到考核视图，渲染 `StageExam`，传入 `questions` / `questionRefs` / `timeLimit` / `passThreshold`
- 考核完成后自动恢复之前的视图状态
- 支持宿主在考核中途发送 `cancel-exam` 中止考核（可选，首版不实现）

### Task 6：考核与课后测评的 UI 复用
- `StageExam` 和 `CourseAssessment`（SLICE-04）共享底层答题 UI
- 提取共享组件 `components/assessment/quiz-renderer.tsx`：
  - 通用题目渲染（单选/多选/简答）
  - 通用答案选择交互
  - 通用结果展示（对错标记 + 解析）
- `CourseAssessment` 和 `StageExam` 各自包装业务逻辑（门控 vs 抽题+宿主回传）
