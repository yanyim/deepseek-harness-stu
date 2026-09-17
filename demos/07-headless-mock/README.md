# Demo 07 · 无 API Key 跑通真实 Agent 全链路(教程 Demo 5 的重写)

回答的问题:「到 demos/06 为止都在真空里验证接缝——**真实的 dsh 进程**(boot、
turn/step 状态机、系统提示词装配、会话持久化)能不能不碰网络、不花一分钱跑起来?」

**答案一句话**:能。`--patch` 覆盖层只改两行配置(insert 一个本地插件 + 把
`agent-default-model` 路由定向替换到 mock),整条真实链路原样运转——**只有模型
是假的**。这是本套学习的分水岭:demos/06 证明了「提供方是插件」,本 demo 证明
「换掉提供方不需要动框架的任何一行」。

对应教程 [Demo 5](笔记库 `dsh-harness-tutorial/demos/demo-05-headless-mock.md`,
基于 0.1.0-rc.6)与原理篇 guide/03/05/07。

## 运行

```sh
pnpm demo:07     # 串场:dump-config 静态看组合树 → 真实跑一次任务 → 审计会话日志
pnpm test        # 含 2 个真实 e2e(spawn 真 dsh 子进程,零网络)
pnpm typecheck
```

手动跑 CLI(与 demo:07 等价的裸命令,任意 cwd 均可):

```sh
DSH_HOME="$PWD/demos/07-headless-mock/.dsh-home" \
  node node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile headless --patch demos/07-headless-mock/mock.patch.yml "你好,介绍一下你自己"
```

## 总图:patch 覆盖层在组合树的哪里

```
空 entry list
  └─ 叠加 dsh-base      (~90 个插件:llm/session/agent/工具/…)
  └─ 叠加 dsh-headless  (headless-runner:读任务→跑 turn→stdout→exit)
  └─ 叠加 mock.patch.yml(本 demo,只有两件事):
       ├─ insert: mock-adapter → plugins/mock-adapter.ts
       │    └─ apply: ctx.llm.registerAdapter(['mock'], new MockAdapter())
       └─ id: agent-default-model
            config: { provider: mock, model: mock-1 }   ← 整行替换,无深合并
```

headless-runner 创建 Agent 时拿到 `provider: mock`,agent-loop 的每次模型调用
(连标题生成都算)全部路由到我们的假模型。

## 组织:目录树 = 论证树

```
07-headless-mock/
  mock.patch.yml                # 组合数据:覆盖层的全部内容(两件事)
  plugins/
    mock-adapter.ts             # 插件形态的 Mock 适配器(name/inject/apply;
                                #   注册写在 apply 里=effect,卸载自动撤销)
  src/
    run-headless.ts             # 公共地基:spawn 真 dsh CLI(demo 与测试共用)
    read-session.ts             # 公共地基:读 session.v3.jsonl.zstd(多帧 zstd→JSONL)
    headless.test.ts            # e2e 全链路 / NO_ADAPTER 失败路径 / dump-config 静态检查
    main.ts                     # 串场:静态→动态→审计
```

## 会话日志:模型可见即已记录

`pnpm demo:07` 的 §4 打印完整日志。三个观察点:

1. **你的任务只是第 1 条 user/message**——workspace 指令、runtime 快照、skills
   提醒都以 user-role 注入排在后面。模型看到的一切,日志里全有、可审计。
2. **`request/header` 落盘了路由**——`{provider: mock, model: mock-1}`,「配置即
   行为」的证据。
3. **`session/title-llm-request` 也路由到 mock**——辅助调用走同一条接缝;我们的
   假模型把标题系统的 prompt 当「第一条 user 消息」回了回去,于是会话标题变成了
   回复的开头几十个字(行为有趣,也是接缝统一的活证据)。

## 版本差实录(0.1.0-rc.6 教程 → 本仓库 0.1.6-alpha.1)

1. **patch 插件相对路径的解析基准变了**:教程写 `../../../plugins/...` 三级回跳,
   声称基准是 profile 目录;0.1.6 实测基准是 **patch 文件所在目录**
   (dsh-app-boot `boot()` 以 `dirname(configPath)` 设 baseUrl)。本 demo 用
   `./plugins/mock-adapter.ts`,任意 cwd 可跑。跨目录复用插件写 `file://` 绝对 URL。
   ——这是 demos/05「import 的第二个输入」的续集:同一 Node 规则,换了调用者。
2. **持久化格式 v3**:文件名 `session.v3.jsonl.zstd`;**不再逐 chunk 落盘**(教程
   时代 1.1 万行 `assistant/chunk` 收敛为一条组装好的 `assistant/message`,载荷在
   `data.message.content`)。
3. **默认模型条目**:`agent-default-model` id 未变,默认路由值从
   `deepseek-v4-flash` 变为 `deepseek-flash`。
4. CLI 旗标(`--profile headless` / `--patch` / `--dump-config`)全部未变。

## 刻意省了什么

- **工具调用闭环**:教程参考代码的 mock-adapter 自带 echo 工具分支,那是教程
  Demo 6 的料——届时适配器要吐 `tool-call` 块、`finish {kind:'tool-calls'}`,观察
  两段式 step。本 demo 的适配器只做对话。
- **`--dump-default-config` / profile 定制 / `dsh plugin` 命令**:设置体系周边,
  等学到再回来看。
- **回放**:v3 格式不再存逐 chunk 数据,回放体系(demos/06 提到的 replayState)
  留到相应章节。
