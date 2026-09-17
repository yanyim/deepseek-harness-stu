# Demo 06 · 注册一个 Mock LLM 适配器(教程 Demo 4 的重写)

回答的问题:「不碰网络、不花一分钱,能不能**自己当一个模型提供方**——把收到的输入
加工后流式回复,让消费方完全无法分辨真假?」

**答案一句话**:能,而且只要一个 `LlmAdapter` 子类(`stream()` 是唯一必须实现的
方法)+ 一行 `ctx.llm.registerAdapter(['mock'], adapter)`。「模型提供方也是一个
插件」不是口号,是本 demo 十几个断言锁死的事实。

对应教程 [Demo 4](笔记库 `dsh-harness-tutorial/demos/demo-04-llm-mock.md`,基于
0.1.0-rc.6)与原理篇 [guide/04 LLM 接缝](笔记库 `dsh-harness-tutorial/guide/04-llm-seam.md`)。

## 运行

```sh
pnpm demo:06     # 串场:挂接缝→假提供方上线→完整通话→取消→瀑布→换路由→下线
pnpm test        # 三个单元 14 个用例锁定行为
pnpm typecheck
```

## 总图:一次通话经过的每个人都只认统一词汇表

```
   消费方(main / agent-loop / 测试)          ← 只认 Message / StreamChunk
        │  ctx.llm.stream(request)
        ▼
   llm/stream 瀑布(§4.5)                    ← token 统计/短路测试挂这里
        │  next()
        ▼
   LlmRuntime 注册表(§4.4)                  ← 路由 'mock' → 适配器实例
        │
        ▼
   EchoAdapter(本 demo 亲手写的"假模型")     ← 把输入加工后吐 chunk
        │  block-start/delta/block-end/usage/finish
        ▼
   BlockAssembler(权威组装算法)             ← 按 index 归位,违规 chunk 不参与组装
```

真实世界里最底下那层换成 DeepSeek/OpenAI 适配器,上面所有人**一个字都不用改**。

## 组织:目录树 = 论证树

```
06-llm-mock/src/
  stage/                          # 公共地基:裸 Context 挂 LlmRuntime + 手搓请求
    harness.ts                    #   mountLlm():ctx.llm 从无到有的那一步
    request.ts                    #   createUserMessage 官方工厂,零手搓零 cast
  echo-adapter/                   # 单元一:Mock 适配器本体(「直接把输入加工后回复」)
    echo-adapter.ts               #   双块交织(reasoning+text)+ 派生 usage + 取消路径
    echo-adapter.test.ts          #   锁定:序列形状 / 组装无损 / 取消→finish aborted
  registry/                       # 单元二:注册表的规矩
    duck-adapter.ts               #   鸭子标本:不继承 LlmAdapter 的独立类(qa/03)
    subclass-probe.ts             #   追问标本:继承 DeepSeekAdapter + override stream
                                 #   = 死代码(dispatch 不过 this.stream)
    registry.test.ts              #   锁定:DUPLICATE_ADAPTER / all-or-nothing /
                                 #   disposer / replace(0.1.6 新货)/ 注册是 effect /
                                 #   鸭子实验(裸对象注册即拒;独立类全链路跑通)/
                                 #   子类 override 旁路
  protocol-edge/                  # 单元三:协议义务的边界(教程实验 1/3 的作恶版)
    protocol-edge.test.ts         #   锁定:迟到 usage 被无视 / 抛异常→terminal chunk /
                                 #   带内 error 透传 / 瀑布透传与短路
  main.ts                         # 串场入口(叙事顺序=论证顺序,§1–§9)
```

## 关联问答

- **[qa/03 · registerAdapter 怎么知道你是适配器?注册表的规矩为谁而生?](笔记库
  `dsh-harness-tutorial/qa/03-注册表怎么识别适配器与四条规矩.md`)**——名字是路由键
  不是身份证明;识别靠「编译层结构类型 + 注册层行为摸底 + 调用层协议验证」三层,
  全程无 `instanceof`;注册表四条规矩各为一条不变量服务。实验就在本 demo 的
  `registry/duck-adapter.ts` 与 main §4。

## 协议义务(guide/04 §4.3)↔ 本 demo 的执法点

| 义务 | 在哪锁定 |
|---|---|
| ① usage 先于 finish,之后不发任何东西 | `echo-adapter.test.ts` 序列形状;`protocol-edge` 实测:迟到 usage 组装器**照收**(版本差,见下)——义务①的执法在适配器契约层 |
| ② index 按首次出现分配,交织增量靠 index 归位 | EchoAdapter **双块交织**;组装测试断言两块全文无损 |
| ③ 失败只有两条路径:抛异常 / 带内 finish | `protocol-edge`:抛异常被 runtime 包成 terminal chunk;带内 error 原样透传 |
| ④ 遵守 options.signal | 取消测试:abort → `finish {kind:'aborted', code:'ABORTED'}` |
| ⑤ replayState 可回放基石 | 刻意不做(见下),等教程可回放章节 |

组装器真正硬执法的是「已完成块的不可篡改」:block-end 之后的迟到增量被无视、
重复关块首关胜出(`protocol-edge` 的 straggler 测试)——「违规者得不到正确结果」。

## 版本差实录(0.1.0-rc.6 教程 → 本仓库 0.1.6-alpha.1)

教程参考代码在本仓库依赖上**一次跑通**,但有三处漂移,全部如实记录:

1. **Message 契约收紧**:教程手搓 `{role, content}` 就够;0.1.6 要求
   `id + content: ContentBlock[] + source` 三件套,且官方提供 `createUserMessage`
   工厂(生成身份并冻结)。→ `stage/request.ts` 用工厂,零手搓。
2. **`providerInfo()` 缺省名变了**:教程预期 `mock(MockAdapter)`(类名);0.1.6 实际
   `mock(mock)`(回显路由 id)。
3. **`registerAdapter` 返回值升级**:不只是 disposer,还带 `.replace(providers)`
   原子换路由(设置页切模型服务的底座);对已注销注册 replace 抛
   `REGISTRATION_DISPOSED`。教程没有这玩意,本 demo 把它收编成测试。
4. **教程实验 1 的结论已过时**:0.1.0-rc.6 说「finish 之后到达的 usage 会被
   BlockAssembler 忽略」;0.1.6 实测照收(last-wins)。组装器真正无视的是
   block-end 之后的迟到增量与重复关块。测试锁定的是**实测行为**,教程只当参考。

## 刻意省了什么

- **tool-call-delta 流**(模型主动要求调工具):教程 Demo 6 的料,那时适配器要吐
  `tool-call` 块并 `finish {kind:'tool-calls'}`。
- **真实 SSE 翻译**:dsh 源码 `packages/llm` 下的 deepseek/pi-ai 适配器才是完全体;
  本 demo 的"传输层"是 `setTimeout`。
- **prepareCall / 模型发现 / 可配置提供方目录**(0.1.6 新增的一整套):设置页的
  数据来源,等学到设置体系再回来看。
- **replayState**(义务⑤):可回放体系,等教程相应章节。
