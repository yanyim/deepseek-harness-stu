/**
 * 【死法二 · 解法⑥】拦截走事件,不走协议参数
 *
 * 目标:「审计这次请求 / 切换路由 / 拒绝危险模型」这类需求,不许变成协议上的新参数 ——
 *       给协议加参数 = 改协议 = 全体实现方跟着动;加一个监听器 = 局部行为 = 协议所有者无感。
 * 思路:waterfall 中间件链(LlmRuntime.stream 先过 'llm/stream' 事件再落适配器),
 *       三种姿态:观察(原样放行)/ 改写(换 payload 继续传递)/ 否决(throw)。
 *       监听器注册顺序 = 链顺序:先注册者在外层,先看到原始 payload。
 * 对照:dsh 的 agent/pre-step(可拒绝或改写输入)、agent/request、llm/stream、
 *       tools/pre-execute / execute / post-execute —— 全部是瀑布事件。
 */

import type { Context } from '../stage/kernel.ts'
import type { GenerateOptions } from '../stage/llm-seam.ts'

/** 观察:审计、遥测、日志 —— 只记录,不碰 payload */
export function tapObserve(log: string[]) {
  return (ctx: Context): void => {
    ctx.on<GenerateOptions>('llm/stream', async (options, next) => {
      log.push(`${options.provider}/${options.model}`)
      return next(options)
    })
  }
}

/** 改写:路由切换、注入前缀 —— 换一个 payload 继续往里传 */
export function tapRewrite(from: string, to: string) {
  return (ctx: Context): void => {
    ctx.on<GenerateOptions>('llm/stream', async (options, next) => {
      if (options.model === from) {
        return next({ ...options, model: to })
      }
      return next(options)
    })
  }
}

/** 否决:策略守卫 —— 直接 throw,调用方收到异常(dsh:reject | enter 二选一) */
export function tapVeto(denied: string) {
  return (ctx: Context): void => {
    ctx.on<GenerateOptions>('llm/stream', async (options, next) => {
      if (options.model === denied) {
        throw new Error(`GUARD: 模型 ${denied} 被策略拒绝`)
      }
      // 放行必须显式交给下一层:不调用 next 就此截断 —— 是 waterfall 的语义而非事故
      return next(options)
    })
  }
}
