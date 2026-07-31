# OpenMAIC v0.3.1 值得当前项目吸收的更新

> 调研范围：上游 `THU-MAIC/OpenMAIC` 的 `v0.3.0...v0.3.1`，并对照当前项目 `zq-main / yuanwo-v0.1.6`。  
> 结论以 2026-07-27 的代码为准。本次仅调研，不修改业务代码。

## 一、精简结论

上游 `v0.3.1` 相对 `v0.3.0` 有 86 个提交，涉及至少 300 个文件，不适合整版本合并。当前项目已经从上游 `v0.3.0` 大幅二开，建议按功能移植，并保留现有企业认证、PostgreSQL 课程存储、社区、后台和生产部署合同。

最值得吸收的更新按优先级如下。

| 优先级 | 建议吸收 | 对当前项目的价值 | 建议方式 |
| --- | --- | --- | --- |
| P0 | SSRF 加固：禁止探测请求跟随重定向、补齐 ISATAP 等地址识别 | 当前项目允许配置外部模型、PDF、图片和媒体服务地址，属于服务端网络请求入口 | 移植上游 `#928`、`#930` 的逻辑与测试，不直接 cherry-pick 整批提交 |
| P0 | 生成 JSON 解析时剥离 reasoning/thinking 块 | 降低推理模型输出夹带思考内容导致 JSON 解析失败的概率 | 移植 `#750`，改动面较小 |
| P0 | 豆包 TTS 串流 JSON 的字符串感知切分 | 当前实现用花括号深度切分；错误消息或字符串中出现 `{`、`}` 时可能误切 | 只吸收 `#677` 的安全解析器；不要顺带改变现有服务端托管凭据合同 |
| P0/P1 | 空场景、零动作场景可播放，使用稳定 `outlineId` 绑定场景与大纲 | 当前项目已有专业编辑、重排和持久化；按 `order` 关联容易在重排后串到另一页大纲 | 手工移植稳定身份设计，并回归现有保存、弹幕和播放链路 |
| P1 | 多格式、多文档课程材料及 Document Bundle | 当前仅接受 PDF；上游可为多个来源保留独立文本预算、来源标题和图片来源信息 | 吸收“来源分区、保底预算、按比例分配、稳定引用”机制，再接入现有生成流程 |
| P1 | 场景内 TTS 并行生成 | 可明显缩短一页内多段讲解的语音生成时间 | 必须做可配置的有界并发，并针对豆包配额、429/限流和失败重试验收，不能直接 `Promise.all` 放开 |
| P1 | 动作级播放导航 | 可精确跳到某一讲解动作；与当前按 `actionId + actionOffsetMs` 组织的弹幕天然互补 | 手工适配现有 `PlaybackChromeRoot`、播放引擎和弹幕调度 |
| P1/P2 | 画布元素直接拖动、八点缩放、旋转、框选和多元素拖动 | 能显著提升专业模式编辑体验 | 上游建立在 renderer v2 编辑层上，建议作为独立阶段引入，不能把新 renderer 整体覆盖到当前项目 |
| P2 | DSL 校验器、迁移注册表、元素默认值归一化 | 有助于长期控制 AI 输出、导入文件和旧课程数据的兼容性 | 优先借鉴纯校验和迁移机制，暂不整体替换现有类型及存储结构 |
| P2 | AI 元素级编辑、校验后的 JSON Patch | 比整页重生成更可控，可减少误删和大范围漂移 | 应在 renderer v2 和 DSL 校验稳定后再接入 |
| P2 | MP4 视频导出 | 有对外发布课程视频的产品价值 | 上游需要独立渲染服务、任务队列、并发限制和产物下载接口；应按新服务评审，不适合当作普通前端功能合入 |

不建议当前直接吸收：实验性 Pi classroom runtime、整套参考 RuntimeStore 服务、客户端一键 Token Plan、上游使用量面板。当前项目已有登录用户、企业课程、PostgreSQL、权限和服务端托管供应商配置；直接引入会形成第二套身份、状态或凭据管理体系。Azure OpenAI、SearXNG、ComfyUI 等供应商支持可以等出现明确业务需求时单独接入。

上游依据：

- [v0.3.0...v0.3.1 官方比较](https://github.com/THU-MAIC/OpenMAIC/compare/v0.3.0...v0.3.1)
- [v0.3.1 CHANGELOG](https://github.com/THU-MAIC/OpenMAIC/blob/v0.3.1/CHANGELOG.md)
- [多格式课程材料 #741](https://github.com/THU-MAIC/OpenMAIC/pull/741)
- [Document Bundle #844](https://github.com/THU-MAIC/OpenMAIC/pull/844)
- [场景内 TTS 并行 #696](https://github.com/THU-MAIC/OpenMAIC/pull/696)
- [动作级播放导航 #843](https://github.com/THU-MAIC/OpenMAIC/pull/843)
- [SSRF 加固 #928](https://github.com/THU-MAIC/OpenMAIC/pull/928)、[#930](https://github.com/THU-MAIC/OpenMAIC/pull/930)

## 二、是否有“保留详细用户输入作为讲解依据”的类似更新

### 结论

`v0.3.1` **没有完整实现这个目标**。

最接近的是 Document Bundle：它不是把多份材料简单拼接后从尾部截断，而是：

1. 给每份材料保留基础文本预算；
2. 将剩余预算按原始长度比例分配；
3. 为每份材料加入来源标题、顺序、MIME 类型和页数；
4. 保留图片来自哪份材料，并在视觉图片名额有限时尽量覆盖不同来源。

这个机制值得借鉴，因为它解决了“多个输入来源中，短材料或后上传材料被完全挤掉”的问题。但它主要保护的是**上传文档内容**，不是通用的用户需求细节，也没有新增一个面向每个场景的 `teachingBrief`、`mustCoverDetails` 或“原始需求引用”字段。

另外两个相关但范围较窄的更新是：

- 使用稳定 `outlineId` 将场景绑定到原始大纲，避免编辑、插入或重排后拿错另一页的标题、类型和要点；
- 将大纲中的 diagram 节点约束传给图表生成，以及将真实 HTML 元素清单传给交互动作提示词。

它们说明了一个正确方向：**重要约束不能只存在于上一步提示词中，而要作为结构化数据传到真正消费它的下游生成阶段。** 但上游还没有把这个原则推广到通用用户需求。

## 三、当前项目为什么会把详细输入压缩掉

当前链路的核心问题不只是内置提示词，而是数据合同和传递链路：

```text
用户详细输入
  ↓
requirements-to-outlines
  ↓
SceneOutline：title + description + 3 个左右 keyPoints
  ↓
slide-content / quiz-content / interactive-content
  ↓
scene-actions / TTS 讲解
```

具体表现：

1. 大纲提示词明确要求输出简短的 `description` 和 `keyPoints`，因此详细要求首先被压缩成大纲摘要。
2. 普通幻灯片内容提示词只接收当前大纲的 `title`、`description`、`keyPoints` 和图片等信息；没有直接获得完整用户需求。
3. `fetchSceneContent()` 的类型和 `/api/generate/scene-content` 路由已经预留了 `requirements?: UserRequirements`，路由也会把它交给 `generateSceneContent()`。
4. 但 `GenerationParams` 当前没有 `requirements` 字段，实际调用 `fetchSceneContent()` 时也没有传它。
5. 即便补上传输，当前普通 slide 内容模板仍未使用完整需求；现有 `userRequirements` 主要在 PBL planner 中消费。
6. 动作/讲解生成又只拿到大纲、已生成内容、前文讲解和用户画像，没有独立的“本场景必须保留哪些用户细节”合同。

相关代码位置：

- `lib/prompts/templates/requirements-to-outlines/user.md`
- `lib/types/generation.ts` 中的 `SceneOutline`
- `lib/hooks/use-scene-generator.ts` 中的 `GenerationParams`、`fetchSceneContent()` 和实际调用点
- `app/api/generate/scene-content/route.ts`
- `lib/generation/scene-generator.ts` 中的 slide/quiz/interactive 内容提示词变量

因此，只修改 `requirements-to-outlines` 提示词虽然能让 `description` 或 `keyPoints` 写得更长，但仍会遇到三个问题：输出不稳定、结构不可验证、后续动作生成不一定知道哪些文字必须讲出来。

## 四、推荐的吸收与改造方案

建议借鉴 `v0.3.1` 的 Document Bundle 思路，增加一个“课程需求上下文 + 场景讲解依据”合同，而不是只把 `keyPoints` 写长。

### 1. 保留课程级原始需求

在生成会话中保留完整 `UserRequirements.requirement`，并把它加入 `GenerationParams`，传到 scene-content 和 scene-actions。原始需求作为兜底上下文，不能只在生成大纲后丢弃。

### 2. 为每个大纲增加结构化讲解依据

可在 `SceneOutline` 中增加类似字段：

```ts
interface SceneOutline {
  // 现有字段……
  teachingBrief?: {
    mustCover: string[];
    supportingDetails: string[];
    userConstraints: string[];
    sourceExcerpts?: string[];
  };
}
```

建议语义：

- `mustCover`：本场景必须讲清的结论、步骤、事实；
- `supportingDetails`：用户输入中的案例、原因、数字、操作细节和限定条件；
- `userConstraints`：受众、语气、难度、时长、禁区、输出形式；
- `sourceExcerpts`：必要时保留用户原文片段，但要设总字符预算，避免每个场景复制整段输入。

### 3. 让内容和动作阶段都消费同一份依据

- slide/quiz/interactive/PBL 内容生成：要求覆盖 `mustCover` 和相关 `supportingDetails`；
- actions/讲解生成：要求将幻灯片上不宜塞入的细节转化为口头讲解，而不是把所有细节都堆到画布；
- 生成后做纯函数校验：检查 `mustCover` 是否至少出现在可见内容或讲解文本之一，缺失时定向补写，而不是重生成整页。

### 4. 采用类似 Document Bundle 的预算策略

详细输入很长时，不要简单取前 N 字。可以按以下顺序分配：

1. 每个明确主题或用户约束先获得最低保留预算；
2. 剩余预算按信息量或关联场景分配；
3. 数字、步骤、条件、例子和否定约束优先于泛化描述；
4. 保存“原始输入 → 场景 → mustCover”的引用关系，便于编辑和验收。

### 5. 推荐实施顺序

1. 先补齐 `requirements` 从生成会话到 scene-content 的传递；
2. 扩展大纲 schema 和提示词，生成 `teachingBrief`；
3. 修改各内容提示词消费 `teachingBrief`；
4. 修改 scene-actions，让未放入画布的细节进入讲解文字；
5. 增加解析、截断预算、必讲项覆盖、重试和旧课程兼容测试；
6. 最后再考虑多文档 Document Bundle，复用同一套来源和预算模型。

## 五、最终建议

如果当前只选一项产品能力做下一阶段，建议优先做“**详细需求保真链路**”，其优先级高于视频导出、RuntimeStore 或新增模型供应商。它直接改善课程生成的核心质量，也能为以后导入多份材料、AI 元素编辑和动作级讲解建立统一的数据基础。

可以吸收上游 `v0.3.1` 的两个设计思想：

- Document Bundle 的“每个来源保底 + 剩余预算按比例分配 + 来源可追踪”；
- `outlineId` 和交互约束传递的“结构化约束必须跟随对象进入下游消费者”。

但具体的 `teachingBrief`、原始需求贯穿和必讲项覆盖校验，需要在当前项目中自行实现；上游 `v0.3.1` 没有可直接拿来的完整功能。
