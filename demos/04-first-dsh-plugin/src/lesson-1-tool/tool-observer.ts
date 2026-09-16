/**
 * 目标:第一课视角二「观察者插件」——订阅 tools/result 事件,把每次工具调用记进
 *       数组(测试断言用)并打印(演示用)。与 greet-tool 零 import 关系,纯靠事件连接。
 * 思路:观察者声明 inject: ['tools'] 是为了类型(declaration merge)与生命周期对齐——
 *       它不调用 tools 的任何方法,只是见证。
 * 对照:官方 cordis-tutorial/07 tool-logger.ts;guide/07 会话日志的"事实源"思想。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'tool-observer'
export const inject = ['tools']

/** 测试与 demo 共读的观察记录(agent 外部注入后由本插件填充)。 */
export const observations: string[] = []

export function apply(ctx: Context) {
  ctx.on('tools/result', (exec, result) => {
    const text = result.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    observations.push(`${exec.name} -> ${text}`)
    console.log(`[tool-observer] ${exec.name} -> ${text}`)
  })
}
