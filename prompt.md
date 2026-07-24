
# 课程生成流程
1.先对pdf进行解析成文本和图片(PDF 文本最多保留前 50,000 个字符、只有前 20 张有效图片进入视觉模型)
2.通过用户输入改写出一版联网检索词进行联网搜索(用户输入超过 400 字或者存在 PDF 文本系统时改写，改写模型会同时参考“用户输入 + PDF 前 7000 字符摘录”，输出不超过350字符检索词)
3.根据用户输入、用户画像(这是什么)、联网搜索结果、pdf解析结果进行模式选择(普通模式:把自由需求转成常规课程大纲，可包含 slide、quiz、interactive、PBL.互动模式:强化互动页面比例，为互动页面选择 simulation、diagram、code、game 等类型.任务引擎模式:判断是否为职业流程训练，并生成操作、安全判断、GO/STOP、故障处理等训练场景){app/api/generate/scene-outlines-stream/route.ts:350,需细细了解有什么区别，每个模式对应的提示词是哪些，输出是什么结构}
4.用户确认大纲
5.根据大纲生成一个个场景内容+动作/讲稿+TTS（根据不同场景走不同内容提示词，每个场景提示词是什么）
6.生成讲解文本并调用tts转语音(浏览器原生TTS播放时由浏览器合成)

课程连续性上下文的构造：lib/generation/prompt-formatters.ts:9

如果目标是尽量忠实于 PDF，建议关闭联网搜索lib/server/search-query-builder.ts:7

## 生成场景页面时的输入只有：lib/generation/scene-generator.ts:773
- 当前场景标题；
- 当前场景说明；
- 当前场景知识点；
- 分配给当前场景的图片或媒体； 
- 课程语言要求；
- 授课角色信息。


## 场景分类：
- 演示页面：slide-content
- 课程题目：quiz-content
- 互动模拟：simulation-content
- 互动图解：diagram-content
- 编程练习：code-content
- 教学游戏：game-content
- 三维展示：visualization3d-content
- 操作训练：procedural-skill-content
- 项目式课程：PBL 规划提示词


## 页面生成后，系统还会再次调用动作提示词，为页面生成教学动作和讲解文本
- 教师讲解；
- 重点聚焦；
- 激光指示；
- 讨论；
- 答题引导；
- 互动操作。

输入：已经生成的场景内容 + 场景大纲 + 课程上下文


# 涉及的提示词
1. web-search-query-rewrite
    - 把长需求和 PDF 摘录压缩成搜索词。

2. requirements-to-outlines
    - 汇总用户输入、PDF 和搜索结果，生成整门课的大纲。
    - 如果开启互动模式则换成 interactive-outlines。
    - 如果开启任务引擎则换成 task-engine-outlines。

3. 每个场景的页面内容提示词之一：
    - slide-content
    - quiz-content
    - simulation-content
    - diagram-content
    - code-content
    - game-content
    - visualization3d-content
    - procedural-skill-content
    - PBL 场景进入 PBL 专用生成链路。

4. 每个场景的动作/讲稿提示词之一：
    - slide-actions
    - quiz-actions
    - interactive-actions
    - pbl-actions