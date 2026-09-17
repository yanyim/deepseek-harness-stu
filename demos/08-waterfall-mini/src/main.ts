/**
 * 目标:Demo 08 串场——亲手造一个教学版 waterfall,把 qa/04 附录二讲透的机制跑
 *       成可观察的六组实验。叙事:命题(七道闸同一种工艺)→ 值瀑布四实验(洋葱
 *       双向/否决短路/异常穿透/prepend)→ 流瀑布两实验(透传/短路)→ 与真
 *       cordis 对照收口。
 * 思路:与测试共用同一批标本;每段实验打印「执行序 + 结果」,肉眼可读。
 * 对照:qa/04-附录二(机制细讲 + 真包实测);cordis lib/index.js Events.waterfall;
 *       dsh 的 @mode waterfall 七道闸(agent/pre-step、agent/request、
 *       agent/request-error、llm/stream、tools 三闸)。
 */
import { StreamWaterfall, ValueWaterfall } from './mini-waterfall.ts'

// ── §1 命题:七道闸,同一种工艺 ────────────────────────────────────────
// dsh 在 turn/step 生命周期的七个边界各装了一道瀑布门(qa/04 附录一 Q4 全景表)。
// 工艺本体只有一句:(queue.shift() ?? inner) —— 队列(谁先谁后)+ 闭包(next 即
// 「余下的链」)。cordis 用 12 行实现;下面用我们自己的 3 行核心重造一个,跑六组实验。

// ── §2 值瀑布:洋葱双向 ──────────────────────────────────────────────
const log1: string[] = []
const wf1 = new ValueWaterfall<string>()
for (const tag of ['A', 'B', 'C']) {
  wf1.on(async (value, next) => {
    log1.push(`${tag}进`)
    const inner = await next()
    log1.push(`${tag}出`)
    return `[${tag}]${inner}`
  })
}
const out1 = await wf1.run('原始值', async (v) => `【内置】${v}`)
console.log('§2 洋葱双向:', log1.join(' → '))
console.log('   最终值:', out1, '(值的加工内→外,A 最后润色 = final say)\n')

// ── §3 值瀑布:否决短路 ──────────────────────────────────────────────
const log2: string[] = []
const wf2 = new ValueWaterfall<string>()
wf2.on(async (v, next) => { log2.push('A进'); const d = await next(); log2.push('A出'); return d })
wf2.on(async () => 'REJECTED') // 否决:不消费队列
wf2.on(async (v, next) => { log2.push('C进(不该到这)'); return await next() })
const out2 = await wf2.run('x', async () => '【内置】')
console.log('§3 否决短路:', log2.join(' → '), '| 最终值:', out2)
console.log('   (C 与内置从未执行——否决不是标志位,是「不消费队列」)\n')

// ── §4 值瀑布:异常穿透 ──────────────────────────────────────────────
const log3: string[] = []
const wf3 = new ValueWaterfall<string>()
wf3.on(async (v, next) => { try { return await next() } finally { log3.push('A出(finally)') } })
wf3.on(async () => { throw new Error('C炸了') })
try {
  await wf3.run('x', async () => '内置')
} catch (err) {
  console.log('§4 异常穿透:调用方 catch 到 →', (err as Error).message, '|', log3.join(' → '))
}
console.log('   (瀑布不做错误隔离——内层抛错沿 Promise 链炸给 run() 调用方)\n')

// ── §5 值瀑布:prepend 抢最外层 ──────────────────────────────────────
const log4: string[] = []
const wf4 = new ValueWaterfall<string>()
wf4.on(async (v, next) => { log4.push('A进'); const d = await next(); log4.push('A出'); return d })
wf4.on(async (v, next) => { log4.push('D进'); const d = await next(); log4.push('D出'); return d }, { prepend: true })
await wf4.run('x', async (v) => v)
console.log('§5 prepend:', log4.join(' → '))
console.log('   (D 后注册但抢到最外层 = 最后润色权;dsh-agent 的模型切换通知就这么用)\n')

// ── §6 流瀑布:同一个句型,载荷换成流 ─────────────────────────────────
const wf5 = new StreamWaterfall<number>()
let seen = 0
wf5.on(async function* (next) {
  for await (const chunk of next()) { seen += 1; yield chunk } // 统计监听器:观察即经过
})
const received: number[] = []
for await (const chunk of wf5.run(async function* () { for (const n of [1, 2, 3]) yield n })) {
  received.push(chunk)
}
console.log(`§6 流瀑布透传:统计监听器数到 ${seen} 个,消费方实收 [${received.join(', ')}]`)

const wf6 = new StreamWaterfall<number>()
wf6.on(async function* () { yield 42 }) // 短路:不调 next
let builtinRan = false
const shortCircuited: number[] = []
for await (const chunk of wf6.run(async function* () { builtinRan = true; yield 0 })) {
  shortCircuited.push(chunk)
}
console.log(`§7 流瀑布短路:消费方实收 [${shortCircuited.join(', ')}],内置执行了? ${builtinRan}`)
console.log('   (demos/06 单元三的短路测试插件,机制就是这一行)\n')

// ── §8 收口:与真 cordis 对照 ────────────────────────────────────────
console.log('§8 对照:教学版核心 3 行 (queue.shift() ?? inner),cordis 版 12 行(多出 args')
console.log('   打包/this 绑定/多事件名复用);六组实验行为与真包实测(qa/04 附录二)一致。')
console.log('   dsh 的七道 @mode waterfall 门,工艺全是这一句——学一次,处处读。')
