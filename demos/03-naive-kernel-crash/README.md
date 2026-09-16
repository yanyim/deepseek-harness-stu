# Demo 03 · 100 行自研版翻车现场

回答的问题(出自笔记库 `qa/02-插件机制很普通与大图失控.md` §2.5 的种子):
「这套插件机制很普通,我自己很容易就能实现一个」——**能,然后在哪一步开始付费?**

**答案一句话**:快乐路径约 110 行就能跑通(本 demo 的 naive 内核通过了 demo 02
概念三的全部同步场景);付费点全部在「世界比你先变」的三个异步场景——中途换依赖、
异步清理换班、卸载报错定位。naive 三场全翻,Cordis 三场全活,差价就是
`fiber.ts` 那 754 行里的 epoch / inertia / 异常隔离 / 注册点记账。

## 运行

```sh
pnpm demo:03      # 串场:naive 快乐路径 → 三场翻车(naive/cordis 对照)→ 番外 → 付费点清单
pnpm test         # 15 个用例:4 个证明 naive 不是稻草人 + 11 个锁定翻车差异
pnpm typecheck
```

## 组织:目录树 = 论证树

```
src/
  main.ts                       # 串场:先证明它行,再看它何时不行
  stage/
    states.ts                   # fiber 状态镜像表(锁定在 demo 02 的 stage.test.ts)
  naive/                        # 主角:诚实的自研内核(约 110 行)
    naive-kernel.ts             #   services Map + listeners 数组 + 逆序清理 + 停靠/级联重生
    naive-kernel.test.ts        #   快乐路径 4 例:顺序无关/事件/逆序清理/级联重生
  crash-1-race/                 # 翻车一:中途换依赖(竞态)
    race.ts                     #   同一时间线:naive 幽灵监听器越积越多 vs cordis 代际作废
    form-hazard.ts              #   番外:形态陷阱(isConstructor 按 .prototype 判别)
    crash-1.test.ts
  crash-2-teardown-race/        # 翻车二:异步清理撕裂共享资源
    teardown-race.ts            #   naive 同步 dispose 撕掉 v2 连接 vs cordis await dispose 串行换班
    crash-2.test.ts
  crash-3-stack/                # 翻车三:报错不知道找谁
    stack.ts                    #   naive 异常冒出+兄弟泄漏+无注册现场 vs cordis 隔离+长栈嫁接
    crash-3.test.ts
```

## 三场翻车 ↔ Cordis 机制 ↔ 源码对照

| # | 场景(同一时间线两侧对照) | naive 的死法 | Cordis 的活法 | 源码 |
|---|---|---|---|---|
| 一 | consumer 的 async apply 睡到一半,依赖的服务被 dispose,之后新提供者到位 | 迟到的 `ctx.on` 落进已清空的记录:窗口期 emit 命中 1 次(幽灵),重启后命中 2 次,越积越多 | 迟到注册撞 epoch 门→惰性空操作;consumer 轨迹 `LOADING→UNLOADING→PENDING`(装载在途被拆,从未 ACTIVE),新提供者到位自动重启,最终命中恰好 1 次 | `fiber.ts` effect 包装器 `if (!runner.epoch) return` |
| 二 | v1 的 disposer 是异步的(关连接 20ms),dispose 后立刻上 v2 | dispose 同步返回不等异步清理:v1 的迟到清理把 v2 刚拿到的连接池撕成 `released` | `await fiber.dispose()` 的 Promise 等所有 disposer(含异步)落地(实测 ≥18ms),换班严格串行,v2 完好 | `fiber.ts` finalizeDisposal/inFlight |
| 三 | 两个 effect,后注册的清理时抛错,远处触发卸载 | 异常冒泡中断循环:兄弟 disposer 永不执行(resourceB 泄漏);栈里只有抛错点与触发点,注册点无从查起 | 逐 disposer 隔离记 logger,兄弟照常清理;错误栈被嫁接注册时快照——**同时含抛错现场与注册现场**(函数名 `cordisMountBroken` 出现在栈里) | `utils.ts` composeError/buildOuterStack/handleError |

## 看点提示

- **naive 不是稻草人**:先跑通 demo 02 概念三的同步全场景(停靠/激活/级联重生/逆序清理),
  再翻车——付费点被精确定位在「异步 + 世界变化」,而不是"你写得烂"。
- **翻车一的轨迹本身就是论据**:consumer 从未到达 ACTIVE(`PENDING→LOADING
  LOADING→UNLOADING UNLOADING→PENDING`)——装载在途被拆,与 demo 02 锁定的
  「先 ACTIVE 再级联」轨迹互补,合起来才是完整状态机。
- **翻车三的长栈**:Cordis 在 `ctx.plugin()` 那一刻拍下调用方栈快照,清理出错时拼进
  错误栈(`handleError` 的 long stack trace)——"Spring 之痛:不知道这个监听器谁挂的"
  在这里是结构化记账。测试断言栈含注册函数名、naive 侧断言不含。
- **番外·形态陷阱(计划外发现)**:`isConstructor` 用 `.prototype` 判别类插件——
  普通函数声明有 prototype,返回的 Promise 会被当成"实例",apply 后半段彻底脱离
  生命周期(fiber 挂载即 ACTIVE);async 函数/箭头函数没有 prototype,返回值被等待。
  规则:插件主体用 async 或同步返回 disposer。探针 A/B 实测锁定。

## 刻意省了什么(留给后续 demo)

- naive 内核没有 isolate/intercept/extend(作用域代数)——那是 qa/02 附录 §5 的主题,
  翻车需要的是时间轴,不是空间轴
- Cordis 侧只观察不解释 `_execute` 的 generator/async-iterator effect 形态
- Loader/cordis.yml/HMR 插件(官方 cordis-tutorial/06,留待 guide/08 组合章)
