/**
 * 目标:锁定单元二「注册表的规矩」——一个路由一个适配器、多路由 all-or-nothing、
 *       disposer/replace 的生命周期,以及「注册是 effect」的插件形态。
 * 思路:每条测试挂一个全新的裸 LlmRuntime(withLlm 兜底 dispose),对注册表的
 *       断言全部走 listProviders() 这个只读视图;错误断言认 LlmError.code 这个
 *       稳定路由码,永不解析 message 文案(HarnessError 文档的原话要求)。
 * 对照:guide/04 §4.4 注册表的规矩;dsh 源码 packages/llm/llm 的 LlmRuntime
 *       (registerAdapter/prepareRoutes/commitRoutes);教程 demos/04 实验 2
 *       (重复注册);replace 是 0.1.6 新货,教程(0.1.0-rc.6)没有——版本差红利。
 *       末两用例是 qa/03 的鸭子实验:注册不认血缘认行为。
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { LlmError } from '@deepseek-ai/dsh-llm'

import { EchoAdapter } from '../echo-adapter/echo-adapter.ts'
import { collectChunks, mountLlm } from '../stage/harness.ts'
import { buildRequest } from '../stage/request.ts'
import { DuckAdapter } from './duck-adapter.ts'
import { OVERRIDE_MARKER, SubclassedDeepSeekAdapter, shadowImplementationWithDuck, shadowStreamWithConnection } from './subclass-probe.ts'

/** 插件形态的适配器注册(guide/04 §4.4:注册是插件的事,effect 卸载时自动撤销)。 */
const echoPlugin = {
  name: 'echo-adapter',
  inject: ['llm'],
  apply(ctx: Context) {
    ctx.llm.registerAdapter(['mock'], new EchoAdapter())
  },
}

async function withLlm(run: (ctx: Context) => Promise<void> | void): Promise<void> {
  const ctx = await mountLlm()
  try {
    await run(ctx)
  } finally {
    await ctx.fiber.dispose()
  }
}

describe('单元二:注册表的规矩', () => {
  it('注册即上线,disposer 一调即下线', async () => {
    await withLlm(async (ctx) => {
      expect(ctx.llm.listProviders()).toEqual([])
      const handle = ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['mock'])
      handle()
      expect(ctx.llm.listProviders()).toEqual([])
    })
  })

  it('一个路由只认一个适配器:重复注册抛 DUPLICATE_ADAPTER(认 code,不解析 message)', async () => {
    await withLlm(async (ctx) => {
      ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      try {
        ctx.llm.registerAdapter(['mock'], new EchoAdapter())
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(LlmError)
        expect((err as LlmError).code).toBe('DUPLICATE_ADAPTER')
      }
    })
  })

  it('多路由 all-or-nothing:冲突让整批失败,不留半注册的 alt 路由', async () => {
    await withLlm(async (ctx) => {
      ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      expect(() => ctx.llm.registerAdapter(['mock', 'alt'], new EchoAdapter())).toThrow(LlmError)
      // 关键在「全部失败」:没被占用的 alt 也不许单独幸存
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['mock'])
    })
  })

  it('replace 原子换路由(0.1.6 新货):同一注册从 mock 迁到 mock-v2,请求随路由走', async () => {
    await withLlm(async (ctx) => {
      const handle = ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      handle.replace(['mock-v2'])
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['mock-v2'])
      // 换路由不只是改名:请求真的从新路由走通
      const chunks = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'mock-v2' })))
      expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })
      // 已注销的注册不能再 replace
      handle()
      expect(() => handle.replace(['mock'])).toThrow(LlmError)
    })
  })

  it('注册是 effect:插件形态注册,插件 fiber 卸载时路由自动撤销(HMR 安全)', async () => {
    await withLlm(async (ctx) => {
      const fiber = await ctx.plugin(echoPlugin)
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['mock'])
      await fiber.dispose()
      expect(ctx.llm.listProviders()).toEqual([])
      // ctx 本体还活着,再注册一个照样能用——撤销的只是那个插件的路由
      ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['mock'])
    })
  })

  it('qa/03 鸭子实验 A:裸对象在注册时就被拒——注册层是行为摸底,不是类型检查', async () => {
    await withLlm(async (ctx) => {
      // 编译层第一道:@ts-expect-error 裸对象不是 LlmAdapter——类型断言也是测试
      // 运行层第二道:registerAdapter 立刻调用 providerInfo 摸行为,当场 TypeError
      // @ts-expect-error 故意绕过编译层,观察运行层怎么拒绝
      expect(() => ctx.llm.registerAdapter(['broken'], {})).toThrow(TypeError)
      // 拒绝不留痕:注册失败后注册表仍是空的
      expect(ctx.llm.listProviders()).toEqual([])
    })
  })

  it('qa/03 鸭子实验 B:不认血缘认行为——独立类 DuckAdapter(无 extends)结构对齐即可全链路跑通', async () => {
    await withLlm(async (ctx) => {
      // 注意这里【不需要】@ts-expect-error:DuckAdapter 虽无继承,但七个结构成员
      // 齐备,TS 结构化类型直接放行——类型系统本来就不看血缘
      const handle = ctx.llm.registerAdapter(['duck'], new DuckAdapter())
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['duck'])

      const chunks = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'duck', model: 'duck-1' })))
      expect(chunks.map((c) => c.type)).toEqual(['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
      expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })

      handle()
      expect(ctx.llm.listProviders()).toEqual([])
    })
  })

  it('qa/03 追问:继承具体适配器(DeepSeekAdapter)+ override stream 是死代码——runtime 路径不经过 this.stream', async () => {
    await withLlm(async (ctx) => {
      const sub = new SubclassedDeepSeekAdapter()
      const handle = ctx.llm.registerAdapter(['deepseek-mock'], sub)
      // 注册成功:providerInfo 来自门面(implementation 按 protocol 分派),展示名 "DeepSeek"
      expect(ctx.llm.listProviders().map((p) => p.id)).toEqual(['deepseek-mock'])

      // runtime 路径:prepareCall → implementation 的私有传输层 → 连不可达端口失败
      // → terminal finish error。override 的标记 chunk 一个都没有。
      const viaRuntime = await collectChunks(ctx.llm.stream(
        buildRequest({ provider: 'deepseek-mock', model: 'deepseek-chat' }),
      ))
      const sawMarker = viaRuntime.some((c) => c.type === 'text-delta' && c.text.includes(OVERRIDE_MARKER))
      expect(sawMarker).toBe(false) // override 没跑
      const last = viaRuntime[viaRuntime.length - 1]
      expect(last.type === 'finish' && last.reason.kind).toBe('error') // 真传输层跑了,然后失败

      // 旁路直调:方法本身活着——被绕过的只是 runtime 的 dispatch,不是这个方法
      const direct = await collectChunks(sub.stream(buildRequest({ provider: 'deepseek-mock', model: 'deepseek-chat' })))
      expect(direct.some((c) => c.type === 'text-delta' && c.text.includes(OVERRIDE_MARKER))).toBe(true)
      expect(direct[direct.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })

      handle()
    })
  }, 60_000)

  it('qa/03 追问·机制验证:晚绑定查找发生在「被引用的名字」上——遮蔽 streamWithConnection 不生效,遮蔽 implementation 生效', async () => {
    await withLlm(async (ctx) => {
      // D(a):闭包接收者是内部实现对象,sub 实例上的遮蔽拦截不到
      const subA = new SubclassedDeepSeekAdapter()
      shadowStreamWithConnection(subA)
      ctx.llm.registerAdapter(['probe-a'], subA)
      const viaA = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'probe-a', model: 'deepseek-chat' })))
      expect(viaA.some((c) => c.type === 'text-delta')).toBe(false) // 遮蔽没跑
      const lastA = viaA[viaA.length - 1]
      expect(lastA.type === 'finish' && lastA.reason.kind).toBe('error') // 内部对象的真传输层跑了

      // D(b):门面 prepareCall 里 this.implementation() 是对 sub 的晚绑定——遮蔽命中
      const subB = new SubclassedDeepSeekAdapter()
      shadowImplementationWithDuck(subB, new DuckAdapter())
      ctx.llm.registerAdapter(['probe-b'], subB)
      const viaB = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'probe-b', model: 'deepseek-chat' })))
      expect(viaB.some((c) => c.type === 'text-delta' && c.text.includes('嘎'))).toBe(true) // 鸭子在跑
      expect(viaB[viaB.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })
    })
  }, 60_000)
})
