# Demo 01 · 插件协议的厚薄困境——五种容器

回答的问题(出自笔记库 `qa/01-插件协议的厚薄困境.md`):插件架构引入内部协议后,
协议太薄 → 加透传参数污染;太厚 → 臃肿失控。dsh 怎么解?

**答案一句话**:不是把协议设计得恰到好处,而是让每种变化都有自己的容器——
没有一个容器需要恰到好处。

## 运行

```sh
pnpm demo:01      # 串场:病理 → 死法一三解法 → 死法二三解法 → 结论
pnpm test         # 行为锁定测试(按单元分布)
pnpm typecheck    # tsc:类型断言(@ts-expect-error)也是测试的一部分
```

## 组织:目录树 = 论证树

```
src/
  main.ts                       # 串场,叙事顺序 = 论证顺序
  stage/                        # 舞台:全部论证共用的地基
    kernel.ts                   #   迷你内核(它本身是解法④的展品)
    llm-seam.ts                 #   实验对象:LLM 中立协议本体(词汇表/请求形状/调用面)
    render.ts                   #   渲染 seam:词汇表的运行时半
    mock-adapter.ts             #   跑通链路的最小适配器
    testing.ts / stage.test.ts  #   测试脚手架 + 内核行为锁定
  death-1-too-thin/             # 死法一:太薄 → 被迫透传(见目录内 README)
    anti-pattern.ts             #   病理切片:providerExtra
    typed-escape-hatch.ts       #   解法① 有类型的逃生口(merge-map)
    vendor-seam.ts              #   解法② 厂商特例独立 seam(三角色合体)
    opaque-token.ts             #   解法③ 不透明令牌防腐
    death-1.test.ts
  death-2-too-thick/            # 死法二:太厚 → 臃肿失控(见目录内 README)
    progressive-contract.ts     #   解法⑤ 渐进式契约(唯一必实现)
    interception-by-event.ts    #   解法⑥ 拦截走事件(waterfall 三姿态)
    death-2.test.ts             #   (解法④的展品就是 stage/kernel.ts)
```

每个源文件头部固定三段:**目标**(解决什么)→ **思路**(用什么机制)→ **对照**(dsh 哪个包)。

## 六个解法 ↔ dsh 源码 ↔ 笔记 qa/01

| # | 解法 | 本 demo | dsh 源码 | 笔记 |
|---|---|---|---|---|
| ① | 有类型的逃生口(闭结构开词汇) | `death-1/typed-escape-hatch.ts` | `ContentBlockMap` / `FinishReasonMap` / `SessionEventMap` | §3 |
| ② | 厂商特例独立 seam | `death-1/vendor-seam.ts` | `deepseek-llm-api-extensions` | §5 |
| ③ | 不透明令牌防腐 | `death-1/opaque-token.ts` | `fs` 的 `FsTargetKey` / `FsVersion` | §7① |
| ④ | 内核无领域知识、协议分片 | `stage/kernel.ts` | Cordis 内核(5 概念,零 Agent 知识) | §2 |
| ⑤ | 渐进式契约 | `death-2/progressive-contract.ts` | `LlmAdapter`:1092 行协议 1 个抽象方法 | §4 |
| ⑥ | 拦截走事件 | `death-2/interception-by-event.ts` | `agent/pre-step`、`llm/stream`、`tools/*` 瀑布 | §6 |

## 看点提示

- **词汇的两半**:math 块在插件不在 → `〔未渲染的块:math〕`;插件在 → `$e = mc^2$`;再卸载 → 又兜底。
  类型半(declare module)让编译器认识新词汇,运行时半(渲染器注册)让系统会处理它,两半都是插件副作用。
- **厂商字段的存亡**:`log-tagging` 插件装卸 ⇒ deepseek wire 上 `log_id` 出现/消失,
  `GenerateOptions` 形状全程不变 —— 对比 `anti-pattern.ts` 的 `providerExtra` 死法。
- **拦截的三个姿态**:观察(审计看到改写前的模型)/ 改写(路由切换)/ 否决(GUARD throw)。

## 迷你内核刻意省了什么(留给后续 demo)

- `inject` 依赖声明与服务就绪等待(guide/02:Cordis 五概念)
- `isolate` 作用域 / agent 级局部注册(guide/08:组合机制)
- fiber 调度与并发模型
- 配置层(profile / bundle / patch)
