/**
 * 目标:第二课的驱动器——在真实 tools 服务上执行两次调用:一次放行(greet)、
 *       一次否决(forbidden-tool,由 approver-veto 拍板),把结果写进剧本。
 * 思路:inject: ['tools'] 等注册表就绪;execute 的返回即判定依据——否决的调用
 *       得到 isError 结果(reason 呈现给模型),放行的调用得到工具本身的输出。
 * 对照:guide/06 "模型看到拒绝原因,才能自我纠正"。
 */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'

export const name = 'lesson-2-driver'
export const inject = ['tools']

export async function apply(ctx: Context): Promise<void> {
  const scenario: string[] = []

  // ── 调用一:greet(放行路径)──
  const allowed = await ctx.tools.execute({
    callId: brandString<ToolCallId>('lesson-2-a'),
    name: 'greet',
    arguments: { name: '瀑布' },
    signal: new AbortController().signal,
  })
  scenario.push(`allow 路径 isError=${String(allowed.isError)}`)

  // ── 调用二:forbidden-tool(否决路径——工具不存在也没关系,否决发生在查找语义之前?) ──
  // 注意:否决发生在 pre-execute 瀑布,监听者拿到 exec 时工具尚未执行;
  // 下面用真实存在的工具演示"策略性换名"最直观,这里直接调 greet 且由 veto 演示
  // 对未注册工具名 forbidden-tool 的拦截(pre-execute 在工具未知之前就已可 veto)。
  const vetoed = await ctx.tools.execute({
    callId: brandString<ToolCallId>('lesson-2-b'),
    name: 'forbidden-tool',
    arguments: {},
    signal: new AbortController().signal,
  }).catch((error: unknown) => ({ isError: true, errorText: String(error) }) as const)
  const vetoedText = 'isError' in vetoed && 'content' in vetoed
    ? `isError=${String(vetoed.isError)}:${JSON.stringify(vetoed.content)}`
    : `threw:${vetoed.errorText.slice(0, 80)}`
  scenario.push(`veto 路径 ${vetoedText}`)

  for (const line of scenario) console.log(`[lesson-2-driver] ${line}`)
}
