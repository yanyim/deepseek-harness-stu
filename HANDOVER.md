# HANDOVER.md · 会话间交接文档

> 用途:跨会话交接。新会话开工先读 `CLAUDE.md`(工作约定)→ 本文档(进度+背景知识)
> → `git log --oneline -10`(最近动了什么)。**维护约定:每完成一个 demo / qa / 重大实验,
> 收尾时更新本文档的对应小节。**
>
> 快照日期:2026-09-17

---

## 1. 这是什么仓库(30 秒版)

学习 **DeepSeek Harness(dsh,基于 Cordis 的「一切皆插件」Agent 框架)** 的实践仓库:
跑通第三方教程 demo → 在此重写 → 写测试锁定行为 → 问答结论落 Obsidian 笔记库。

| 资源 | 位置 | 备注 |
|---|---|---|
| dsh 源码(读码对象) | `~/projects/stu/deepseek-harness` | 本地检出 `0a53fb5`(0.1.2-alpha.2),**偏旧** |
| Obsidian 笔记库 | `~/store/ysnnn/ysnnn3/TECH-开源项目/deepseek-harness/` | 入口 `学习大纲.md`;`dsh-harness-tutorial/`(教程+qa)、`官方文档/`(160 篇) |
| 本仓库 | `~/projects/stu/deepseek-harness-stu` | demos + 测试 |

学习路径:① 原理篇 8 章 → ② 源码拆解 → ③ 实战 Demo 8 个(进行中,见下)→ ④ mini-harness。

## 2. 当前进度

### 2.1 实战 Demo 对照表(教程 N ↔ 本仓库 NN)

⚠️ 两套编号:**仓库 `demos/NN` = 创建顺序;教程 Demo N = 学习大纲里的 8 个实战 demo**。并不对齐。

| 本仓库 | 对应 | 主题一句话 | 状态 |
|---|---|---|---|
| `00-base-ts` | —(后补地基) | 继承与 this:查找vs绑定 / this 丢失找回 / 简化 prepareCall 三层真相 | ✅ |
| `01-protocol-thickness` | qa/01 | 插件协议厚薄两难(薄到裸函数 vs 厚到配置声明) | ✅ |
| `02-cordis-core` | qa/02 | Cordis 内核:服务容器/extend/isolate/intercept(玩具服务已改名 `demoLlm`,让名真 llm) | ✅ |
| `03-naive-kernel-crash` | 教程原理篇 | 100 行自研内核的三场异步翻车,对照真 Cordis | ✅ |
| `04-first-dsh-plugin` | 裸 dsh 第一课 | 真实工具流水线写插件 + pre-execute 瀑布三姿态;yaml/inline 双通道 | ✅ |
| `05-loading-mechanisms` | qa/02 附录四 | `await import` vs `internal.import`:import 的第二个输入(从哪开始找) | ✅ |
| `06-llm-mock` | **教程 Demo 4** | Mock LLM 适配器:协议义务逐条锁定 + 注册机制解剖(鸭子/子类探针/facade-pattern) | ✅ |
| `07-headless-mock` | **教程 Demo 5** | 真实 dsh CLI 全链路零网络:patch 覆盖层 + 会话日志审计 | ✅ |
| `08-waterfall-mini` | qa/04-附录二(动手版) | 教学版 waterfall:值/流两种载荷同一句型,六实验锁定(洋葱双向/否决/异常穿透/prepend/透传/短路) | ✅ |
| `09-*`(待建) | **教程 Demo 6(下一步)** | 注册工具并观察工具循环:适配器吐 `tool-call` 块 + `finish {kind:'tool-calls'}`,两段式 step | ⬜ |

之后:教程 Demo 7(hooks 拦截)→ Demo 8(profile 组装)→ mini-harness 教学项目(不抄答案,
卡住才看 `参考代码/final-project/`)。

### 2.2 qa 笔记(笔记库 `dsh-harness-tutorial/qa/`)

| qa | 主题 | 配套 demo |
|---|---|---|
| 01 | 插件协议的厚薄困境 | demos/01 |
| 02 + 附录二/三/四 | 插件机制很普通与大图失控;四大机制;动态装配;插件怎么加载 | demos/02/04/05 |
| 03 | registerAdapter 怎么识别适配器 + 注册表四规矩 + 机制墙(三追问:override 死因/this 换人/parent 的 this 校准) | demos/06 registry + demos/00 |
| 04 | **教学版陪读**:guide/05 Agent 循环——turn/step 人话版、时序图逐帧、事件三分类实证(demos/07 日志 ↔ 时序图行行对上)、四动词表、自检清单 | guide/05 + demos/06/07 |
| 04-附录一 | **问题版重讲**(原 qa/05 改编):20 行笨蛋 Agent 逐坑摔,九问九答 + 收官对照表;Q3 深挖版(候选淘汰赛→cordis 瀑布 12 行→双向数据流→reject=blocked 实锤→两次理解校准实录:共享可变状态误区、机制≠安装点/生命周期拦截点全景表);Q4-Q9 深改版(换模型≠换适配器、流没有「后」、投影思想、事实/算法本体论、工具四姿态闸门、越权链、turn 六种死法) | guide/05 + qa/04 互链 |
| 04-附录二 | **瀑布机制细讲**:cordis 四种分发模式源码全景、waterfall 12 行六事实、真包四组实测(洋葱双向/否决短路/异常传播/prepend)、值瀑布 vs 流瀑布对照、scope 过滤(每 agent 一条链)、中间件家族定位、§8 校准(读者vs关卡)、§9 为何嵌套(淘汰赛+四必杀+Express→Koa) | 附录一 + demos/06/08 |
| 05 | **会话的本质:日志+投影**——surface 概念(四类事件才上模型可见面;SurfaceOp replace=压缩的武器)、13 种核心事件+插件开放扩展、subagent=fork 血缘(parentSession/origin/平衡前缀种子,值语义天然隔离)、工具全落盘但「日志的大=存储问题,投影的小=预算问题」、压缩=带审计的 surface 手术(compaction/start→summary→replace→end,失败留疤)+四层优化(阈值/purpose 路由/剪枝前置/只压旧区) | guide/07 + demos/07 |

### 2.3 版本差现状(方法论:实测为准)

三方版本:**教程 0.1.0-rc.6** / **本地源码 0.1.2-alpha.2(0a53fb5)** / **npm 依赖 0.1.6-alpha.1(实际运行对象)**,
官方文档取自 origin/master `0d1f500`。读码与文档/教程不符时:**以已安装 node_modules 的实测为准**,
教程结论仅当参考,漂移如实记入各 demo README 的「版本差实录」。

已知重要漂移(详见各 README):
- Message 契约三件套(id/content 块数组/source),官方 `createUserMessage` 工厂;
- `providerInfo()` 缺省名 = 回显路由 id(教程时代是类名);
- `registerAdapter` 返回 handle 带 `.replace()` 原子换路由(0.1.6 新);
- 教程实验 1「迟到 usage 被忽略」在 0.1.6 **不成立**(组装器照收,真正硬执法的是已完成块不可篡改);
- patch 插件相对路径基准 = **patch 文件所在目录**(教程称 profile 目录;跨目录复用用 `file://` 绝对 URL);
- 持久化 `session.v3.jsonl.zstd`,不再逐 chunk 落盘;
- headless 默认模型 `deepseek-official/deepseek-flash`。

## 3. 背景知识速查(核心结论,带指针)

1. **注册机制**:`'my-provider'` 只是 `ctx.llm` 自家 `Map` 的路由键,不是身份;**全程无 instanceof**,
   识别靠编译层(TS 结构类型)/注册层(立刻调 `providerInfo`+`providerRetryPolicy` 摸行为)/调用层
   (`prepareCall→normalizeModelInfo→stream`)。→ qa/03 §1-2,demos/06 `registry/duck-adapter.ts`
2. **注册表四规矩**:DUPLICATE_ADAPTER(路由确定性)/ all-or-nothing(不留半注册)/ replace 原子换路由
   (同步段无观察缝隙)/ 目录+模型发现(菜单与后厨分离,设置页数据源)。→ qa/03 §3-4
3. **机制墙(override 为什么死)**:runtime 只调 `adapter.prepareCall()`,拿到的是闭包包裹;真适配器
   (DeepSeekAdapter 等)是**门面**——`prepareCall` 体内 `implementation()` new 出内部对象,**this 换人**,
   闭包绑内部对象的私有传输路径,不经过 `this.stream`。基类 LlmAdapter 的缺省 `prepareCall` 才写
   `this.stream`(所以继承基类的 override 生效)。**闭包机制无差别,差别只在「闭包里写了谁的名字」**。
   → qa/03 追问节,demos/00 幕三,demos/06 `subclass-probe.ts` 探针 C/D
4. **门面挂 stream 的三层答案**:abstract 逼的(不挂编译不过)→ 实现成转发(直调也是活路)→ 分派链
   不走它。**一套实现、两扇门**,汇合到同一段内部代码。→ demos/00 `facade-style.ts`(wireObserver 计数证明)
5. **this 两条独立机制**:查找(原型链,决定跑哪段代码)≠ 绑定(this 恒等于发起调用的实例;
   「parent 的 this」不存在)。方法取出直调即丢 this(ESM 恒 strict)。→ demos/00 幕一/幕二
6. **StreamChunk 协议义务五条与执法**:usage 先于 finish / index 按首现分配(交织归位)/ 失败只有
   抛异常与带内 finish 两路 / 遵守 signal / replayState。执法在组装器(违规者得不到正确结果)与
   runtime(`adapterStream` 把迭代失败包成 terminal chunk)。→ demos/06 三个单元
7. **headless 全链路**:`--profile headless --patch` 只改两行(insert 插件 + 定向替换 agent-default-model),
   整条真实链路运转;会话日志=「模型可见即已记录」(注入上下文全落盘);辅助调用(标题生成)走同一接缝。
   → demos/07
8. **import 的第二个输入**:Node 自动填「写这行代码的文件住在哪」;拿到加载器后变成参数
   (patch 相对路径基准 = dsh-app-boot `boot()` 的 `dirname(configPath)`)。→ demos/05 + demos/07

## 4. 工作方法(怎么继续干活)

**新 demo 标准流程**:
1. 读教程页 + 参考代码(笔记库 `dsh-harness-tutorial/demos/demo-NN-*.md` + `参考代码/demos/NN-*/`);
2. 在本仓库环境**先跑通参考代码**(拷进临时文件跑,记录版本差);
3. 重写为 `demos/NN-主题/`(下一编号):目录树=论证树,文件头三段(目标/思路/对照),
   单元内标本+测试同目录;串场 main.ts 叙事=论证;根 package.json 注册 `demo:NN`;
4. 测试锁定行为(剧本整列 toEqual + 字段级断言;`@ts-expect-error` 也是测试);
5. README:困境/总图/运行/对照表/版本差实录/刻意省了什么;
6. **收尾三绿**:`pnpm typecheck` + `pnpm demo:NN` + `pnpm test`;commit(中文主题式 message);
7. 更新本文档 §2。

**问答流程**(用户约定「问题自动落盘」):困惑 → 读源码/实测验证(探针脚本)→ 结论落
`qa/NN-*.md`(结论先行+依据+实验复现),实验标本进对应 demo,双向链接。实验产物照「一个标本文件
= 一个论点」拆分(demos/00 preparecall-mini 是范例);概念吸收后标本可退役(删文件,README 留 git 指针)。

**硬约束**:只用可擦除 TS 语法(禁 enum/namespace/构造器参数属性);imports 带 `.ts` 扩展;
`exactOptionalPropertyTypes` 开着;测试断言认 `code` 不解析 message 文案。

## 5. 环境与命令

- Node 22.19(zstd 解压可用)/ pnpm 10.15;ESM。
- **运行模型(为什么裸 `node xx.ts` 能跑)**:Node 22.18 起类型擦除(type stripping)默认开启
  (`process.features.typescript === 'strip'`,底层 amaro/SWC,加载时把类型标注擦掉当 JS 执行,
  **不做类型检查**——`pnpm typecheck` 因此独立存在)。只支持「可擦除」语法:类型注解/interface/
  type 别名/泛型/as;**enum、namespace、构造器参数属性、旧装饰器**直接语法报错(要生成真实代码,
  非擦除可办)——这就是 CLAUDE.md 那条禁令的来源。imports 必须写 `.ts` 扩展名(Node 按字面解析
  说明符,不像 tsc 帮你补)。需要完整转译时用 tsx(devDep,esbuild);`--experimental-transform-types`
  旗标是 Node 自带的另一档。
- `pnpm demo:00 … demo:07`(见根 package.json);`pnpm test`(vitest,24 文件 75 用例);
  `pnpm typecheck`(tsc --noEmit)。demo:04 用 tsx(跑 cordis bin+loader 链路)、demo:05 加
  `--expose-internals`(要 Node 内部模块)——各有特殊原因,其余都是裸 node。
- 关键依赖:能力包 + CLI 全部钉在 **0.1.6-alpha.1**(`@deepseek-ai/dsh`、`dsh-llm-deepseek` 为
  devDep;dsh CLI bin:`node_modules/@deepseek-ai/dsh/lib/bin.js`)。
- demos/07 的 e2e 会 spawn 真实 dsh 子进程(DSH_HOME 隔离在 tmp/demo 目录),零网络。

## 6. 下一步(优先级)

0. **插件开发阶段已启动**:选题库见根目录 **`PLUGINS.md`(20 个代表性场景,五组分类,
   每场景标注代表性/依赖/难度)**。用户指示「本阶段集中于 plugin 开发,插件是影响结果
   的最佳方式」。每完成一个场景:a) 在 PLUGINS.md 条目标 ✅ 并登记 demos/NN 编号;
   b) 有新结论落 qa;验收用 demos/07 的 headless 链路(patch 方法)最多。
1. **教程 Demo 6 → demos/09**:注册 echo 工具 + mock 适配器吐工具调用,观察两段式 step。
   材料:教程页 `demo-06-tool-echo.md` + 参考代码 `06-tool-echo/`;demos/07 的插件刻意省了
   echo 分支(README 有说明),届时补上;demos/04 的 greet-tool 是工具注册侧的前置。
   (教程 Demo 7 hooks 的材料正好服务 PLUGINS 场景,可与选题交叉进行。)
2. 教程 Demo 7(hooks)→ Demo 8(profile)→ 进入 mini-harness。
3. 可选沉淀:qa/03 的版本差实录合入学习大纲进度页;`00-base-ts` 是否加 call/apply 等按需。

## 7. 交接检查清单(新会话开工)

- [ ] 读 `CLAUDE.md`(工作约定)+ 本文档 + `git log --oneline -10`
- [ ] 确认三方版本差不踩坑(§2.3)
- [ ] 从 §6 的优先级顶端继续;若用户带来新问题,走 §4 的问答流程
- [ ] 收尾时:三绿 + commit + **更新本文档**
