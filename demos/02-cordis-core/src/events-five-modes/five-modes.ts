/**
 * 目标:概念四「类型化事件」五种分发模式逐一对比——emit 广播 / parallel 并发 /
 *       serial 顺序拍板 / bail 同步拍板 / waterfall 环绕拦截。
 * 思路:一个事件名配一种模式(模式是事件约定的一部分,不是调用方任选),
 *       每种模式用 2~3 个监听器把"顺序、是否等待、返回值、短路"的差异写进剧本行。
 * 对照:vendor/cordis/src/events.ts 的 EventsService(parallel/serial/bail/emit 实现);
 *       dsh 的 agent/pre-step、llm/stream、tools/pre-execute 是 waterfall,
 *       session/event 是 emit;每个事件在参考文档里都标注了模式。
 */
import { Context } from '@deepseek-ai/cordis'

// 类型化事件:先声明签名,再派发/监听——ctx.emit/ctx.on 的参数与返回值全程有类型
declare module '@deepseek-ai/cordis' {
  interface Events {
    'demo/notify'(who: string): void
    'demo/fanout'(label: string): Promise<void>
    'demo/decide'(question: string): Promise<string | undefined>
    'demo/ask'(question: string): string | undefined
    'demo/transform'(input: string, next: () => Promise<string>): Promise<string>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** waterfall 的默认行为(最内层):闭包捕获原始入参——v4 的 next() 零参,默认值只能这样拿参数。 */
const dispatchTransform = (root: Context, input: string) =>
  root.waterfall('demo/transform', input, async () => `模型回复(${input})`)

export async function runFiveModes(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  // ── emit:同步广播,不等待、不收集返回值 ──
  root.on('demo/notify', (who) => {
    out.push(`  [emit] 同步监听器先记:${who}`)
  })
  root.on('demo/notify', async (who) => {
    await sleep(5)
    out.push(`  [emit] 异步监听器事后落账:${who}(emit 没等它)`)
  })
  root.emit('demo/notify', 'world')
  out.push('  [emit] emit() 已返回')
  await sleep(10)

  // ── parallel:监听器并发运行,await 等全部完成 ──
  root.on('demo/fanout', async (label) => {
    await sleep(30)
    out.push(`  [parallel] ${label}-甲(睡 30ms)完成`)
  })
  root.on('demo/fanout', async (label) => {
    await sleep(10)
    out.push(`  [parallel] ${label}-乙(睡 10ms)完成`)
  })
  out.push('[parallel] 注册顺序甲、乙,但完成顺序反过来(并发不排队):')
  await root.parallel('demo/fanout', 'job')
  out.push('  [parallel] await 返回:全部完成才继续')

  // ── serial:顺序 await,第一个非空返回值胜出并短路后续 ──
  root.on('demo/decide', async (question) => {
    if (question.includes('机密')) return '审计插件:这个问题我拍板拒绝'
    return undefined // 不拍板 → 轮到下一位
  })
  root.on('demo/decide', async (question) => {
    out.push(`  [serial] 第二监听器运行了(问题:${question})`)
    return `第二监听器:回答 ${question}`
  })
  out.push('[serial] 常规问题,第一位不拍板、委托给第二位:')
  out.push(`  结果 = ${await root.serial('demo/decide', '今天天气?')}`)
  out.push('[serial] 敏感问题,第一位直接拍板:')
  out.push(`  结果 = ${await root.serial('demo/decide', '机密问题?')}`)
  out.push('  (第二监听器没有再运行)')

  // ── bail:serial 的同步版——询问"谁来处理",第一个真值拍板 ──
  root.on('demo/ask', (question) => {
    return question.includes('工具') ? 'tools 服务管' : undefined
  })
  root.on('demo/ask', () => {
    return '兜底插件管'
  })
  out.push(`[bail] 同步询问"工具坏了谁管" = ${root.bail('demo/ask', '工具坏了谁管')}`)
  out.push(`[bail] 同步询问"别的事谁管"     = ${root.bail('demo/ask', '别的事谁管')}`)

  // ── waterfall:环绕式中间件——先注册的在外层,可加工返回值、可否决 ──
  // 注意 v4 的 next() 零参:下游永远拿到原始参数,改写只能发生在返回值流上
  // (dsh 的 llm/stream 同款:next() 拿到流,包裹后再还回去)
  root.on('demo/transform', async (input, next) => {
    const downstream = await next()
    return `〔审计〕${downstream}` // 外层观察者:委托后再加工
  })
  root.on('demo/transform', async (input, next) => {
    if (input.includes('密码')) return '** 已拦截 **' // 否决:不调 next(),链在这里断
    const result = await next() // 委托:执行下游,拿回默认行为的结果
    return result.replaceAll('hello', 'HELLO') // 改写返回值(相当于换掉模型看的东西)
  })
  out.push('[waterfall] 常规请求,内层改写 + 外层审计都生效:')
  out.push(`  ${await dispatchTransform(root, 'hello')}`)
  out.push('[waterfall] 敏感请求,内层否决短路,默认行为(最内层)从未运行:')
  out.push(`  ${await dispatchTransform(root, '我的密码')}`)

  await root.fiber.dispose()
  return out
}
