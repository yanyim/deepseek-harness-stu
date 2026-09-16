/**
 * 目标:dsh 能力插件的编程式组合——vitest 用。背景:loader 加载 cwd 下的 .ts 插件
 *       文件走 Node 原生 loader(vitest 的模块环境不认识裸 .ts),会静默失败;dsh 能力
 *       包本身是正常 ESM import,没有此问题。
 * 思路:new Context → ctx.plugin(SystemPromptEntry) → ctx.plugin(ToolRuntimeEntry)。
 *       这两行与 cordis.yml 两行 `- name: '@deepseek-ai/dsh-*'` 语义等价——yaml 只是
 *       「把 plugin 列表外置成数据」;依赖链由 inject 驱动,排序无关。
 * 对照:demos/04-first-dsh-plugin/cordis.yml(同一组合的文件形态)。
 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import SystemPromptEntry from '@deepseek-ai/dsh-system-prompt'
import ToolRuntimeEntry from '@deepseek-ai/dsh-tools'

/**
 * 挂载 dsh 能力插件与课程插件,返回已组装(未 await 稳定)的根上下文。
 * 与 cordis.yml 组合语义一致;测试里 await 关键 fiber 让依赖链落定。
 */
export function startInlineHarness(plugins: Plugin[] = []): Context {
  const ctx = new Context()
  ctx.plugin(SystemPromptEntry)
  ctx.plugin(ToolRuntimeEntry)
  for (const plugin of plugins) ctx.plugin(plugin)
  return ctx
}
