/**
 * 目标:Demo 06 串场入口——「模型提供方也是一个插件」的最小可运行证明。叙事顺序
 *       =论证顺序:巴别塔困境 → 挂接缝 → 假提供方上线 → 一次完整通话 → 取消 →
 *       瀑布拦截 → 原子换路由 → 下线。每一段都是对 guide/04 一个小节的现场版。
 * 思路:与测试同一批模块(stage + echo-adapter),main 只负责把这些块按论证顺序
 *       走一遍并打印观察点;行为锁定在测试里,这里只做「肉眼可见」。
 * 对照:教程 demos/04-llm-mock/main.ts(0.1.0-rc.6 单块版);guide/04 全章;
 *       dsh 源码 packages/llm/llm。
 */
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

import { EchoAdapter } from './echo-adapter/echo-adapter.ts'
import { collectChunks, mountLlm } from './stage/harness.ts'
import { buildRequest } from './stage/request.ts'

function describe(chunk: StreamChunk): string {
  switch (chunk.type) {
    case 'block-start': return `block-start #${chunk.index} (${chunk.blockType})`
    case 'text-delta': return `text-delta #${chunk.index} "${chunk.text}"`
    case 'reasoning-delta': return `reasoning-delta #${chunk.index} "${chunk.text}"`
    case 'block-end': return `block-end #${chunk.index}`
    case 'usage': return `usage ${JSON.stringify(chunk.usage)}`
    case 'finish': return `finish ${chunk.reason.kind}`
    default: return chunk.type
  }
}

// ── §1 困境:模型 API 的巴别塔 ────────────────────────────────────────
// 同一句「助手答了一句话」:OpenAI 兼容协议叫 choices[0].message.content,
// Anthropic 叫 content:[{type:'text'}],各家工具调用/用量/错误码五花八门。
// 若 agent 循环里到处 if (provider==='openai'),每接一家新提供方都是灾难。
// dsh 的答案:双端翻译——统一词汇表(Message/ContentBlock/StreamChunk)+
// 每个提供方一个适配器插件。下面亲手当一次「提供方」。

// ── §2 挂接缝:LlmRuntime 自己就是插件 ───────────────────────────────
const ctx = await mountLlm()
console.log('§2 LlmRuntime 已挂载,ctx.llm 可用(它自己就是一个插件)')

// ── §3 假提供方上线:注册即路由 ──────────────────────────────────────
const echo = new EchoAdapter({ deltaDelayMs: 12 })
const handle = ctx.llm.registerAdapter(['mock'], echo)
console.log('§3 EchoAdapter 已注册到路由 "mock";已注册提供方:',
  ctx.llm.listProviders().map((p) => `${p.id}(${p.name})`).join(', ') || '(空)')

// ── §4 一次完整通话:消费方只认统一词汇表 ────────────────────────────
const request = buildRequest({
  tools: [{ name: 'echo', description: '原样返回', parameters: { type: 'object', properties: {} } }],
})
console.log('\n§4 流式调用开始(provider=mock, model=mock-1, 双块交织):')
const assembler = new BlockAssembler()
for await (const chunk of ctx.llm.stream(request)) {
  console.log(`  chunk: ${describe(chunk)}`)
  assembler.push(chunk)
}
const blocks = assembler.blocks()
console.log('== 组装结果(BlockAssembler 按 index 归位) ==')
for (const block of blocks) {
  if (block.type === 'text' || block.type === 'reasoning') console.log(`  [${block.type}] ${block.text}`)
}
console.log('  usage:', JSON.stringify(assembler.usage))
console.log('  finish:', JSON.stringify(assembler.finish))

// ── §5 取消:消费方永远拿到合法终止 ──────────────────────────────────
console.log('\n§5 取消演示:150ms 后 abort,取消在下一个 delta 边界生效:')
const ac = new AbortController()
setTimeout(() => ac.abort(), 150)
for await (const chunk of ctx.llm.stream({ ...request, signal: ac.signal })) {
  console.log(`  chunk: ${describe(chunk)}`)
}

// ── §6 瀑布拦截:llm/stream 包裹每一次调用 ──────────────────────────
let counted = 0
ctx.on('llm/stream', async function* (_options, next) {
  for await (const chunk of next()) {
    counted += 1
    yield chunk
  }
})
const relayed = await collectChunks(ctx.llm.stream(request))
console.log(`\n§6 llm/stream 监听器数到 ${counted} 个 chunk,消费端实收 ${relayed.length} 个(一一对应)`)
console.log(`   token 统计监听器/短路测试插件就挂在这条瀑布上(guide/04 §4.5)`)

// ── §7 原子换路由:0.1.6 的 replace(教程 0.1.0-rc.6 还没有) ─────────
handle.replace(['mock-v2'])
console.log('\n§7 handle.replace(["mock-v2"]) 后,提供方列表:',
  ctx.llm.listProviders().map((p) => p.id).join(', '))
const afterReplace = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'mock-v2' })))
console.log(`   从新路由通话一次:finish ${afterReplace[afterReplace.length - 1].type === 'finish' ? 'stop' : '?'}(请求随路由走)`)

// ── §8 下线:disposer 一调即清空,「切换模型服务」的本质 ─────────────
handle()
console.log('\n§8 适配器已注销,提供方列表:', ctx.llm.listProviders().length === 0 ? '(空)' : ctx.llm.listProviders().map((p) => p.id).join(', '))
console.log('   想象设置页切换模型服务 = 调一次 disposer + 一次新注册(或一次 replace)')
await ctx.fiber.dispose()
