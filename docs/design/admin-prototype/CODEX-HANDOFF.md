# Codex 交接：认证页 HTML → 生产代码

> 用途：把 Open Design 高保真原型转成业务项目代码时，直接把本文件 + 下列源文件一起丢给 Codex。  
> 目标栈：按你仓库现状填写（示例：Next.js / React + 现有 UI 组件库）。

---

## 0. 一句话任务

把 `login.html` / `register.html` + `styles.css` + `auth.js` 实现为**可上线的认证页面**，视觉与交互对齐原型，业务逻辑对接真实 API，**不要**把静态 HTML 原样塞进生产目录。

---

## 1. 设计源文件（只读参考）

| 文件 | 角色 |
|------|------|
| `login.html` | 登录页结构与文案 |
| `register.html` | 注册页结构与文案 |
| `styles.css` | 视觉 token、布局、响应式（方案 A 编辑式双栏） |
| `auth.js` | 前端校验、密码显隐、提交态（逻辑参考，非生产实现） |

对比方案（可忽略）：`login-a.html` 等与主文件等价，以无后缀主文件为准。

---

## 2. 产品范围（必须实现）

### 登录
- 字段：手机号、密码
- 可选：记住登录、无法登录入口
- 成功后：进入学习中心（路由按项目现有鉴权流）

### 注册
- 字段：姓名、手机号、密码、邀请码
- 成功后：进入学习中心或回到登录（与后端约定一致）

### 不做
- 不要生成 `index` 入口营销页
- 不要引入 MAIC / 第三方品牌图标
- Logo 暂用占位（44×44），后续替换品牌资源

---

## 3. 视觉系统（必须对齐，不要重发明）

从 `styles.css` 的 `:root` 提取 token，映射到项目 theme / CSS variables：

```
背景 --bg: #f5f4ed（羊皮纸）
表面 --surface: #faf9f5
暖交互面 --surface-warm: #e8e6dc
主文字 --fg: #141413
次文字 --muted: #5e5d59
边框 --border-soft: #e8e6dc
主色 --accent: #c96442（陶土橙，仅主 CTA / 链接强调）
危险 --danger: #b53333
圆角：8–12px
字体：标题衬线（Georgia 回退），正文无衬线 system-ui/Arial
```

版式原则：
- **桌面**：双栏 — 左叙事栏（`.story`）+ 右表单栏（`.form-panel`）
- **移动 ≤900px**：隐藏叙事栏；顶部紧凑 mobile brand；表单优先、中高密度
- 输入框高度约 48px，`font-size: 16px`（防 iOS 缩放）
- 触控目标 ≥ 44px
- 无大面积留白；短屏再收紧间距
- 主色每屏最多 1–2 处（主按钮 + 必要链接）

---

## 4. 组件拆分建议（实现时）

不要复制整页 HTML。按组件落地：

```
AuthLayout          // 双栏壳 + 移动断点
  BrandMark         // LOGO 占位 + 产品名
  StoryPanel        // 仅桌面：eyebrow / 标题 / lead / 能力卡片
  AuthFormPanel
    PanelTop        // 左说明 + 右切换登录/注册
    LoginForm | RegisterForm
    PanelFoot
```

字段组件统一：`Label + Input + FieldError`；密码带「显示/隐藏」。

---

## 5. 交互与校验（对齐 auth.js，再接 API）

| 字段 | 规则 |
|------|------|
| 姓名 | 必填，≥2 字 |
| 手机号 | `^1[3-9]\d{9}$` |
| 密码 | 必填，≥6 位 |
| 邀请码 | 必填，≥4 位（后端再验有效性） |

状态：
- idle / loading / success / field error
- 提交中禁用按钮，文案切换（登录：「正在验证账号」/ 注册：「正在创建账号」）
- 错误写在字段下方 `aria-live="polite"`，`aria-invalid`

API（由你项目补全路径）：
- `POST /api/auth/login` body: `{ phone, password, remember? }`
- `POST /api/auth/register` body: `{ name, phone, password, inviteCode }`
- 错误映射到字段或全局 status，不要只 `alert`

---

## 6. 给 Codex 的硬约束（复制进 prompt）

1. **参考像素与结构，用项目技术栈重写**（React/Vue/… + 现有 router、form、request 层）。
2. **禁止**把 `login.html` 当生产页面直接托管；**禁止**大段内联复制未整理的 CSS。
3. 先建 token / theme，再写布局组件；CSS 类名可重映射，视觉结果要对齐。
4. 保留响应式断点语义：`max-width: 900px` 隐藏 story；必要时 `480px` / 短屏高度再压缩。
5. 文案用原型中文，不要改成英文或 lorem。
6. 可访问性：label 关联、错误 `aria-live`、焦点环可见。
7. 完成后自检：桌面双栏、手机单栏表单、校验、loading、登录↔注册互跳。
8. 若项目已有 Design System / Button / Input，**优先复用**，用 token 覆盖成上述色板，不要再造一套平行组件。

---

## 7. 推荐你对 Codex 说的完整 Prompt（可直接粘贴）

```text
你是资深前端。请把 Open Design 认证原型实现进本仓库的生产代码，不要当静态站搬运。

【参考文件】
- docs/design/admin-prototype/login.html
- docs/design/admin-prototype/register.html
- docs/design/admin-prototype/styles.css
- docs/design/admin-prototype/auth.js
- docs/design/admin-prototype/CODEX-HANDOFF.md（本说明）

【目标】
实现员工登录页 + 注册页：
- 登录：手机号 + 密码（可选记住登录）
- 注册：姓名 + 手机号 + 密码 + 邀请码
- 视觉对齐 styles.css（Claude/羊皮纸 + 陶土橙 #c96442，编辑式双栏）
- 移动端 ≤900px 隐藏左侧叙事栏，表单优先、中高密度、无大面积留白
- 校验与交互参考 auth.js，再对接真实 API

【技术要求】
1. 使用本仓库现有栈与目录约定（先搜索现有 auth / layout / ui 组件再写）。
2. 拆成 AuthLayout / StoryPanel / LoginForm / RegisterForm 等组件。
3. 设计 token 映射到项目 theme；主色仅用于 CTA/关键链接。
4. 路由：/login、/register（若已有路径则沿用）。
5. API：按项目现有 request 封装对接 login/register；错误展示到字段级。
6. 不要创建营销 index；Logo 用 44px 占位。
7. 交付：可运行页面 + 必要类型/测试（若仓库惯例有）。

【验收】
- [ ] 桌面：左故事 + 右表单
- [ ] 手机：无故事栏、表单完整可用、输入 16px+
- [ ] 校验文案与原型一致
- [ ] loading / 成功 / 失败状态
- [ ] 登录注册互跳
- [ ] 无 AI 模板紫渐变、无 emoji 图标装饰

先读仓库里已有 auth 与 UI 组件，再给实现计划，确认后写代码。
```

---