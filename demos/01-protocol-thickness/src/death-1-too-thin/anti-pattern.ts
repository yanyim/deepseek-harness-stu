/**
 * 【死法一 · 病理切片】『上帝协议』是怎么死的
 *
 * 目标:看清「太薄 → 加透传参数」的完整病理,后面三个解法都以它为对照组。
 * 思路:时间线推演 ——
 *   第 1 天:接 OpenAI,接口 3 个字段,干净。
 *   第 8 天:DeepSeek 要往请求体塞顶层字段 → 加 providerExtra?: Record<string, unknown>。
 *   第 15 天:每家都往 providerExtra 塞私货;类型系统全体失明;
 *            下游被迫 as 赌运气;换掉一个厂商,字段还阴魂不散地留在协议形状里。
 * 对照:无(dsh 全仓没有 providerExtra 这种逃生口;反例见 dsh 的 ctx.lsp 文档
 *       明说「不提供协议逃生口,后端必须转换为标准化请求和结果」)。
 */

export interface GodGenerateOptions {
  provider: string
  model: string
  /** 一切塞不进协议的东西都从这里过 —— 无类型逃生口 */
  providerExtra?: Record<string, unknown>
}

export function demonstrateAntiPattern(): void {
  const options: GodGenerateOptions = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    providerExtra: {
      log_id: 'req-001',
      beta_header: true,
      reasoning_beta: { effort: 3 },
    },
  }

  // 下游消费方:拿到的是 unknown,只能 cast —— 从这里开始,每个 as 都是一颗雷
  const logId = options.providerExtra?.['log_id'] as string | undefined
  const effort = (options.providerExtra?.['reasoning_beta'] as
    | { effort?: number }
    | undefined)?.effort

  console.log(`  providerExtra.log_id               = ${logId}`)
  console.log(`  providerExtra.reasoning_beta.effort = ${effort}`)
  console.log('  ↓ 类型层看不见任何字段;拼错了编译器不吭声,换厂商了字段还挂在协议上')
}
