/**
 * 目标:锁定单元三「协议义务的边界」——义务在哪里执法、怎么执法:有的靠组装器
 *       「违规者得不到正确结果」,有的只在适配器契约层(组装器不管,实测为准);
 *       以及 runtime 边界对失败的归一化包装。
 * 思路:故意作恶/极端的适配器各就各位:①违反义务①(usage 发在 finish 之后)
 *       ——0.1.6 实测组装器照收(last-wins),教程 0.1.0-rc.6 说会被忽略,版本差
 *       实录;真正被无视的是 ②block-end 之后的迟到增量与重复关块(「首关胜出」,
 *       已完成的块篡改不了);③义务③的两条失败路径——中途抛异常被 runtime 包成
 *       terminal finish chunk(消费方永不收裸异常),带内 finish error 原样透传;
 *       ④llm/stream 瀑布——透传监听器无损包裹每次调用,短路监听器不调 next() 时,
 *       甚至不需要有任何注册的适配器。
 * 对照:教程 demos/04 实验 1/实验 3(实验 1 结论在 0.1.6 已不成立);guide/04
 *       §4.3 义务清单、§4.5 瀑布拦截点;dsh 源码 packages/llm/llm 的 adapterStream
 *       (catch → adapterFailureChunk)与 assembler(push 的 ignore 规则)。
 */
import { describe, expect, it } from 'vitest'
import { BlockAssembler, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

import { EchoAdapter } from '../echo-adapter/echo-adapter.ts'
import { collectChunks, mountLlm } from '../stage/harness.ts'
import { buildRequest } from '../stage/request.ts'

/** 故意违反义务①:usage 发在 finish 之后(教程实验 1 的作恶版)。 */
class LateUsageAdapter extends LlmAdapter {
  async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'hi' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'hi' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
    yield { type: 'usage', usage: { inputTokens: 42, outputTokens: 13 } } // 义务①:迟到的 usage
  }
}

/** 作恶版二:块关了还继续吐增量、还想重复关块换掉已完成的内容。 */
class StragglerAdapter extends LlmAdapter {
  async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'hi' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'hi' } }
    yield { type: 'text-delta', index: 0, text: ' 篡改' } // 迟到增量:想改已完成的块
    yield { type: 'block-end', index: 0, block: { type: 'text', text: '整个换掉' } } // 重复关块
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

/** 义务③路径 A:吐了一个 delta 后传输层炸了(裸异常)。 */
class WireBrokeAdapter extends LlmAdapter {
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '半' }
    throw new Error('wire broke')
  }
}

/** 义务③路径 B:提供方带内失败( HTTP 429 语义),以 finish error 报告。 */
class RateLimitedAdapter extends LlmAdapter {
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '半' }
    yield { type: 'finish', reason: { kind: 'error', failure: { message: 'upstream busy', code: 'RATE_LIMIT' } } }
  }
}

describe('单元三:协议义务的边界', () => {
  it('义务①的执法位置(版本差实录):0.1.6 组装器对迟到 usage 照收不误(last-wins)——教程 0.1.0-rc.6 说会被忽略,执法其实在适配器契约层', async () => {
    const assembler = new BlockAssembler()
    for await (const chunk of new LateUsageAdapter().stream(buildRequest())) assembler.push(chunk)

    // 实测:usage 无位置门禁,迟到也写入(若有多个,后到覆盖先到)
    expect(assembler.usage).toEqual({ inputTokens: 42, outputTokens: 13 })
    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'hi' }]) // 块内容不受牵连
    expect(assembler.finish).toEqual({ kind: 'stop' })
  })

  it('straggler 执法:block-end 之后的增量被无视、重复关块首关胜出——已完成的块篡改不了,违规者得不到正确结果', async () => {
    const assembler = new BlockAssembler()
    for await (const chunk of new StragglerAdapter().stream(buildRequest())) assembler.push(chunk)

    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'hi' }]) // 「篡改」「整个换掉」都没得逞
    expect(assembler.finish).toEqual({ kind: 'stop' })
  })

  it('义务③路径 A:适配器中途抛异常 → runtime 包成 terminal finish chunk,消费方不收裸异常', async () => {
    const ctx = await mountLlm()
    try {
      ctx.llm.registerAdapter(['mock'], new WireBrokeAdapter())
      const chunks = await collectChunks(ctx.llm.stream(buildRequest()))

      const last = chunks[chunks.length - 1]
      expect(last.type).toBe('finish')
      if (last.type !== 'finish') throw new Error('unreachable')
      expect(last.reason.kind).toBe('error')
      expect(last.reason.kind === 'error' && last.reason.failure.code.length > 0).toBe(true)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('义务③路径 B:带内失败 finish {kind:"error"} 原样到达消费方,流正常收尾', async () => {
    const ctx = await mountLlm()
    try {
      ctx.llm.registerAdapter(['mock'], new RateLimitedAdapter())
      const chunks = await collectChunks(ctx.llm.stream(buildRequest()))

      expect(chunks[chunks.length - 1]).toEqual({
        type: 'finish',
        reason: { kind: 'error', failure: { message: 'upstream busy', code: 'RATE_LIMIT' } },
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('llm/stream 瀑布(教程实验 3):透传监听器必须 yield 出 next() 的每个 chunk,统计与消费端一一对应', async () => {
    const ctx = await mountLlm()
    try {
      ctx.llm.registerAdapter(['mock'], new EchoAdapter())
      let seenByListener = 0
      ctx.on('llm/stream', async function* (_options, next) {
        for await (const chunk of next()) {
          seenByListener += 1
          yield chunk // 教程强调:必须把 next() 的每个 chunk yield 出去,否则下游断流
        }
      })

      const received = await collectChunks(ctx.llm.stream(buildRequest()))
      expect(seenByListener).toBe(received.length)
      expect(received[received.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('llm/stream 短路:监听器不调 next() 直接吐脚本化输出——provider 路由甚至不必有适配器', async () => {
    const ctx = await mountLlm()
    try {
      ctx.on('llm/stream', async function* () {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'mock!' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'mock!' } }
        yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })

      // 'ghost' 从未注册过任何适配器——瀑布在适配器解析之前就把调用短路了
      const chunks = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'ghost' })))
      expect(chunks.map((c) => c.type)).toEqual(['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
