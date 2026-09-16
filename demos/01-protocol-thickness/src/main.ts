/**
 * demos/01 · 插件协议的厚薄困境 —— 按「目标 → 解题思路」串场
 *
 * 对应笔记:笔记库 dsh-harness-tutorial/qa/01-插件协议的厚薄困境.md
 * 运行:pnpm demo:01
 *
 * 叙事线(目录结构 = 论证结构):
 *   困境:插件架构 = 新的内部协议层。协议太薄 → 被迫透传;太厚 → 臃肿失控。
 *   死法一(太薄→透传):解法① 有类型的逃生口 / 解法② 厂商独立 seam / 解法③ 不透明令牌
 *   死法二(太厚→失控):解法④ 内核无领域知识 / 解法⑤ 渐进式契约 / 解法⑥ 拦截走事件
 *   结论:不是把协议设计得恰到好处,而是让每种变化都有自己的容器。
 */

// 副作用 import:本编译单元的 ContentBlock 词汇表从此认识 'math'(解法①)
import './death-1-too-thin/typed-escape-hatch.ts'

import { Context } from './stage/kernel.ts'
import { LlmRuntime } from './stage/llm-seam.ts'
import type { ContentBlock } from './stage/llm-seam.ts'
import { RenderRuntime } from './stage/render.ts'
import { MockAdapter } from './stage/mock-adapter.ts'
import { ask, drain } from './stage/testing.ts'

import { demonstrateAntiPattern } from './death-1-too-thin/anti-pattern.ts'
import { loadMathBlocks } from './death-1-too-thin/typed-escape-hatch.ts'
import { VendorApiExtensions, DeepseekMockAdapter, loadLogTagging } from './death-1-too-thin/vendor-seam.ts'
import { localBackend, previewFile, remoteBackend } from './death-1-too-thin/opaque-token.ts'

import { MinimalAdapter, demonstrateDefaults } from './death-2-too-thick/progressive-contract.ts'
import { tapObserve, tapRewrite, tapVeto } from './death-2-too-thick/interception-by-event.ts'

const header = (title: string) => {
  console.log(`\n${'═'.repeat(62)}\n  ${title}\n${'═'.repeat(62)}`)
}

// ── 搭台:内核 + 中立协议就位(解法④的展品就是这台子本身) ─────────
header('搭台:迷你内核(无领域知识)+ LLM 中立协议')
const ctx = new Context()
const eventsSeen: string[] = []
ctx.plugin('core', (ctx) => {
  ctx.provide(LlmRuntime.key, (ctx) => new LlmRuntime(ctx))
  ctx.provide(RenderRuntime.key, (ctx) => new RenderRuntime(ctx))
  const render = ctx.use<RenderRuntime>(RenderRuntime.key)
  render.register('text', (b: { text: string }) => b.text)
  render.register('reasoning', (b: { text: string }) => `〔思考〕${b.text}`)
  render.register('tool-call', (b: { name: string; arguments: string }) => `〔调用〕${b.name}(${b.arguments})`)
  ctx.on('app/started', async (name: string) => {
    eventsSeen.push(name)
  })
})
ctx.emit('app/started', 'web')
console.log(`  内核只有 4 个原语、零 Agent 知识;emit 可观察:${eventsSeen.join(', ')}`)

const llm = ctx.use<LlmRuntime>(LlmRuntime.key)
const render = ctx.use<RenderRuntime>(RenderRuntime.key)
ctx.plugin('llm-mock', (ctx) => {
  ctx.use<LlmRuntime>(LlmRuntime.key).registerAdapter('mock', new MockAdapter())
})

// ── 病理切片:上帝协议怎么死的 ────────────────────────────────────
header('病理:providerExtra —— 「太薄」的无类型逃生口')
demonstrateAntiPattern()

// ══════════ 死法一:太薄 → 被迫透传,三个解法 ═══════════════════
header('死法一·解法① 有类型的逃生口:闭结构、开词汇')
const math: ContentBlock = { type: 'math', latex: 'e = mc^2' }
console.log(`  未加载 math 插件:render(math) = ${render.render(math)}`)
const unloadMath = ctx.plugin('math-blocks', loadMathBlocks)
console.log(`  加载 math 插件后:render(math) = ${render.render(math)}`)
unloadMath()
console.log(`  卸载 math 插件后:render(math) = ${render.render(math)}`)

header('死法一·解法② 厂商特例住独立 seam:中立协议零负载')
ctx.plugin('vendor-seam', (ctx) => {
  ctx.provide(VendorApiExtensions.key, (ctx) => new VendorApiExtensions(ctx))
})
const unloadLog = ctx.plugin('log-tagging', loadLogTagging)
let deepseek!: DeepseekMockAdapter
ctx.plugin('llm-deepseek', (ctx) => {
  deepseek = new DeepseekMockAdapter(ctx)
  ctx.use<LlmRuntime>(LlmRuntime.key).registerAdapter('deepseek', deepseek)
})
await drain(llm, ask('deepseek-chat', 'deepseek'))
console.log(`  log-tagging 在场:wire = ${JSON.stringify(deepseek.lastWire)}`)
unloadLog()
await drain(llm, ask('deepseek-chat', 'deepseek'))
console.log(`  卸载 log-tagging:wire = ${JSON.stringify(deepseek.lastWire)}`)
console.log('  GenerateOptions 的形状从头到尾没变过 —— 厂商字段不住在协议里')

header('死法一·解法③ 不透明令牌:堵住实现细节反向污染')
console.log(`  local  → ${previewFile(localBackend('/repo'), 'README.md')}`)
console.log(`  remote → ${previewFile(remoteBackend('https://e2b.dev/w1'), 'README.md')}`)
console.log('  previewFile() 对后端一无所知;key 是 FsTargetKey,MUST NOT parse')

// ══════════ 死法二:太厚 → 臃肿失控,三个解法 ═══════════════════
header('死法二·解法④ 内核无领域知识:协议分片,厚度单位=单个 seam')
console.log('  (本幕的展品就是开场搭的台:kernel.ts 零 Agent 知识,没有理由变厚;')
console.log('   领域协议是 60 个互相独立的小 seam,llm 变厚不影响 fs —— 见 README 对照表)')

header('死法二·解法⑤ 渐进式契约:厚是可选菜单,不是门槛')
console.log(`  最小适配器只写 stream() → ${await drain(llm, ask('deepseek-chat', 'mock'))}`)
demonstrateDefaults(new MinimalAdapter())

header('死法二·解法⑥ 拦截走事件,不走协议参数')
const auditLog: string[] = []
const unloadTaps = ctx.plugin('taps', (ctx) => {
  ctx.plugin('audit', tapObserve(auditLog)) // 外层:先看到原始请求
  ctx.plugin('router', tapRewrite('deepseek-chat', 'deepseek-reasoner'))
  ctx.plugin('guard', tapVeto('forbidden-model'))
})
console.log(`  正常请求 → ${await drain(llm, ask('deepseek-chat'))}`)
console.log(`  审计日志看到的是改写前的模型:${auditLog.join(', ')}`)
try {
  await drain(llm, ask('forbidden-model'))
} catch (error) {
  console.log(`  禁用模型 → ${(error as Error).message}`)
}
unloadTaps()
console.log(`  卸载 taps 后审计长度 = ${auditLog.length}(不再增长)`)

// ── 结论 ────────────────────────────────────────────────────────
header('结论')
console.log('  困境的本质:单一协议承担全部变化方向。')
console.log('  dsh 的解法:让变化方向正交分片,每种变化都有自己的容器 ——')
console.log('    词汇演化 → merge-map(解法①)  厂商特例 → 独立 seam(解法②)')
console.log('    实现细节 → 不透明令牌(解法③)  功能归属 → 领域无关内核(解法④)')
console.log('    契约厚度 → 渐进式(解法⑤)      运行时拦截 → waterfall(解法⑥)')
console.log('  没有一个容器需要恰到好处。')
