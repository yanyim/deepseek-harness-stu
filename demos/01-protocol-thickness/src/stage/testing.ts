/**
 * 【舞台】测试脚手架:干净世界 + 常用请求/收集工具
 *
 * 各单元测试(death-1 / death-2 / stage)共用:内核服务就位、核心渲染器注册。
 */

import { Context } from './kernel.ts'
import { LlmRuntime } from './llm-seam.ts'
import type { GenerateOptions } from './llm-seam.ts'
import { RenderRuntime } from './render.ts'
import { MockAdapter } from './mock-adapter.ts'

export function bootstrap() {
  const ctx = new Context()
  ctx.plugin('core', (ctx) => {
    ctx.provide(LlmRuntime.key, (ctx) => new LlmRuntime(ctx))
    ctx.provide(RenderRuntime.key, (ctx) => new RenderRuntime(ctx))
    const render = ctx.use<RenderRuntime>(RenderRuntime.key)
    render.register('text', (b: { text: string }) => b.text)
    render.register('reasoning', (b: { text: string }) => `〔思考〕${b.text}`)
    render.register('tool-call', (b: { name: string; arguments: string }) => `〔调用〕${b.name}(${b.arguments})`)
    ctx.use<LlmRuntime>(LlmRuntime.key).registerAdapter('mock', new MockAdapter())
  })
  return {
    ctx,
    llm: ctx.use<LlmRuntime>(LlmRuntime.key),
    render: ctx.use<RenderRuntime>(RenderRuntime.key),
  }
}

export const ask = (model: string, provider = 'mock'): GenerateOptions => ({
  provider,
  model,
  messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }],
})

export async function drain(llm: LlmRuntime, options: GenerateOptions): Promise<string> {
  let text = ''
  for await (const chunk of llm.stream(options)) {
    if (chunk.type === 'text-delta') text += chunk.text
  }
  return text
}
