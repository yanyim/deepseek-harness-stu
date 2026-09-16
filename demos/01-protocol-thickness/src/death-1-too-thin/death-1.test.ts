/**
 * 【死法一】行为锁定:三个解法各自挡住了什么
 * 解法① 有类型的逃生口 / 解法② 厂商独立 seam / 解法③ 不透明令牌
 */

import { describe, it, expect } from 'vitest'

// 副作用 import:类型词汇表扩展(declaration merge)
import './typed-escape-hatch.ts'

import { Context } from '../stage/kernel.ts'
import { LlmRuntime } from '../stage/llm-seam.ts'
import type { ContentBlock } from '../stage/llm-seam.ts'
import { RenderRuntime } from '../stage/render.ts'
import { VendorApiExtensions, DeepseekMockAdapter, loadLogTagging } from './vendor-seam.ts'
import { localBackend, previewFile, remoteBackend } from './opaque-token.ts'
import { loadMathBlocks } from './typed-escape-hatch.ts'
import { ask, drain } from '../stage/testing.ts'

Context.logging = false

describe('解法① 有类型的逃生口(闭结构、开词汇)', () => {
  function bootstrap() {
    const ctx = new Context()
    ctx.plugin('core', (ctx) => {
      ctx.provide(RenderRuntime.key, (ctx) => new RenderRuntime(ctx))
      const render = ctx.use<RenderRuntime>(RenderRuntime.key)
      render.register('text', (b: { text: string }) => b.text)
      render.register('reasoning', (b: { text: string }) => `〔思考〕${b.text}`)
    })
    return { ctx, render: ctx.use<RenderRuntime>(RenderRuntime.key) }
  }

  it('math 块的渲染随插件装卸出现与消失', () => {
    const { ctx, render } = bootstrap()
    const math: ContentBlock = { type: 'math', latex: 'e=mc^2' }
    expect(render.render(math)).toMatch(/未渲染的块:math/) // 词汇在,渲染器不在 → 兜底

    const unload = ctx.plugin('math-blocks', loadMathBlocks)
    expect(render.render(math)).toBe('$e=mc^2$') // 类型词汇 + 运行时渲染器同时在场

    unload()
    expect(render.render(math)).toMatch(/未渲染的块:math/) // 渲染器是 effect,卸载即撤销
  })

  it('类型层:未知词汇被拒绝,新词汇随插件进入', () => {
    // math 插件在本文件顶部 import,词汇表已扩展 —— 这行类型合法:
    const math: ContentBlock = { type: 'math', latex: 'a^2+b^2=c^2' }
    expect(math.type).toBe('math')

    // @ts-expect-error —— 'hologram' 不在词汇表:类型层拒绝,与运行时兜底互为表里
    const bad: ContentBlock = { type: 'hologram', data: 1 }
    expect(bad.type).toBe('hologram')
  })
})

describe('解法② 厂商特例独立 seam(中立协议零负载)', () => {
  async function wireAfter(withLogPlugin: boolean) {
    const ctx = new Context()
    ctx.plugin('core', (ctx) => {
      ctx.provide(LlmRuntime.key, (ctx) => new LlmRuntime(ctx))
      ctx.provide(VendorApiExtensions.key, (ctx) => new VendorApiExtensions(ctx))
    })
    if (withLogPlugin) ctx.plugin('log-tagging', loadLogTagging)
    let adapter!: DeepseekMockAdapter
    ctx.plugin('llm-deepseek', (ctx) => {
      adapter = new DeepseekMockAdapter(ctx)
      ctx.use<LlmRuntime>(LlmRuntime.key).registerAdapter('deepseek', adapter)
    })
    await drain(ctx.use<LlmRuntime>(LlmRuntime.key), ask('deepseek-chat', 'deepseek'))
    return adapter.lastWire
  }

  it('扩展插件在场:厂商 wire 拿到 log_id', async () => {
    const wire = await wireAfter(true)
    expect(wire).toMatchObject({ model: 'deepseek-chat', log_id: 'sess-deepseek-deepseek-chat' })
  })

  it('扩展插件缺席:wire 没有厂商字段,GenerateOptions 形状从未改变', async () => {
    const wire = await wireAfter(false)
    expect(wire).toEqual({ model: 'deepseek-chat' }) // 只有中立字段
    expect(Object.keys(wire!)).toEqual(['model']) // 协议上没有残留的逃生口
  })
})

describe('解法③ 不透明令牌(防腐)', () => {
  it('同一个消费函数,两个后端,key 形状是后端私有的', () => {
    const lb = localBackend('/repo')
    const rb = remoteBackend('https://e2b.dev/w1')
    // 消费方 previewFile 对两种后端一视同仁,拿到的是各自的内容:
    expect(previewFile(lb, 'README.md')).toContain('本地文件')
    expect(previewFile(rb, 'README.md')).toContain('远程对象')
    // key 形状互不相干:后端 A 放 realpath,后端 B 放 URI ——
    // 消费方拿到的类型只是 FsTargetKey,不解析就不依赖任何一种形状:
    expect(String(lb.resolve('x'))).toContain('/repo/')
    expect(String(rb.resolve('x'))).toMatch(/e2b\.dev\/w1#file-\d+/)
  })
})
