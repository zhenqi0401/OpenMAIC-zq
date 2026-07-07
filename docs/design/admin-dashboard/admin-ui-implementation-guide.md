# OpenMAIC 管理后台 UI 实现开发文档

本文档用于把 Open Design 设计参考落到 OpenMAIC 管理后台代码中。目标是让实现 agent 可以直接按文件、页面、接口和验收标准推进，而不是把 HTML 原型硬拷贝进生产源码。

## 1. 交付目标

实现 `/admin` 管理后台 UI，使它从当前偏功能堆叠的后台，升级为中高密度、真实可用的企业培训运营工作台。

核心目标：

- 保留现有后端接口、权限、数据结构和保存语义，不擅自改 API 合约。
- 使用当前项目技术栈实现：Next.js App Router、React、Tailwind CSS、现有 shadcn/Radix UI 组件、lucide-react 图标。
- 视觉参考 `docs/design/admin-prototype/` 下的 HTML 原型，但生产实现必须组件化，不直接复制原型 HTML/CSS/JS。
- 覆盖看板、课程管理、阶段考核、访问与角色四个后台模块。
- UI 必须包含加载、空、错误、禁用、提交中、权限不足等真实状态。

## 2. 需要放入项目的设计参考文件

把 Open Design 产出的参考包放到代码仓库：

```text
docs/design/admin-prototype/
  dashboard.html
  courses.html
  exams.html
  access.html
  styles.css
  app.js
  DESIGN.md
  critique.json
```

说明：

- `dashboard.html`：看板页布局、指标卡、待办区、筛选区、学员明细表格参考。
- `courses.html`：课程管理页布局、课程列表、发布状态、分类、可见范围、抽屉表单参考。
- `exams.html`：阶段考核页布局、策略列表、快速草稿、题库准备度、发布动作参考。
- `access.html`：角色维护、用户角色维护、邀请码维护参考。
- `styles.css`：视觉 token、密度、间距、卡片、表格、按钮状态参考。
- `app.js`：仅作为交互状态参考，例如筛选、抽屉、空状态、加载态、表单校验，不作为生产脚本复用。
- `DESIGN.md`：视觉系统和实现原则来源。当前方向为 Intercom 风格的暖白中高密度 SaaS 工作台，硬朗 4px 控件，单一橙色主动作。
- `critique.json`：设计自检记录，可选，用于理解为什么这样收敛。

不要把这些文件放入 `app/`、`components/` 或生产样式目录；它们是设计参考包。

## 3. 当前代码锚点

实现前先读取这些文件，按现有结构接入：

```text
app/admin/page.tsx
components/admin/AdminSlice08Panel.tsx
components/admin/courses/CourseAdminPanel.tsx
components/admin/exams/ExamPolicyAdminPanel.tsx
lib/admin/client.ts
components/ui/button.tsx
components/ui/input.tsx
components/ui/card.tsx
components/ui/dialog.tsx
components/ui/tabs.tsx
components/ui/badge.tsx
```

现有 `/admin` 页面当前已经聚合：

- 角色、邀请码、用户、看板：`AdminSlice08Panel`
- 课程管理：`CourseAdminPanel`
- 阶段考核：`ExamPolicyAdminPanel`

实现策略：

- 优先保留 `/admin` 作为入口。
- 可以在同一页面内做真实产品导航或 Tabs，也可以拆成 `/admin/dashboard`、`/admin/courses`、`/admin/exams`、`/admin/access` 子路由。
- 如果拆路由，仍不要新增无意义 `index` 落地页；默认入口应直接落到看板或最近使用模块。

## 4. 视觉与布局规则

统一视觉系统：

- 背景：暖白工作台背景，不使用纯白大空白或深色营销背景。
- 主动作：单一暖橙色，用于主要 CTA、当前导航、关键状态。不要把橙色铺满每张卡。
- 控件：4px 半径为主，按钮、输入框、筛选器保持硬朗、清晰。
- 表格：中高密度，行高紧凑但可读，数字使用 tabular-nums。
- 顶部栏：内容贴合，不为了对齐制造大高度空白；分割线紧贴标题、说明和按钮区。
- 左侧导航：四个模块一致，当前项明确，移动端可折叠或转为顶部导航。
- 图标：使用 lucide-react，线性图标即可；不要出现 MAIC 图标。
- 避免：大 hero、紫蓝渐变、营销长页、圆角大卡片堆叠、假指标、无来源夸张数字。

响应式要求：

- 桌面端优先支持 1280px 到 1920px，首屏信息不能松散。
- 1024px 左右保持双列或主次布局，不得横向溢出。
- 768px 以下导航收敛，表格可以变为横向滚动容器或卡片式摘要。
- 360px 到 430px 不允许正文、按钮、表格工具栏互相遮挡。

## 5. 页面实现规格

### 5.1 看板页

参考 `dashboard.html`。

页面目的：让运营人员一眼看到培训状态、需要处理的事项和学员明细。

模块：

- 顶部栏：标题、说明、刷新按钮。标题文案可沿用“运营状态一眼看清”。
- 指标卡：课程完成率、阶段考核通过率、综合考试通过率、待处理事项。
- 筛选区：学员、角色、课程等筛选条件。提交时有 loading/disabled 状态。
- 学员明细表：学员、角色、课程进度、阶段考核、综合考试、最近活动、状态。
- 待办区：按优先级列出课程发布、题库、邀请码、角色配置等运营动作。

数据来源：

```text
GET /api/admin/dashboard
GET /api/admin/users
GET /api/admin/roles
GET /api/admin/courses
```

如果 `GET /api/admin/dashboard` 已经返回足够聚合数据，优先使用它，不重复请求。

状态：

- 加载中：指标卡骨架、表格 loading row。
- 空数据：说明当前筛选无结果，提供“清空筛选”。
- 错误：显示错误提示和重试按钮。
- 权限不足：说明当前账号没有后台权限，不暴露空白页面。

### 5.2 课程管理页

参考 `courses.html`。

页面目的：让运营维护课程从草稿到发布的全过程。

模块：

- 顶部栏：标题、说明、新建课程、刷新。
- 筛选区：状态、分类、可见范围、关键词。
- 课程列表：课程名、分类、状态、可见范围、内容完整度、考核绑定、最近更新。
- 课程动作：发布、下架、归档、调整可见范围、编辑内容、重新生成考核。
- 分类维护：新增分类、排序或基础编辑。
- 抽屉表单：新建课程草稿，字段至少包含课程名称、描述、分类。

数据来源：

```text
GET/POST /api/admin/courses
/api/admin/courses/[id]
POST /api/admin/courses/[id]/publish
POST /api/admin/courses/[id]/archive
PATCH /api/admin/courses/[id]/visibility
/api/admin/courses/[id]/content
/api/admin/courses/[id]/assessment
POST /api/admin/courses/[id]/assessment/regenerate
GET/POST /api/admin/categories
/api/admin/categories/[id]
GET /api/admin/roles
```

注意：

- 不要绕过现有课程权限逻辑。
- 可见范围必须绑定真实角色数据。
- 发布、归档、重新生成考核要有提交中和失败状态。

### 5.3 阶段考核页

参考 `exams.html`。

页面目的：把考核策略从技术配置翻译成运营能理解的业务语言。

模块：

- 顶部栏：标题、说明、新建策略、刷新。
- 策略列表：策略标题、目标角色、覆盖分类、课程数、题目数、通过线、时限、状态。
- 快速草稿：快速创建策略的表单区。
- 题库准备度：按课程或分类展示是否具备生成考核的条件。
- 抽屉表单：编辑策略，包括角色、分类、课程、题数、通过线、时限。

数据来源：

```text
GET/POST /api/admin/exam-policies
/api/admin/exam-policies/[id]
POST /api/admin/exam-policies/[id]/publish
GET /api/admin/roles
GET /api/admin/categories
GET /api/admin/courses
```

注意：

- 只允许选择已发布课程作为考核覆盖对象，除非后端明确允许草稿课程。
- 题目数、通过线、时限必须做前端校验，但最终以后端校验为准。
- 发布动作必须显示明确反馈。

### 5.4 访问与角色页

参考 `access.html`。

页面目的：集中处理角色、用户角色和邀请码维护。

模块：

- 顶部栏：标题、说明、新建邀请码、刷新。
- 角色维护：角色 code、名称、是否管理员、保存动作。
- 用户维护：用户、当前角色、角色切换、保存动作。
- 邀请码维护：创建邀请码、绑定角色、启用状态、过期时间、列表展示。
- 抽屉表单：创建邀请码或角色。

数据来源：

```text
GET/POST /api/admin/roles
/api/admin/roles/[id]
GET /api/admin/users
PATCH /api/admin/users/[id]/role
GET/POST /api/admin/invite-codes
/api/admin/invite-codes/[id]
```

注意：

- 邀请码列表不要展示后端不允许展示的明文。
- 管理员角色变更要保留后端安全规则，不在前端自行放宽。
- 角色保存、用户角色保存、邀请码保存要分别有独立 loading 和错误状态。

## 6. 组件拆分建议

建议新增或重构为以下组件，命名可按项目习惯调整：

```text
components/admin/AdminShell.tsx
components/admin/AdminSidebar.tsx
components/admin/AdminTopbar.tsx
components/admin/AdminMetricCard.tsx
components/admin/AdminPanel.tsx
components/admin/AdminTable.tsx
components/admin/AdminStatusBadge.tsx
components/admin/AdminEmptyState.tsx
components/admin/AdminErrorState.tsx
components/admin/AdminToolbar.tsx
components/admin/AdminDrawer.tsx
components/admin/dashboard/AdminDashboardView.tsx
components/admin/courses/CourseAdminView.tsx
components/admin/exams/ExamPolicyAdminView.tsx
components/admin/access/AccessAdminView.tsx
```

拆分原则：

- Shell、导航、顶部栏、卡片、表格、状态徽标为共享组件。
- 页面级组件只负责本模块数据编排和业务动作。
- API 请求优先集中到 `lib/admin/client.ts`，避免每个组件散落 `fetch` 细节。
- 不新增 UI 依赖，除非现有组件无法满足且用户明确批准。

## 7. 数据与前后端对齐清单

实现前先列出每个接口的真实响应字段，避免用原型里的假字段。

看板：

- 指标字段：总人数、课程完成率、阶段考核通过率、综合考试通过率、待办数量。
- 表格字段：用户、角色、课程进度、考核结果、最近活动、状态。
- 筛选字段：userId、roleId、courseId。

课程：

- 课程字段：id、name、description、categoryId、status、visibilityMode、visibleRoleIds、updatedAt。
- 分类字段：id、name、sortOrder。
- 动作：create、publish、archive、update visibility、regenerate assessment。

考核：

- 策略字段：id、title、targetRoleId、categoryIds、courseIds、questionCount、passThreshold、timeLimitMinutes、status。
- 动作：create、update、publish。

访问：

- 角色字段：id、code、name、isAdmin。
- 用户字段：id、name/email、roleId。
- 邀请码字段：id、roleId、enabled、expiresAt、createdAt。明文 code 仅创建时提交，不要求列表展示。

任何字段不匹配时，优先调整 UI 映射，不要先改后端。

## 8. 实现切片

### Slice 0：放入设计参考和建立实现边界

- 将参考文件复制到 `docs/design/admin-prototype/`。
- 阅读 `DESIGN.md` 和四个 HTML 参考。
- 确认不直接复制原型 HTML/CSS/JS 到生产目录。

验收：

- 参考文件存在。
- 实现 PR 或提交说明中明确“参考包仅用于视觉和交互对照”。

### Slice 1：管理后台 Shell 和视觉 token

- 重构 `app/admin/page.tsx`，去掉旧的图标式头部堆叠。
- 建立统一 Shell：左侧导航、内容区、内容贴合顶部栏。
- 将暖白、石墨、暖橙、边框、半径、间距映射到 Tailwind class 或局部 CSS。
- 保持桌面中高密度，不出现大面积空白。

验收：

- `/admin` 首屏有清晰导航和紧凑内容区。
- 无 MAIC 图标、无营销 hero、无空洞顶部栏。

### Slice 2：看板页

- 按 `dashboard.html` 实现指标卡、筛选、学员明细表、待办区。
- 对接 `/api/admin/dashboard` 和必要的角色/课程/用户接口。
- 实现加载、空、错误、重试、筛选提交状态。

验收：

- 刷新和筛选会触发真实请求。
- 数据为空时不是空白页。
- 表格在小屏不撑破页面。

### Slice 3：课程管理页

- 按 `courses.html` 实现课程列表、筛选、分类、新建草稿、发布和可见范围。
- 复用现有 `CourseAdminPanel` 的业务逻辑，重塑布局和状态。
- 将可见范围绑定真实角色。

验收：

- 新建课程、发布、归档、保存可见范围均调用现有接口。
- 每个异步动作有 pending 和失败反馈。
- 筛选为空时展示明确空状态。

### Slice 4：阶段考核页

- 按 `exams.html` 实现策略列表、快速草稿、题库准备度、策略编辑。
- 复用 `ExamPolicyAdminPanel` 现有逻辑并补齐状态。
- 发布策略动作有明确反馈。

验收：

- 创建、保存、发布策略均使用现有接口。
- 表单校验覆盖标题、目标角色、分类、题数、通过线。
- 题库准备度不使用假数据；后端没有字段时显示诚实占位。

### Slice 5：访问与角色页

- 将 `AdminSlice08Panel` 中角色、用户、邀请码相关内容拆到访问模块。
- 按 `access.html` 做中高密度维护界面。
- 保存角色、保存用户角色、保存邀请码分别独立反馈。

验收：

- 邀请码创建不在列表泄露明文。
- 角色和用户角色保存失败时能回显错误。
- 权限不足时有明确提示。

### Slice 6：响应式、可访问性和状态硬化

- 检查 360、390、430、768、1024、1366、1440、1920 宽度。
- 所有按钮有禁用状态，表单控件有 label 或 aria-label。
- Dialog/Drawer 有焦点管理和 Escape/关闭行为。
- 当前导航有 `aria-current`。

验收：

- 键盘可以完成主要操作。
- 移动端无横向页面级溢出。
- loading、empty、error、permission denied 都能被手动触发或测试覆盖。

### Slice 7：测试和回归

- 补充或更新 Vitest/RTL 测试，覆盖主要渲染和交互。
- 保留现有后端路由测试。
- 运行 lint、test、build。

建议命令，以项目实际包管理器为准：

```powershell
$ErrorActionPreference = 'Stop'
npm.cmd run lint
npm.cmd run test -- tests/admin/slice08-client.test.ts
npm.cmd run test -- tests/admin/slice05-client.test.ts
npm.cmd run build
```

如果项目当前使用 `pnpm.cmd`，将上面的 `npm.cmd run` 替换为 `pnpm.cmd` 对应命令。

## 9. 验收标准

必须满足：

- `/admin` 能进入真实后台 UI，不再是松散堆叠的功能面板。
- 看板、课程、考核、访问四个模块都能访问。
- 设计参考里的关键布局被落地：指标卡、待办、表格、筛选、抽屉/对话框、状态徽标。
- 真实接口对接完整；不使用原型假数据替代后端数据。
- 不改变权限判断、邀请码安全规则、课程发布规则、考核发布规则。
- 没有新增未经批准的依赖。
- 首屏没有明显大面积留白。
- 顶部栏内容贴合，不保留大块空白占位。
- 360px 到 1920px 范围内没有主要内容遮挡或页面级横向溢出。
- lint、相关测试、build 通过；若无法通过，必须说明具体失败和原因。

## 10. 给实现 agent 的可复制提示词

```text
请根据 docs/design/admin-prototype/ 下的设计参考，实现 OpenMAIC 管理后台 UI。

参考文件：
- dashboard.html：看板页布局、指标卡、待办和学员明细表格参考
- courses.html：课程管理页、筛选、课程列表、分类、可见范围和抽屉表单参考
- exams.html：阶段考核页、策略列表、快速草稿、题库准备度参考
- access.html：角色维护、用户角色维护、邀请码维护参考
- styles.css：视觉 token、间距、控件密度、状态样式参考
- app.js：交互状态参考，不要直接复制到生产代码
- DESIGN.md：视觉方向和约束

实现边界：
- 只实现 /admin 管理后台相关 UI。
- 使用现有 Next.js App Router、React、Tailwind、shadcn/Radix、lucide-react。
- 不新增依赖，除非先说明理由并获得确认。
- 不修改后端 API 合约、权限规则、数据库 schema 或业务保存语义。
- 不直接复制 HTML 原型到 app/components，必须按当前技术栈组件化实现。

现有代码锚点：
- app/admin/page.tsx
- components/admin/AdminSlice08Panel.tsx
- components/admin/courses/CourseAdminPanel.tsx
- components/admin/exams/ExamPolicyAdminPanel.tsx
- lib/admin/client.ts
- app/api/admin/dashboard/route.ts
- app/api/admin/courses/route.ts
- app/api/admin/exam-policies/route.ts
- app/api/admin/roles/route.ts
- app/api/admin/invite-codes/route.ts
- app/api/admin/users/route.ts

请先检查这些文件和现有 API 响应字段，再制定切片计划。实现顺序建议：
1. 放置并确认 docs/design/admin-prototype/ 参考包
2. 重构 /admin Shell、导航、顶部栏和视觉 token
3. 实现看板模块
4. 实现课程管理模块
5. 实现阶段考核模块
6. 实现访问与角色模块
7. 补齐 loading、empty、error、disabled、permission denied、a11y、响应式
8. 运行 lint、相关测试和 build

视觉要求：
- Intercom 风格的暖白中高密度 SaaS 工作台
- 硬朗 4px 控件，单一暖橙主动作
- 不要 MAIC 图标、不要无意义 index 入口页、不要营销 hero、不要紫蓝渐变
- 顶部栏内容贴合，不能出现大面积空白
- 桌面端信息密度要像真实内部运营后台

完成后请报告：
- 改了哪些文件
- 每个页面对接了哪些接口
- 哪些状态已覆盖
- 跑了哪些测试和构建命令
- 仍有哪些后端字段或产品决策需要确认
```

## 11. 实现前需要确认但不阻塞的问题

- `/admin` 是否继续单页聚合，还是拆成四个子路由。默认可以先保持单页聚合，用真实产品导航切换模块。
- `GET /api/admin/dashboard` 是否已经包含看板所需全部聚合字段。若不完整，先做诚实占位或组合现有接口，不先改后端。
- 考核策略里的题库准备度是否已有真实字段。没有就显示“待接入”或基于现有课程/题目字段计算，不编造数值。
- 角色权限是否有更细的后台操作权限。没有就沿用当前 admin 判断。

