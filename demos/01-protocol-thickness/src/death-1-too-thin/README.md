# 死法一:协议太薄 → 被迫加透传参数

**目标**:中立协议要接得住新需求,但既不准改核心包、也不准开无类型的洞。

**病理**(`anti-pattern.ts`):需求来了 → 加 `providerExtra?: Record<string, unknown>`
→ 类型系统失明 → 下游 `as` 赌运气 → 换掉厂商,字段还焊在协议形状上。

**三个思路,按「污染从哪来」分**:

| 文件 | 思路 | 挡住什么 | 对照 dsh |
|---|---|---|---|
| `typed-escape-hatch.ts` | 闭结构、开词汇(merge-map) | 词汇演化:新内容块要进协议 | `ContentBlockMap` 等 5+ 张表,全仓 25+ 处跨包声明合并 |
| `vendor-seam.ts` | 厂商特例住独立 seam | 厂商差异:顶层字段要进请求 | `deepseek-llm-api-extensions`(提供方 session-log-deepseek,消费方 llm-deepseek) |
| `opaque-token.ts` | 不透明令牌(Brand) | 实现细节:消费方开始解析协议内部 | `fs` 的 `FsTargetKey` / `FsVersion`("MUST NOT parse") |

**行为锁定**:`death-1.test.ts` —— 词汇随插件装卸出现/消失、`@ts-expect-error` 拒绝未知词汇、
wire 上厂商字段随扩展插件存亡、同一消费函数跑两种后端。
