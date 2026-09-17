# 插件开发场景清单 · 20 个代表性练习

> 用途:插件开发阶段的选题库(根目录 `PLUGINS.md`,与 HANDOVER 同级;每开工一个场景
> 落 `demos/NN-*`,完成后在本文档对应条目标 ✅ 并登记 demo 编号)。每个场景标注**代表性**(它逼你练到 dsh 的哪个机制)、
> 知识依赖(仓库哪课)、预估难度(★ 起步 / ★★ 进阶 / ★★★ 综合)。原则:**插件是
> 影响结果的最佳方式**——所以这 20 个全走插件形态,不动框架一行。
>
> 挑选逻辑:dsh 的插件可下钩的位置就那么几类(注册服务/挂瀑布/记日志/扩词汇/注册
> 工具/声明能力),20 个场景 = 每类钩子 2-4 个代表,从「一行监听器」到「四钩 combos」
> 排成难度阶梯。做完对插件开发的全景就立住了。

## 组织:按「插到哪条缝」分五组

```
A. 观察记录组(挂 session/event / 发事件端)   —— 最小插件,练「一切皆事件」
B. 模型输入输出边界组(瀑布四道)             —— 练否决/替换/包裹
C. 工具与执行边界组(新工具 + 工具闸门)       —— 练 defineTool 与三段闸门
D. 服务与接缝组(新 Service/注册适配器等)      —— 练服务容器与接缝
E. 生命周期组(多钩协作的状态机型插件)         —— 综合练习,官方同级复杂度
```

---

## A 组 · 观察记录(门槛最低,验证「加一个审计系统=写一个插件」)

**1. Token 账本** ★
痛点:Questions「这次任务花了多少 token?」→ 注册 `llm/stream` 透传监听器逐 chunk
数 usage。练:包裹式监听器(观察即经过)。
对照:demos/06 §3 透传监听器;官方 token-meter。
预期:每个 step 结束打一行用量;数据组需求当场满足。

**2. 会话心电图** ★
痛点:新需求「把这个 Agent 的工作轨迹导出成 Markdown」→ `session/event` emit 监听
turn/step/tool 事件,落一个可读时间线。
练:emit 消费者;qa/04 §3「事实才存档」的真实数据源。
预期:`pnpm demo:07` 的 21 行日志换一种人类可读的呈现。

**3. 违规累计告警** ★
痛点:「工具被 deny 超过 3 次,把会话标记为异常」→ `session/event` 广播里数
`tool/result`(isError 标记)的连续出现。
练:跨步骤的插件本地状态(插件自己持有计数器,不进日志——因为这是策略不是事实)。

**4. 敏感内容雷达(先只报警不动手)** ★★
痛点:「消息里有密钥样式就告警」→ `agent/pre-step` 只看不拦版本,返回 `enter` +
记录;和 B4 的「拦」形成对照实验:同一位置,emit 语义 vs waterfall 语义。
练:同一位点的两种分发模式对比。

## B 组 · 模型输入输出边界(瀑布四道闸,「否决/替换/包裹」的主战场)

**5. 上下文预算守门员** ★★
痛点:上下文超预算就拒绝开 step → `agent/pre-step` 返回 `reject`。
练:值瀑布否决;顺带实测被否决后 `turn/end {kind:'blocked'}`(qa/04 附录一 Q3 实锤)。
预期:日志里能看到被拒 turn 的完整痕迹。

**6. 用户措辞改写器** ★★
痛点:"帮我看看" → "审查代码变更并指出风险" → `agent/pre-step` **包裹式替换**
`enter { messages: [改写版] }`。练:替换后放行;外层加工内层结果(内→外回流)。
预期:与 5 对照——一个否决、一个替换,同一道门的两种语义。

**7. 场景路由器(qa/04 附录一 Q4 的落地)** ★★
痛点:"闲聊走便宜模型" → `agent/request` 返回替换的 `LlmCallConfig`。
练:配置域瀑布;`purpose` 字段按用途路由。
预期:`request/header` 落盘证明路由切换成功。

**8. token 统计版 llm-commit 短路测试** ★
痛点:想验证 agent 无网络可测 → `llm/stream` 短路监听器(demos/06 已写过),本场景
把它做成**按 provider 条件短路**(真实 provider 走真流,mock provider 走脚本)。
练:流瀑布短路 + provider 条件判断。

**9. 请求失败回退器** ★★★
痛点:"主模型挂了自动降级到备用模型" → `agent/request-error` 返回
`{kind:'retry'}` + 换 provider 重试。
练:failure 分类路由(`AUTH` 不该重试)/ 状态机(降级过一次就不重复降)。
对照:`agent/request-error` 是七道闸里唯一「失败后」的门。

## C 组 · 工具与执行边界

**10. 微软风险工具闸门(ask 审批)** ★
痛点:"删文件前必须人点头" → 具名工具命中时 `tools/pre-execute` 返回 `ask`,
接 `agent.inject` 把审批问题挂到会话上(或简化为直接 deny)。
练:四姿态闸门里「升级给人」这一档(qa/04 附录一 Q7)。

**11. deny 理由教育员** ★
痛点:模型调用被拒后往往反复尝试同一调用 → `tools/pre-execute` 返回
`deny`+**结构化理由**,验证「理由会喂回模型并让它改道」。
练:闭环纠错——拒绝不是终局,是对模型的一次反馈。

**12. 结果瘦身投影器(qa/05 §4 的落地)** ★★
痛点:工具返回 50KB 文本 → `tools/post-execute` 把**展示投影**替换为
「头 200 字 + `[...pruned...]` + 尾 200 字」;program 拿到的真值不受影响。
练:`PostToolDecision.accept` 的 `content` 替换通道;对应官方
`compaction-tool-result-pruner` 的思路。

**13. 一件新工具:标准 CRUD 工具** ★
痛点:给 Agent 加个「记笔记」工具 → `defineTool`(name/description/parameters/
execute)。核心练习是 **description 的写法**:模型只读 schema 挑工具,description
写得差模型就不会用——工具质量=提示词质量。
对照:demos/04 第一课的 greet-tool(管线下再走一遍,带 parameters 校验)。

## D 组 · 服务与接缝

**14. 第二个 LLM 适配器换个协议形态** ★★
痛点:做一个「延迟放送适配器」——把 chunk 收完攒着,模拟非流式提供方(batch 模式
一次吐完)。或不继承 LlmAdapter 的独立类(qa/03 鸭子)。
练:适配器只有 stream 必须实现的接缝;验收=`dsh --profile headless` 挂它跑通
全链路(demos/07 的 patch 方法)。

**15. 会话标题自定义策略** ★★
痛点:对默认标题生成不满意,想「第一条 user 消息 + 项目目录名」 → 写一个小插件:
`session/title-llm-request` 事件(emit)观察现有标题链路 + `session/event` 广播里
替换/追加一条 `session/title`(与 demos/07 日志 seq 14/19 的双 title 写法一致)。
练:扩展事件词汇(自定义事件类型 declare module)+ 下游生态消费。

**16. 配置热更新的服务** ★★
痛点:插件读 `ctx.settings` 的阈值,改配置不用重启 → `settings` 接缝 + 每 step
重新 resolve(qa/04 附录一 Q4 提过:「动态适配器,连接事实 per-request 解析」)。
练:配置从插件 config 到 settings 到运行时的完整链路。

## E 组 · 生命周期综合(官方同级复杂度)

**17. 自动压缩(官方 compaction-basic 的简化复刻)** ★★★
痛点:上下文要满 → `agent/pre-step` 检查 token 超阈值 → 触发摘要 → 写
`compaction/*` 事件组 + `surfaceOp replace`。用假 tokenizer(估算)避开真实 LLM
调用,核心是**把一次手术完整写进日志**。
对照:qa/05 §5 五步手术全程;官方版四层优化至少实现「阈值触发+只压旧区」。

**18. 定时器注入器(cron 式「定时给 agent 塞一条提醒」)** ★★
痛点:"每 X 分钟提醒 agent 检查待办" → `inject`(不唤醒)或 `followup`(唤醒)
的节奏器;观察 Q2 那两个动词的差别。
练:插件里的定时器生命周期(注册 interval,dispose 清掉)。

**19. 运行时配置校验员(invariants 机制入门)** ★★
痛点:「模型请求内容必须是日志纯函数」这类守门员 → 用 `ctx.invariants.register`
写一条自定义断言(计数事件配对、seq 连续性……)。
练:运行时断言本身的编写;dsh 的自我约束体系(guide/07 的"坑位警告"的执法者)。

**20. 会话救援与续接(补 interrupted)** ★★★
痛点:模拟「进程崩了再起来」→ 写一个插件检测孤儿 turn(resume 时日志尾部没有
turn/end)→ 补 `interrupted` closer 并可选续接。
对照:qa/05 Q6 的两种 turn 结局;练习读写日志 + 别克 folk(事件表)。

## 选题建议

- **先做**:1/2/5/8(A+B 组小件,验证已学的四种钩子,每个 ≤1 天);
- **再做**:6/7/10/12/13(B+C 组主战场,每个 ≤2 天);
- **收获最大**:17(简化版 compaction)——它把 surface/replace/摘要/purpose/
  剪枝前置于一身,做完对 dsh「一切皆插件」的深度有实感;
- **最有产品感**:18/20(真实部署才会撞到的生命周期问题)。

配套方法论(仓库已有):先参考教程 demo-07-hooks(教程 Demo 7 的材料,正好是
钩子拦截课)确认官方想要的开环;突破新事件时带 `@mode` 标注自查:emit 观察、
waterfall 干预、serial 发言。收尾三绿,纪录 qa。
