# SLICE-03：课程生成、编辑、发布与可见范围

## 声明
- **实现需求**：REQ-001~005, REQ-037~041
- **实现架构**：ARCH-002, ARCH-005, ARCH-032, ARCH-033, ARCH-041
- **拥有路径**：`app/generation-preview/`, `components/edit/`, `components/admin/courses/`, `lib/authoring/`
- **产出接口**：课程管理权限门控、课程发布/可见范围配置、学员课程列表过滤
- **依赖切片**：SLICE-00, SLICE-01, SLICE-07

## 任务

### Task 1：大纲确认默认行为
- 确保 AI 生成大纲后默认停留在大纲预览/编辑阶段。
- 未点击确认前不继续生成完整课程。
- 不新增内容预览页、不拆媒体生成链路。

### Task 2：Pro Mode 权限门控
- 复用现有 Pro Mode / AI 编辑助手。
- 只有管理员可进入编辑、保存、发布。
- 普通学员隐藏入口并在保存动作上二次校验。

### Task 3：课程分类
- 管理员后台维护分类。
- 创建/编辑课程时选择分类。
- 分类用于阶段考核策略筛选。

### Task 4：课程发布状态
- 课程生成完成后默认 `draft`。
- 管理员设置可见范围后点击发布，状态变为 `published`。
- 管理员可下架为 `archived` 或继续编辑草稿。

### Task 5：课程可见范围
- 支持 `all` 和 `roles` 两种模式。
- `roles` 模式选择一个或多个 OpenMAIC 内部角色。
- 不做指定用户、部门、组织树。

### Task 6：学员课程列表
- 登录后所有用户默认进入课程列表。
- 学员只看到已发布且对自己角色可见课程。
- 管理员看到后台入口按钮，并可进入管理课程。

### Task 7：测评题匹配提示
- 管理员修改课程内容后，提示课后测评题可能不匹配。
- 管理员可选择手动重生成测评题或直接编辑。
- 系统不自动覆盖人工编辑过的测评题。

### Task 8：测试
- 大纲页不确认不继续生成。
- 管理员可编辑，学员不可编辑。
- 发布前学员不可见，发布后按角色可见。
- 下架后学员列表消失。

• Slice-03 已完成并标记 /goal complete。最终用时约 40 分 20 秒，goal 记录 token 使用量 555834。

  这次主要改动：

  - 在 app/page.tsx 给管理员生成课程加了分类选择，并把 categoryId 带入生成 session。
  - 在 app/generation-preview/page.tsx 强制大纲确认后再继续，并在生成首个场景后创建服务端 draft 课程内容。
  - 在 app/classroom/[id]/page.tsx 将后续自动生成出的场景继续同步回服务端课程草稿。
  - 新增 lib/authoring 下的课程草稿、权限、大纲确认 helper，并接入 Pro Mode 管理员门控。
  - 新增后台课程管理 UI components/admin/courses/CourseAdminPanel.tsx，支持分类、课程草稿、可见范围、发布/下架、测评题不
    匹配提示。

  - 补了 Slice-03 的 authoring/storage 测试。

  验证结果：

  - pnpm.cmd test 通过：228 files / 1809 tests。
  - pnpm.cmd lint 通过；剩余 15 个既有 warning，无 error。
  - pnpm.cmd build 通过；仅有 Next 的 middleware convention deprecated warning。
  - 变更文件的 prettier --check 通过。
  - pnpm.cmd check 仍失败，但原因是仓库既有 1069 个文件格式问题，不是本次改动文件。
  - 本地 dev server 没启动成功：之前尝试后台 pnpm dev 被会话策略拒绝了。

  注意：工作区里原本已有 AGENTS/docs 等大量未提交改动和若干 untracked 目录，我没有回滚或整理这些无关状态。建议下一个
  slice 走 SLICE-04。