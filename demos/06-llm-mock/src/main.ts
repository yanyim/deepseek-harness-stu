/**
 * 目标:Demo 06 串场入口——「模型提供方也是一个插件」的最小可运行证明。叙事顺序
 *       =论证顺序:巴别塔困境 → 挂接缝 → 假提供方上线 → 解剖注册机制(鸭子实验)→
 *       一次完整通话 → 取消 → 瀑布拦截 → 原子换路由 → 下线。每一段都是对 guide/04
 *       一个小节的现场版。
 * 思路:与测试同一批模块(stage + echo-adapter),main 只负责把这些块按论证顺序
 *       走一遍并打印观察点;行为锁定在测试里,这里只做「肉眼可见」。
 * 对照:教程 demos/04-llm-mock/main.ts(0.1.0-rc.6 单块版);guide/04 全章;
 *       dsh 源码 packages/llm/llm。
 */
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

import { EchoAdapter } from './echo-adapter/echo-adapter.ts'
import { DuckAdapter } from './registry/duck-adapter.ts'
import { SubclassedDeepSeekAdapter, shadowImplementationWithDuck, shadowStreamWithConnection } from './registry/subclass-probe.ts'
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

// ── §4 解剖注册机制:不认血缘认行为(qa/03)───────────────────────────
// registerAdapter 全程没有 instanceof。名字 'mock' 也不是身份证明,它只是
// ctx.llm 自家注册表(Map)里的路由键。识别靠两道「行为摸底」:
//   注册时立刻调 providerInfo / providerRetryPolicy;调用时走 prepareCall → stream。
// 探针 A:裸对象 —— 编译层被 TS 拦(@ts-expect-error 绕过只为做实验),
//         运行层在注册时被拒:providerInfo is not a function。
try {
  // @ts-expect-error 探针 A:故意绕过编译层,观察运行层怎么拒绝
  ctx.llm.registerAdapter(['broken'], {})
  console.log('§4 探针 A:裸对象注册成功(不该到这里)')
} catch (err) {
  console.log('§4 探针 A:裸对象被拒 ——', (err as Error).constructor.name, ':', (err as Error).message)
}
// 探针 B:不继承 LlmAdapter 的独立类,把七个结构成员手工复刻(含基类白送的
//         缺省实现)—— 注册 + 通话全通。注意这里连 @ts-expect-error 都不用:
//         TS 类型系统本来就是结构化的,结构齐了就放行。
const duckHandle = ctx.llm.registerAdapter(['duck'], new DuckAdapter())
const duckChunks = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'duck', model: 'duck-1' })))
console.log('§4 探针 B:DuckAdapter(无 extends)注册并跑通,chunk 序列:',
  duckChunks.map((c) => c.type).join(' → '))
console.log('   extends LlmAdapter 的真实价值 = 白拿缺省实现(只需写 stream),不是身份证明\n')
duckHandle()

// 探针 C(qa/03 追问):那能不能反过来,继承具体适配器(DeepSeekAdapter)只 override
// stream?能编译、能注册——但 override 是死代码:DeepSeekAdapter 是门面,
// providerInfo/prepareCall 都先 this.implementation() 按 protocol 分派,dispatch
// 闭包绑的是私有传输路径,不经过 this.stream。基类「stream 是扩展点」的承诺,
// 不自动传给具体子类。
const sub = new SubclassedDeepSeekAdapter()
const subHandle = ctx.llm.registerAdapter(['deepseek-mock'], sub)
const viaRuntime = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'deepseek-mock', model: 'deepseek-chat' })))
console.log('§4 探针 C:继承 DeepSeekAdapter + override stream → runtime 路径输出:',
  viaRuntime.map((c) => c.type + (c.type === 'finish' ? `(${c.reason.kind})` : '')).join(' → '))
console.log('   (标记 chunk 一个没有——dispatch 走了真传输层,连 127.0.0.1:9 失败包成 finish error)')
const directCall = await collectChunks(sub.stream(buildRequest({ provider: 'deepseek-mock', model: 'deepseek-chat' })))
console.log(`   旁路直调 sub.stream():${directCall.length} 个 chunk,标记在场——方法活着,路不过它`)
console.log('   想拦截/mock 的正解:llm/stream 瀑布短路(单元三)或自有路由+改配置(demos/07)\n')
subHandle()

// 探针 D(机制验证):override 为什么不生效——晚绑定查找发生在「被引用的名字」上。
// 门面 prepareCall 链:this.implementation()(对 sub 的晚绑定)→ new 内部实现对象
// → 闭包 (options) => this.streamWithConnection(options, connection),接收者已是内部对象。
const subA = new SubclassedDeepSeekAdapter()
shadowStreamWithConnection(subA)
const handleA = ctx.llm.registerAdapter(['probe-a'], subA)
const viaA = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'probe-a', model: 'deepseek-chat' })))
console.log('§4 探针 D(a):实例遮蔽 streamWithConnection →',
  viaA.map((c) => c.type + (c.type === 'finish' ? `(${c.reason.kind})` : '')).join(' → '))
console.log('   不生效——闭包接收者是 implementation() new 出的内部对象,查找到不了 sub')
handleA()

const subB = new SubclassedDeepSeekAdapter()
shadowImplementationWithDuck(subB, new DuckAdapter())
const handleB = ctx.llm.registerAdapter(['probe-b'], subB)
const viaB = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'probe-b', model: 'deepseek-chat' })))
console.log('§4 探针 D(b):实例遮蔽 implementation →',
  viaB.map((c) => c.type + (c.type === 'finish' ? `(${c.reason.kind})` : '')).join(' → '))
console.log('   生效——this.implementation() 是对 sub 的晚绑定;但这是蹭 TS private 内部名,无契约,升级即碎\n')
handleB()

// ── §5 一次完整通话:消费方只认统一词汇表 ────────────────────────────
const request = buildRequest({
  tools: [{ name: 'echo', description: '原样返回', parameters: { type: 'object', properties: {} } }],
})
console.log('\n§5 流式调用开始(provider=mock, model=mock-1, 双块交织):')
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

// ── §6 取消:消费方永远拿到合法终止 ──────────────────────────────────
console.log('\n§6 取消演示:150ms 后 abort,取消在下一个 delta 边界生效:')
const ac = new AbortController()
setTimeout(() => ac.abort(), 150)
for await (const chunk of ctx.llm.stream({ ...request, signal: ac.signal })) {
  console.log(`  chunk: ${describe(chunk)}`)
}

// ── §7 瀑布拦截:llm/stream 包裹每一次调用 ──────────────────────────
let counted = 0
ctx.on('llm/stream', async function* (_options, next) {
  for await (const chunk of next()) {
    counted += 1
    yield chunk
  }
})
const relayed = await collectChunks(ctx.llm.stream(request))
console.log(`\n§7 llm/stream 监听器数到 ${counted} 个 chunk,消费端实收 ${relayed.length} 个(一一对应)`)
console.log(`   token 统计监听器/短路测试插件就挂在这条瀑布上(guide/04 §4.5)`)

// ── §8 原子换路由:0.1.6 的 replace(教程 0.1.0-rc.6 还没有) ─────────
handle.replace(['mock-v2'])
console.log('\n§8 handle.replace(["mock-v2"]) 后,提供方列表:',
  ctx.llm.listProviders().map((p) => p.id).join(', '))
const afterReplace = await collectChunks(ctx.llm.stream(buildRequest({ provider: 'mock-v2' })))
console.log(`   从新路由通话一次:finish ${afterReplace[afterReplace.length - 1].type === 'finish' ? 'stop' : '?'}(请求随路由走)`)

// ── §9 下线:disposer 一调即清空,「切换模型服务」的本质 ─────────────
handle()
console.log('\n§9 适配器已注销,提供方列表:', ctx.llm.listProviders().length === 0 ? '(空)' : ctx.llm.listProviders().map((p) => p.id).join(', '))
console.log('   想象设置页切换模型服务 = 调一次 disposer + 一次新注册(或一次 replace)')
await ctx.fiber.dispose()
