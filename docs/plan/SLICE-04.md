# SLICE-04：课后测评与重学

## 声明
- **实现需求**：REQ-006, REQ-007, REQ-008, REQ-009, REQ-030
- **实现架构**：ARCH-005, ARCH-015, ARCH-023, ARCH-024, ARCH-036, ARCH-043, ARCH-052
- **拥有路径**：`components/assessment/course-assessment.tsx`, `components/assessment/assessment-result.tsx`, `components/assessment/retake-prompt.tsx`, `lib/assessment/`
- **产出接口**：`CourseAssessment` 组件（ARCH-043）
- **消费接口**：postMessage 类型定义（SLICE-00）、`useEmbedBridge()`（SLICE-02，可选）、`ExamBankAPI.saveExamResult()`（SLICE-01）、`QuizQuestion` 类型（现有）、`gradeChoiceQuestions()`（现有）
- **依赖切片**：SLICE-00, SLICE-01（结果持久化）, SLICE-03（课后测评题目生成集成在内容预览中）

## 任务

### Task 1：课后测评题目自动生成
- 修改课程内容生成流程（`/api/generate/scene-content` 或 pipeline 层面）
- 在生成所有场景内容完成后，额外生成一组课后测评题目：
  - prompt 基于课程所有场景的 keyPoints 和 teachingObjective
  - 仅生成选择题（单选 + 多选），数量为场景数 × 2（上限 20 题）
  - 输出格式为 `QuizQuestion[]`（`type: 'single' | 'multiple'`，不含 `'short_answer'`）
- 生成的题目存入 `GenerationSessionState` 的新字段 `assessmentQuestions`
- 最终写入 IndexedDB 的 stage 记录（`assessmentQuestions` 扩展字段）

### Task 2：课后测评门控逻辑
- 创建 `lib/assessment/course-gate.ts`
- 实现 `evaluateAssessment(questions, answers)` — 使用 `gradeChoiceQuestions()` 评分
- 返回 `CourseCompletionGate` 结构（ARCH-015）
- 通过阈值从 env `QUIZ_PASS_THRESHOLD` 读取（默认 0.8）
- 如果课程没有 `assessmentQuestions`（旧课程或无测评题），返回 `{ requiresAssessment: false, passed: true }`

### Task 3：CourseAssessment 组件
- 创建 `components/assessment/course-assessment.tsx`（ARCH-043）
- 复用现有 `quiz-view.tsx` 的答题 UI 模式（但独立于课内 quiz 场景）：
  - 展示所有课后测评题目
  - 支持单选/多选作答
  - 提交后本地评分（`gradeChoiceQuestions()`）
  - 显示结果：分数、通过/不通过、错题解析
- Props：`{ courseId, questions, threshold?, onPass, onRetake }`
- 答题数据使用独立的 localStorage key：`assessmentDraft:{courseId}`, `assessmentAnswers:{courseId}`, `assessmentResults:{courseId}`（不与课内 quiz 的 `quizDraft:{sceneId}` 冲突）

### Task 4：测评结果展示
- 创建 `components/assessment/assessment-result.tsx`
- 通过时：显示通过动画 + 分数 + 「完成课程」按钮
- 不通过时：显示分数 + 错题列表（含正确答案和解析） + 「重新学习」按钮（REQ-008）
- 错题解析来自 `QuizQuestion.analysis` 字段

### Task 5：重学流程
- 创建 `components/assessment/retake-prompt.tsx`
- 不通过时显示重学提示组件（REQ-008）
- 「重新学习」按钮点击后：
  - 清除课后测评的答题记录（`assessmentAnswers`, `assessmentResults`）
  - 课内 quiz 答题记录保留不变（ARCH-052）
  - 重置 `PlaybackStateRecord`（播放进度归零）
  - 导航回课程首场景
- 重学后需再次完成所有场景 + 再次通过课后测评

### Task 6：Classroom 页面集成
- 修改 `components/scene-renderers/classroom-complete.tsx`
- 在渲染完成页面之前检查课后测评状态：
  - 有测评题目且未通过 → 渲染 `CourseAssessment` 组件
  - 有测评题目且已通过 → 渲染现有完成页面 + 通过标记
  - 无测评题目 → 保持现有完成页面行为
- 测评通过后才发送 `course-completed` postMessage（REQ-009）

### Task 7：测评结果两边记录
- 在 `CourseAssessment` 评分完成时（REQ-030）：
  - **先**调用 `ExamBankAPI.saveExamResult({ kind: 'course_quiz', courseId, score, passed, threshold, details, attemptNumber })` 持久化到 OpenMAIC 后端（ARCH-036）
  - **再**通过 `useEmbedBridge().sendToHost()` 发送 `quiz-result` 消息回传宿主（ARCH-023）
  - payload 包含 `courseId, passed, score, threshold, totalQuestions, correctCount, details, attemptNumber`
- 测评通过后：
  - 发送 `course-completed` 消息（ARCH-024）
- 非嵌入模式下回传调用为空操作（`isEmbedded: false` 时 `sendToHost` 是 no-op）；持久化在配置了 `DATABASE_URL` 时生效，否则跳过

### Task 8：StageRecord 扩展
- 在 `lib/utils/database.ts` 的 `StageRecord` 接口中添加 `assessmentQuestions?: QuizQuestion[]` 字段
- Dexie schema 不需要索引此字段（非查询条件）
- 无需数据库版本升级（Dexie 对非索引字段透明处理）
