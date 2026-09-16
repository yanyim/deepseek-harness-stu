/**
 * 【死法二】行为锁定:三个解法各自挡住了什么
 * 解法④ 内核无领域知识(stage/kernel.ts,行为锁定在 stage.test.ts)
 * 解法⑤ 渐进式契约 / 解法⑥ 拦截走事件
 */

import { describe, it, expect } from 'vitest'

import { BaseAdapter } from '../stage/llm-seam.ts'
import { MinimalAdapter } from './progressive-contract.ts'
import { tapObserve, tapRewrite, tapVeto } from './interception-by-event.ts'
import { ask, drain, bootstrap } from '../stage/testing.ts'

describe('解法⑤ 渐进式契约:厚是可选菜单,不是门槛', () => {
  it('只实现 stream() 即可工作,可选能力吃默认值', async () => {
    const { ctx, llm } = bootstrap()
    const minimal = new MinimalAdapter()
    expect(minimal.listModels()).toEqual([]) // 默认「不知道」
    expect(minimal.resolveModel('p', 'm').name).toBe('m') // 默认原样返回
    ctx.plugin('llm-min', () => llm.registerAdapter('min', minimal))
    expect(await drain(llm, ask('m', 'min'))).toBe('ok:m')
  })

  it('未实现 stream() 的适配器在调用时明确报错', async () => {
    const { ctx, llm } = bootstrap()
    ctx.plugin('llm-broken', () => llm.registerAdapter('broken', new BaseAdapter()))
    const attempt = (async () => {
      for await (const _ of llm.stream(ask('m', 'broken'))) void _ // eslint-disable-line @typescript-eslint/no-unused-vars
    })()
    await expect(attempt).rejects.toThrow(/必须实现 stream/)
  })

  it('未注册的 provider 明确报错', async () => {
    const { llm } = bootstrap()
    const attempt = (async () => {
      for await (const _ of llm.stream(ask('m', 'nobody'))) void _ // eslint-disable-line @typescript-eslint/no-unused-vars
    })()
    await expect(attempt).rejects.toThrow(/未注册的 provider/)
  })
})

describe('解法⑥ 拦截走事件,不走协议参数', () => {
  it('观察者放行并记录,审计看到的是改写前的模型', async () => {
    const { ctx, llm } = bootstrap()
    const audit: string[] = []
    ctx.plugin('taps', (ctx) => {
      ctx.plugin('audit', tapObserve(audit)) // 先注册在外层
      ctx.plugin('router', tapRewrite('m1', 'm2'))
    })
    const text = await drain(llm, ask('m1'))
    expect(audit).toEqual(['mock/m1']) // 外层观察者先看到原始 payload
    expect(text).toContain('m2') // 适配器收到的是改写后的 payload
  })

  it('否决:守卫 throw,调用方收到异常;放行模型不受影响', async () => {
    const { ctx, llm } = bootstrap()
    ctx.plugin('guard', tapVeto('forbidden-model'))
    const attempt = (async () => {
      for await (const _ of llm.stream(ask('forbidden-model'))) void _ // eslint-disable-line @typescript-eslint/no-unused-vars
    })()
    await expect(attempt).rejects.toThrow(/GUARD.*forbidden-model/)
    await expect(drain(llm, ask('ok-model'))).resolves.toContain('ok-model')
  })

  it('卸载拦截插件后协议行为复原', async () => {
    const { ctx, llm } = bootstrap()
    const unload = ctx.plugin('router', tapRewrite('m1', 'm2'))
    expect(await drain(llm, ask('m1'))).toContain('m2')
    unload()
    expect(await drain(llm, ask('m1'))).toContain('m1')
  })
})
