# Demo 04 · 裸 dsh 第一课:写一个真插件

回答的问题:「demo 02/03 在真空里认识机制;现在开始写插件——**如何进行、如何观察、不可
能没有 API key**」。

**答案一句话**:裸 dsh = `@deepseek-ai/cordis` 的 bin.js + npm 上的 dsh 能力插件
(0.1.6-alpha.1)+ 你的插件同权写进 `cordis.yml`。观察三层:自己写的 observer 插件
(事件线)、`internal/status` + registry 扫描(状态线)、logger-console(日志线)。

## 运行

```sh
pnpm demo:04            # cd 进本目录,tsx 跑 cordis bin,当前 cordis.yml = 第二课组合
pnpm test               # 两课行为锁定(inline 组合,不经 yaml)
pnpm typecheck
```

> **两种组合通道,语义等价**(这是本 demo 的结构性教学点):
> - **yaml 通道**(demo 运行):`cordis.yml` + loader(include 插件加载相对路径插件)。
>   插件文件是独立模块,导出 `name/inject/apply`——loader 是「把 plugin 列表外置成数据」。
> - **inline 通道**(测试):`startInlineHarness([...])` 直接 `ctx.plugin()` 同一批模块。
> - 见到的行为完全一致:依赖链由 inject 驱动,顺序无关(第二课 test 断言 audit 顺序,
>   与 yaml 运行输出一致)。
>
> vitest 走 inline 的原因:loader 加载 cwd 下 `.ts` 文件走 Node 原生 loader(internal.import),
> vitest 的模块环境不认识裸 .ts,静态复现困难。

## 组织:目录树 = 课程

```
04-first-dsh-plugin/
  cordis.yml                    # 组合数据(当前=第二课三姿态)
  harness.ts                    # yaml 通道:startHarness(cwd/configPath)≈ cordis bin.js
  harness-inline.ts             # inline 通道:startInlineHarness(测试用)
  src/
    lesson-1-tool/              # 第一课:注册-执行-观察(官方 cordis-tutorial/07 的对照)
      greet-tool.ts             #   视角一 能力插件:defineTool + ctx.tools.register
      tool-observer.ts          #   视角二 观察者插件:ctx.on('tools/result') 记账
      lesson-1.test.ts          #   (视角三 logger-console 只在 yaml 通道演示)
    lesson-2-waterfall/         # 第二课:pre-execute 瀑布三姿态(官方第 07 章延伸)
      waterfall-auditor.ts      #   姿态三 观察者:pre+post 全委托记账
      approver-allow.ts         #   姿态一 放行:无条件 next()
      approver-veto.ts          #   姿态二 否决:命中规则 → {kind:'deny',reason} 不调 next
      greet-registry.ts         #   被拦截的工具(只注册不驱动)
      lesson-2-driver.ts        #   模型立场:execute 两次(放行/否决各一)
      lesson-2.test.ts
```

## 对照表

| 课 | 演示 | dsh 事件 | 官方对照 |
|---|---|---|---|
| 1 | greet 工具注册+execute | `tools/result`(emit) | cordis-tutorial/07 原样 |
| 2 | pre-execute:观察/放行/否决 | `tools/pre-execute`/`tools/post-execute`(waterfall) | guide/06 审批链;PreToolDecision(allow/deny/cancel/ask) |

## 看点提示(全部实测)

- **否决后 post-execute 仍发生**:调度器把拒绝 result 作为 `post-result` 送入
  post-execute(源码注释:"A post-result still receives post-execute"),所以否决
  也有 post 记录(isError=true)。观察者视角是完整四条,不是三条。
- **策略拒绝的 reason 会成为模型可见的 content**(`Error: 策略拒绝:…`)——模型拿
  到原因才有机会自我纠正,这是 approvals 设计的用法教训。
- **pre-execute 不允许改写 arguments**(PreToolDecision 注释:"Input rewriting is
  excluded because arguments are already logged and presented")——「改写」姿态在这层
  焊死了;合法改写点在 `agent/request`/`agent/pre-step`(guide/06 的层次)。
- **排查实录(价值最高的现场)**:第一版 auditor 的 `post-execute` 监听器签名
  `(exec, _decision)` 两个参数、没调 next()——把 postExecute 的 decision 变
  undefined,炸在 `decision.additionalContexts`(千里之外的调度器),错误信息与
  现场毫无关系。与 demo 02 的 waterfall-discipline、demo 03 翻车现场同一教训:
  **waterfall 忘调 next() 的炸点永远不在你自己这里**。
- **Dsh 包版本勘误**(冒烟阶段发现):`dsh-*` 必须 pin `0.1.6-alpha.1`;
  `0.0.1-rc.1` 依赖树里有未发布的 `dsh-type-meta`,pnpm 解析 404。
- **FiberState 数值**:diagnose 输出里 `state=2` 即 ACTIVE(枚举被发布构建擦除,
  镜像表见 demos/02/03 的 stage)。

## 刻意省了什么

- agent 循环串联(需要 llm 适配器/mocks,教程 demo 04/05 的内容)
- `ask`/`cancel` 决策分支、guard/restrict 等更细的治理 API
- PTC 模式与 `run_code`;会话持久化与恢复
