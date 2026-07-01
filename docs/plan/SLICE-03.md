# SLICE-03：内容预览与编辑

## 声明
- **实现需求**：REQ-001, REQ-002, REQ-003, REQ-004, REQ-005
- **实现架构**：ARCH-002, ARCH-014, ARCH-042, ARCH-050, ARCH-051
- **拥有路径**：`components/generation/content-preview/`, 修改 `app/generation-preview/page.tsx`, 修改 `lib/media/media-orchestrator.ts`
- **产出接口**：`ContentPreviewPage` 组件（ARCH-042）、扩展的 `previewPhase` 状态机
- **消费接口**：postMessage 类型定义（SLICE-00）、现有 `useMediaGenerationStore`、现有 `SceneContent` 类型
- **依赖切片**：SLICE-00

## 任务

### Task 1：生成流程改造 — 拆分内容生成与媒体生成
- 修改 `app/generation-preview/page.tsx`：
  - 在 `handleConfirmOutlines()` 中移除 `generateMediaForOutlines()` 调用（ARCH-050）
  - 内容生成（`startGeneration()`）完成后，`previewPhase` 转入 `'content-review'` 而非直接跳转到 classroom
  - 新增 `'content-review'` → `'generating-media'` 的状态转换（用户触发）
- 修改 `app/generation-preview/types.ts`：
  - `PreviewPhase` 类型已在 SLICE-00 扩展，此处使用新状态

### Task 2：内容预览页面组件
- 创建 `components/generation/content-preview/content-preview-page.tsx`（ARCH-042）
- 左侧：场景列表（可折叠），显示场景类型图标 + 标题 + 编辑状态标记
- 右侧：当前选中场景的详细内容展示
- 顶部工具栏：「返回大纲」「批量生成媒体」「确认发布」按钮
- 底部状态栏：显示媒体生成进度（已生成 / 总数）

### Task 3：场景内容编辑器
- 创建 `components/generation/content-preview/scene-content-editor.tsx`
- 根据场景类型渲染不同编辑器：
  - **slide**：文案编辑（富文本或 textarea）、remark（教师旁白）编辑
  - **quiz**：题目/选项/答案编辑（复用 `OutlinesEditor` 中 quiz 配置的交互模式）
  - **interactive**：只读展示配置摘要（interactive 内容太复杂不支持编辑）
  - **pbl**：项目主题/描述/技能点编辑
- 编辑回调：`onChange(sceneId, newContent)` 更新父组件的 `editedContents` Map

### Task 4：课后测评题目编辑区
- 在 `ContentPreviewPage` 底部或独立 tab 中展示课后测评题目编辑区
- 渲染 AI 生成的 `assessment_questions`（QuizQuestion[]，仅选择题）
- 支持：编辑题目文本、编辑选项、修改正确答案、删除题目、新增题目
- 编辑后的题目通过 `onConfirm` 回调与课程内容一起提交

### Task 5：媒体生成触发按钮
- 创建 `components/generation/content-preview/media-trigger.tsx`（REQ-003）
- 每个 slide 场景旁显示一个「生成视频/图片」按钮
- 按钮状态对应 `useMediaGenerationStore` 中的 task 状态：
  - 无任务 → 「生成」按钮
  - pending → 「等待中」
  - generating → 进度动画
  - done → 缩略图预览 + 「重新生成」按钮
  - failed → 错误信息 + 「重试」按钮
- 点击触发 `generateMediaForOutlines([outline], stageId)`
- quiz / interactive / pbl 场景不显示媒体生成按钮

### Task 6：批量媒体生成
- 在顶部工具栏添加「批量生成所有媒体」按钮（REQ-003）
- 点击后对所有有 `mediaGenerations` 的 slide 场景调用 `generateMediaForOutlines()`
- 显示总体进度：已完成 / 总数
- 生成过程不阻塞编辑（REQ-004）——媒体生成在后台进行

### Task 7：内容变更检测与媒体失效标记
- 创建 `components/generation/content-preview/content-diff.ts`（ARCH-051）
- 实现 `hasContentChanged(original, edited)` — 对比关键字段（slide 的 elements/remark，quiz 的 questions）
- 当检测到变更时，对应 `SceneMediaStatus.contentChanged` 设为 true
- UI 显示黄色警告标记「内容已变更，建议重新生成媒体」
- 用户可忽略警告直接发布，或重新生成

### Task 8：确认发布流程
- 「确认发布」按钮点击后：
  - 将编辑后的内容写回 IndexedDB（scenes 表）
  - 将课后测评题目写入 stage 记录
  - 如果嵌入模式：通过 postMessage 发送 `course-published` 事件
  - 跳转到 classroom 页面开始学习
- 如果有场景的媒体未生成，弹出确认对话框提示用户
