# Demo 08 · 教学版 waterfall:亲手造一条瀑布

回答的问题:「qa/04 附录二把瀑布机制讲透了——**那我自己写一个要几行?行为和真的
一样吗?**」

**答案一句话**:核心 3 行(`listener = queue.shift() ?? inner`),洋葱的全部实现
= 队列(谁先谁后)+ 闭包(next 即「余下的链」);六组实验的行为与真 cordis 包的
实测(附录二 E1-E4)逐条一致。cordis 的 12 行多出的是 args 打包、this 绑定、
多事件名复用——工艺本体一模一样。

对应 qa/04-附录二(瀑布机制细讲);上一课的动手版是 demos/06(llm/stream 在真
dsh 上的透传/短路)。

## 运行

```sh
pnpm demo:08     # 串场:命题→值瀑布四实验→流瀑布两实验→与真 cordis 对照
pnpm test        # 六用例锁定(洋葱双向/否决短路/异常穿透/prepend+注销/透传/短路)
pnpm typecheck
```

## 总图:同一个组合句型,两种载荷

```
值瀑布(next() 返回决定值)          流瀑布(next() 返回异步迭代器)
─────────────────────────          ─────────────────────────
run(value, inner)                  run(inner)
  next = () =>                       next = () =>
    listener = queue.shift()           listener = queue.shift()
      ?? inner            ←同一句→       ?? inner
    return listener(value, next)      return listener(next)

墙钟:外→内(注册序,prepend 插队头)
值/流:内→外(反序加工,最外层最后润色 = final say)
否决:不消费队列 → 更内层与内置全部不执行
异常:沿 Promise 链穿透给 run() 调用方(瀑布不做错误隔离)
```

## 组织:目录树 = 论证树

```
08-waterfall-mini/src/
  mini-waterfall.ts        标本:ValueWaterfall + StreamWaterfall(零依赖,
                           on/prepend/注销器/run 快照)
  mini-waterfall.test.ts   六用例锁定,断言与附录二真包实测同款
  main.ts                  串场(§1 命题→§2-§5 值瀑布四实验→§6-§7 流瀑布→§8 对照)
```

## 实验 ↔ dsh 真链路对照

| 本 demo | 真机制在哪 |
|---|---|
| 洋葱双向(§2) | qa/04 附录二 E1;dsh-agent 模型切换监听器(包裹式+prepend) |
| 否决短路(§3) | `agent/pre-step` 的 reject(step 不开,turn/end blocked) |
| 异常穿透(§4) | 附录二 E3:监听器抛错炸给司机;真监听器先查 signal.aborted 的防御 |
| prepend(§5) | dsh-agent 模型切换通知 `{prepend: true}` 抢最后润色权 |
| 流瀑布透传(§6) | `llm/stream` 统计监听器(demos/06);token 统计就长这样 |
| 流瀑布短路(§7) | demos/06 单元三:短路测试插件,连适配器都不用注册 |

## 刻意省了什么

- **scope 过滤**(每 agent 一条链,@deepseek-ai/dsh-scope)——依赖 isolate,等
  多 Agent 实战时再补;
- **fiber effect 注册**(cordis 的 on 是 effect,插件卸载自动摘除)——教学版 on
  只返回注销器;
- **emit/serial/bail 兄弟模式**——附录二 §1 有源码对照,本 demo 只造 waterfall;
- dispatch 的快照细节差异(教学版每轮 run 拍快照并锁定为行为)。
