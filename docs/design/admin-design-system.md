# 元我智脑管理后台设计系统

## 定位与阶段边界

新版后台主题代码名为 `yuanwo-saas-admin`。它以
`docs/design/stitch_/saas_core_management/DESIGN.md` 的结构化令牌为参考，继续使用产品现有
`BrandLockup`，只作用于 `/admin`。首页、学员端、播放页和编辑器不继承后台主题。

阶段 1 只冻结设计契约、公共骨架和静态页面模式，不接入新版列表或统计 API，也不迁移业务页面。
开发环境可使用 `/admin?module=<module>&designPreview=1` 查看静态样例；该分支在生产环境不启用。

## 冲突优先级

设计决策按以下顺序解释：

1. 真实业务规则和交互契约；
2. `DESIGN.md` 顶部 YAML 结构化令牌；
3. 本文的语义令牌和公共组件约定；
4. 页面 `design.md`；
5. Stitch 截图和 HTML 的视觉表现。

`DESIGN.md` 正文中的 `#3B82F6` 与 YAML 冲突，属于生成残留。后台唯一主操作色是
`#0058BE`。Stitch HTML 的 Logo、SaaS Admin、Management Portal、hbc、模拟头像、远程图片、
Material Symbols、脚本和内嵌 Tailwind 配置均不是实现来源。

## 五层结构与交付流

```text
结构化基础值
    ↓
语义设计令牌
    ↓
后台基础组件
    ↓
后台业务模式
    ↓
具体业务页面
```

五层结构是纵向架构；单页交付使用横向流程：

```text
design.md → 视觉样例与评审 → 复用实现 → 浏览器验收 → 共性模式回收
```

截图是评审材料，不是系统源码。最终以真实浏览器中通过响应式、键盘和状态验收的实现为准。

## Stitch 到正式令牌的映射

所有基础值只允许出现在 `components/admin/admin-theme.ts`。业务组件只能使用
`--admin-*`，不得引用 `--saas-*` 或裸十六进制颜色。

| Stitch 结构化值 | 正式语义令牌 | 用途 |
| --- | --- | --- |
| `surface #F7F9FB` | `--admin-page` | 页面背景 |
| `surface-container-lowest #FFFFFF` | `--admin-surface` | 主表面 |
| `surface-container-low #F2F4F6` | `--admin-surface-subtle` | 次级表面 |
| `surface-container #ECEEF0` | `--admin-surface-selected` | 悬停表面 |
| `on-surface #191C1E` | `--admin-foreground`、`--admin-heading` | 主文字 |
| `on-surface-variant #424754` | `--admin-muted-foreground` | 次文字 |
| `outline-variant #C2C6D6` | `--admin-border` | 强边框 |
| `surface-container-highest #E0E3E5` | `--admin-border-subtle` | 弱边框 |
| `primary #0058BE` | `--admin-action-primary` | 主操作 |
| `on-primary-fixed-variant #004395` | `--admin-action-primary-hover` | 主操作悬停 |
| `primary-fixed #D8E2FF` | `--admin-selection-background` | 选中背景 |
| `primary-container #2170E4` | `--admin-focus-ring`、`--admin-interactive-accent` | 焦点、进度 |
| `tertiary #006947` | `--admin-success` | 成功 |
| `error #BA1A1A` | `--admin-danger` | 危险 |
| `error-container #FFDAD6` | `--admin-danger-background` | 危险背景 |

警告色只承担“需要关注但并非失败”的状态，不替代主操作色、成功色或危险色。

## 字体、尺寸与节奏

- 字体：Inter、PingFang SC、Microsoft YaHei、Noto Sans CJK SC、system-ui；
- 页面标题：桌面 `24/32px 600`，手机 `20/28px 600`；
- 区块标题：`20/28px 600`；
- 卡片标题：`18/24px 600`；
- 正文、表格和控件文字：`14/20px`；
- 状态标签：`12/16px`；
- 控件高度：`40px`；
- 控件和卡片圆角：`8px`；
- Dialog 和 Drawer 圆角：`12px`；
- 常规卡片内边距：`24px`，筛选区、移动卡片和密集表格可使用 `16px`；
- 间距以 `4px` 为基础节奏。

## 响应式 Shell

- `≥1280px`：`260px` 固定侧栏，显示图标、名称和说明；
- `768–1279px`：`72px` 图标侧栏，悬停或键盘聚焦导航项时显示名称；
- `<768px`：`AdminTopBar` 显示 `BrandLockup` 和导航按钮，导航在侧滑 `AdminDrawer` 中；
- 页面主区必须使用 `min-width: 0`，禁止页面整体横向滚动；
- 宽表格只允许自身局部滚动，并应在对应业务页面提供移动卡片；
- 不使用 Stitch HTML 的固定画布、绝对定位或横向整排移动导航。

`BrandLockup` 是唯一品牌实现。不得重着色、添加图形底板或替换成 Stitch 临时品牌；品牌区副标题统一为
“管理后台”。

## 公共组件契约

### 骨架和页面

- `AdminShell`：后台主题、响应式布局和横向溢出边界；
- `AdminSidebar`：桌面、平板导航和当前账号位置；
- `AdminTopBar`：移动品牌栏和导航抽屉入口；
- `AdminPage`、`AdminPageHeader`：模块纵向节奏、标题、说明和页面操作。

### 操作和内容

- `adminPrimaryButtonClassName`、`adminSecondaryButtonClassName`、
  `adminIconButtonClassName`、`adminDangerButtonClassName`：按钮语义；
- `AdminMetricCard`：KPI 和统计摘要；
- `AdminFilterBar`：搜索、筛选、清除和刷新区；
- `AdminTabs`：键盘可操作的业务分组；
- `AdminDataTable`：语义表格的局部宽度边界；
- `AdminEntityCard`：课程、社区内容和移动实体卡片；
- `AdminStatusChip`：带文本的状态表达；
- `AdminPagination`：服务端分页范围和翻页；
- `AdminRowActions`：普通操作与危险操作分区。

### 弹层和状态

- `AdminDialog`：居中编辑和信息弹层；
- `AdminDrawer`：移动导航、分类管理和结果详情；
- `AdminDangerConfirmDialog`：危险操作确认；
- `AdminLoadingState`、`AdminSkeleton`、`AdminEmptyState`、
  `AdminFilteredEmptyState`、`AdminNotice`、`AdminNoPermissionState`：完整异步状态。

状态不得只依赖颜色表达；图标、标签或说明文字必须同时存在。动画必须通过
`motion-reduce:*` 在 reduced motion 环境下停用。

## Portal 主题约束

Radix Portal 渲染到后台主题 DOM 之外。Dialog、AlertDialog、Drawer、Dropdown、Popover 和 Tooltip
内容必须展开 `adminThemeAttributes`：

```tsx
<DialogContent {...adminThemeAttributes}>...</DialogContent>
```

新建弹层应优先使用 `AdminDialog`、`AdminDrawer` 和 `AdminDangerConfirmDialog`，避免遗漏主题边界。

## 自动约束与阶段 1 验收

`tests/admin/admin-design-system.test.ts` 应至少验证：

1. 主题名和结构化值到语义令牌的映射；
2. 唯一主操作色为 `#0058BE`；
3. Portal 主题边界；
4. `components/admin` 中除主题源外没有裸十六进制颜色；
5. `AdminShell` 的 `260px / 72px / mobile drawer` 响应式契约；
6. 五类静态样例不出现 Stitch 临时品牌、课程创建或用户添加入口。

视觉验收至少检查 `1920×1080`、`1024×768`、`390×844`，并补充计划要求的其他尺寸后再进入
业务页面迁移。阶段 1 通过只代表系统和静态模式冻结，不代表阶段 2 API 或阶段 3 页面已经完成。
