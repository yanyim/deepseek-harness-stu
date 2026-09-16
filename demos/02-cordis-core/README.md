# Demo 02 · Cordis 五概念——用真源码独立运行

回答的问题(出自笔记库 `guide/02-cordis-core.md`,延伸问答见 `qa/02-插件机制很普通与大图失控.md`):
dsh 的插件机制由 Cordis 提供,五个核心概念(插件形态 / 服务容器 / inject / 类型化事件 / 可逆 effect)到底长什么样?
**Cordis 能脱离 dsh 独立运行吗?**

**答案一句话**:能——`@deepseek-ai/cordis` 在 npm 独立发布(v4.0.2,运行时依赖仅
cosmokit 工具库,零 dsh 知识);本 demo 全程只 import 这一个包,dsh 的一切都建在这
五个无 Agent 知识的概念上(guide/02 §2.7 的反面证明)。

与 demo 01 的分工:demo 01 手写的迷你内核**刻意省了** inject / isolate / fiber 调度 /
事件分发(见其 README「刻意省了什么」);本 demo 用真 Cordis 把这笔债还上。

## 运行

```sh
pnpm demo:02      # 串场:五概念依次登场,每节以剧本行呈现行为
pnpm test         # 行为锁定测试(按单元分布,剧本整列 toEqual)
pnpm typecheck    # tsc:@ts-expect-error 类型断言也是测试的一部分
```

## 组织:目录树 = 论证树

```
src/
  main.ts                       # 串场,叙事顺序 = guide/02 章节顺序
  stage/                        # 公共地基
    fiber-trace.ts              #   FiberState 镜像表 + internal/status 轨迹 + PENDING 诊断
    stage.test.ts
  plugin-forms/                 # 概念一:插件是实现服务的对象
    forms.ts                    #   三形态 + 手写 Standard Schema v1 的 Config
    plugin-forms.test.ts
  service-container/            # 概念二:上下文是服务的容器
    container.ts                #   proxy 解析 / 同名互斥 / extend / isolate / intercept
    service-container.test.ts
  inject-loading/               # 概念三:inject 依赖驱动加载
    dependency.ts               #   等待→激活→级联→重启 / 拼写错误静默 PENDING / ctx.inject 速记
    inject-loading.test.ts
  events-five-modes/            # 概念四:类型化事件
    five-modes.ts               #   emit/parallel/serial/bail/waterfall 逐一对比
    waterfall-discipline.ts     #   纪律现场:观察者忘调 next() 吞掉模型回复
    events-five-modes.test.ts
  reversible-effect/            # 概念五:注册是可逆的副作用
    disposal.ts                 #   逆序清理 / 监听器·服务·定时器消失 / INACTIVE_EFFECT
    hmr.ts                      #   HMR 最小模型:dispose 旧 fiber → 启动新 fiber
    reversible-effect.test.ts
```

## 五概念 ↔ dsh 源码 ↔ guide/02 对照

| 概念 | 本 demo | Cordis 源码(vendor/cordis/src) | dsh 对应物 | guide/02 |
|---|---|---|---|---|
| ① 插件三形态 + Config | `plugin-forms/forms.ts` | `registry.ts` 的 `Plugin` 联合类型 | `AgentLoop`(类插件 + `static inject` + zod Config) | §2.2 |
| ② Context 服务容器 | `service-container/container.ts` | `context.ts` 的 `extend/isolate/intercept`、`service.ts` 的 `resolveConfig` | `ctx.llm/tools/sessions`;`agent.ctx` = isolate 局部世界 | §2.3 |
| ③ inject 依赖驱动 | `inject-loading/dependency.ts` | `fiber.ts` 的 `_checkImpl/_reload` | `AgentLoop` 注入 5 个服务,最后启动;级联重载 = HMR 地基 | §2.4 |
| ④ 类型化事件五模式 | `events-five-modes/five-modes.ts` | `events.ts` 的 `EventsService` | `agent/pre-step`、`llm/stream`、`tools/pre-execute` 瀑布;`session/event` 广播 | §2.5 |
| ⑤ 可逆 effect | `reversible-effect/*.ts` | `fiber.ts` 的 `_unload`、`CordisError.Code` | `--profile headless` 退出时整棵树逆序拆除 | §2.6 |

## 看点提示

- **状态机实测与教程图的差异**:配置校验失败的真实路径是
  `LOADING → UNLOADING → FAILED`(不是图上的直达),依赖者级联卸载后停在
  `UNLOADING → PENDING` 等新提供者——都从 `internal/status` 事件流里实测锁定。
- **waterfall 的 v4 语义**:`next()` 是零参闭包,下游永远拿原始参数;**改写只能发生在
  返回值流上**(`(result) => 加工后再还回去`)。dsh 的 `llm/stream` 包裹返回流正是此模式。
- **忘调 next() 的 bug 现场**:`waterfall-discipline.ts` 复现 guide/02 §2.5 警告框——
  审计监听器只想打日志,结果模型回复变 `undefined`,全程无报错。
- **拼写错误的三道防线**(实测边界,比教程说法更细):
  1. `inject: ['tools']` 拼错 → 数组是 `string[]`,**类型层不拦**,运行时永远静默 PENDING
     (FAQ 常客;诊断靠 registry 扫描,见 `diagnosePending`);
  2. 消费侧 `ctx.greeterr` → 声明合并让不存在的键成为**编译错误**(test 里有 @ts-expect-error);
  3. `@Inject('typo')` 装饰器 → 受 `InjectKey` 约束,**编译错误**(实测确认;但装饰器语法
     非 erasable,本仓库 node strip-types 跑不了,故只记于此未入代码)。
  另外 `ctx.intercept('typo', ...)` 有 `(name: string, any)` 宽 overload 兜着,**拼错不报错**——v4.0.2 现状。
- **`FiberState` 在 npm 版不存在**:源码里是 `export const enum`,发布构建擦除了运行时导出;
  官方教程能 `import { FiberState }` 是因为走 tsx 跑 vendor 源码。`stage/fiber-trace.ts`
  按声明顺序镜像数值表,`stage.test.ts` 用真实迁移锁定对齐。
- **手写 Standard Schema v1**:Config 校验只认 `~standard.validate` 约定,10 行手写即可
  接入(不引 zod)——"协议开放"的直接证据。

## 本 demo 刻意省了什么(留给后续 demo)

- **Loader 与 cordis.yml**:从 YAML/文件加载插件、`id`/`disabled`/组嵌套、真 HMR 插件
  (guide 官方 cordis-tutorial/06;dsh 的 profile/bundle 层,guide/08)
- **fiber 并发调度细节**:epoch 机制、inertia 合并(demo 01 的"刻意省了"清单也还有它)
- **服务生命周期钩子**:`[Service.init]`/异步启动、callable service(`ctx.logger()`)
- **dsh 的服务本体**:`ctx.llm` 的 1092 行 `LlmAdapter` 契约(demo 01 解法⑤已碰过)
