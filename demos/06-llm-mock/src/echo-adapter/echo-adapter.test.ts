/**
 * 目标:锁定单元一的行为——EchoAdapter 的 chunk 流逐条对上协议义务,不经 runtime,
 *       适配器本体直测(接缝的两侧各自可测,这本身就是「薄接缝」的证据)。
 * 思路:三条测试分别锁:整条序列的形状(义务①②)、BlockAssembler 的组装无损
 *       (义务②的执法面)、取消路径(义务③④)。
 * 对照:教程 demos/04-llm-mock 的输出解读节;guide/04 §4.3 协议义务清单;
 *       dsh 源码 packages/llm/llm 的 assembler(BlockAssembler 是唯一权威组装算法)。
 */
import { describe, expect, it } from 'vitest'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

import { collectChunks } from '../stage/harness.ts'
import { buildRequest } from '../stage/request.ts'
import { EchoAdapter } from './echo-adapter.ts'

describe('单元一:EchoAdapter——把输入加工后回复', () => {
  it('整条序列遵守词汇表:双块按首现分配 index,增量交织,usage 先于 finish,finish 后无 chunk', async () => {
    const adapter = new EchoAdapter()
    const chunks = await collectChunks(adapter.stream(buildRequest()))

    // 开场:两个 block-start,index 按首次出现分配(义务②)
    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'reasoning' })
    expect(chunks[1]).toEqual({ type: 'block-start', index: 1, blockType: 'text' })

    // 中段:全是增量,reasoning 归 0 / text 归 1,且确实存在交织
    const deltas = chunks.filter((c) => c.type === 'reasoning-delta' || c.type === 'text-delta')
    expect(deltas.length).toBeGreaterThan(0)
    for (const c of deltas) expect(c.index).toBe(c.type === 'reasoning-delta' ? 0 : 1)
    const interleaved = deltas.some((c, i) => i > 0 && c.index !== deltas[i - 1].index)
    expect(interleaved).toBe(true)

    // 收尾:两个 block-end → usage → finish,usage 在 finish 之前(义务①),之后无 chunk
    expect(chunks.slice(-4).map((c) => c.type)).toEqual(['block-end', 'block-end', 'usage', 'finish'])
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('BlockAssembler 把交织增量按 index 归位:块序、加工内容、派生 usage 全部无损', async () => {
    const adapter = new EchoAdapter()
    const request = buildRequest({ tools: [{ name: 'echo', description: '原样返回', parameters: { type: 'object', properties: {} } }] })
    const assembler = new BlockAssembler()
    for await (const chunk of adapter.stream(request)) assembler.push(chunk)

    const blocks = assembler.blocks()
    expect(blocks.map((b) => b.type)).toEqual(['reasoning', 'text'])

    // 「加工后回复」的内容断言:回答里带着输入原文与请求元数据
    const answer = blocks[1]
    if (answer.type !== 'text') throw new Error('unreachable: 第二块应是 text')
    expect(answer.text).toContain('你刚才说:"你好,介绍一下你自己"')
    expect(answer.text).toContain('provider=mock')
    expect(answer.text).toContain('model=mock-1')
    expect(answer.text).toContain('工具数=1')

    // usage 是从输入派生的,不是魔法数:期望值从请求与组装结果独立推算
    const inputTokens = request.messages
      .flatMap((m) => m.content)
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('').length
    const outputTokens = blocks.reduce(
      (n, b) => n + (b.type === 'text' || b.type === 'reasoning' ? b.text.length : 0), 0)
    expect(assembler.usage).toEqual({ inputTokens, outputTokens })

    // 组装出的助手消息:角色 assistant,内容即按序组装的块
    const message = assembler.message()
    expect(message.role).toBe('assistant')
    expect(message.content).toEqual(blocks)
  })

  it('取消(义务④):abort 后流以 finish aborted 终止,之后无任何 chunk(义务③带内路径)', async () => {
    const adapter = new EchoAdapter()
    const ac = new AbortController()
    const chunks: StreamChunk[] = []
    for await (const chunk of adapter.stream({ ...buildRequest(), signal: ac.signal })) {
      chunks.push(chunk)
      // 收到第一个增量就取消:取消在「下一个 delta 边界」生效
      if (chunk.type === 'reasoning-delta' || chunk.type === 'text-delta') ac.abort()
    }
    expect(chunks[chunks.length - 1]).toEqual({
      type: 'finish',
      reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } },
    })
  })
})
