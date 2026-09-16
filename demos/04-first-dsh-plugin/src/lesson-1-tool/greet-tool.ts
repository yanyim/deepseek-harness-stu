/**
 * 目标:第一课视角一「能力插件」——向真实 dsh 工具流水线注册一个 greet 工具,
 *       然后站在模型的立场手动 execute 一次(代表模型发来的调用)。
 * 思路:三层注册,全部是 effect:defineTool 规约 → ctx.tools.register(注销 disposer
 *       自动附着);execute 由调用方显式触发;最后 emit tools/execute 前接上下文是无声的。
 * 对照:官方文档 cordis-tutorial/07 greet-tool.ts 原版;guide/06 工具流水线。
 */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet the named person.',
    parameters: {
      name: { type: 'string', required: true, description: 'Who to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  }))

  // 站在模型立场手动发起一次调用(真实产品里由模型 provider 产生)
  void (async () => {
    const result = await ctx.tools.execute({
      callId: brandString<ToolCallId>('lesson-1'),
      name: 'greet',
      arguments: { name: 'Cordis' },
      signal: new AbortController().signal,
    })
    console.log('[greet-tool] tool replied:', JSON.stringify(result.content))
  })()
}
