/**
 * 目标:第二课需要的工具(让 spilled greet 工具在第二课组合里也存在)——即第一课
 *       的 greet-tool 复用末尾的手动 execute 已删掉;否则会跟 lesson-2 驱动打架。
 * 思路:本文件只 register,不驱动。第一课与第二课的组合文件各自代表一课的世界。
 * 对照:guide/06 注册与执行分离。
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-registry'
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
      return `Hello, ${args.name}!(lesson-2)`
    },
  }))
}
