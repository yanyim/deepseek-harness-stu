/**
 * 目标:锁定教学版 waterfall 的六种行为——洋葱双向、否决短路、异常穿透、prepend
 *       抢最外层、注销器生效、流瀑布的透传与短路。全部与真 cordis 包的实测
 *       (qa/04 附录二 E1-E4)同款断言,证明教学版与真机制同构。
 * 思路:值瀑布用「包裹式监听器 + 进出记账」锁执行序与最终值;流瀑布用「统计监听器
 *       数 chunk」与「短路监听器自己 yield」锁两种出手。
 * 对照:./mini-waterfall.ts;qa/04-附录二(真包四组实测);demos/06 protocol-edge
 *       (llm/stream 透传/短路在真 dsh 上的版本)。
 */
import { describe, expect, it } from 'vitest'

import { StreamWaterfall, ValueWaterfall } from './mini-waterfall.ts'

const wrap = (tag: string, log: string[]) =>
  async (value: string, next: () => Promise<string>): Promise<string> => {
    log.push(`${tag}进`)
    const inner = await next()
    log.push(`${tag}出`)
    return `[${tag}]${inner}`
  }

describe('值瀑布', () => {
  it('洋葱双向:墙钟外→内(注册序),值的加工内→外(反序),最外层最后润色', async () => {
    const log: string[] = []
    const wf = new ValueWaterfall<string>()
    wf.on(wrap('A', log))
    wf.on(wrap('B', log))
    wf.on(wrap('C', log))

    const out = await wf.run('原始值', async (v) => `【内置】${v}`)
    expect(log).toEqual(['A进', 'B进', 'C进', 'C出', 'B出', 'A出'])
    expect(out).toBe('[A][B][C]【内置】原始值')
  })

  it('否决短路:B 不调 next,更内层与内置都不会跑;否决值沿回流路上交', async () => {
    const log: string[] = []
    const wf = new ValueWaterfall<string>()
    wf.on(async (v, next) => { log.push('A进'); const d = await next(); log.push('A出'); return d })
    wf.on(async () => 'REJECTED') // 否决:不消费队列
    wf.on(async (v, next) => { log.push('C进(不该到这)'); return await next() })

    const out = await wf.run('x', async () => '【内置】')
    expect(log).toEqual(['A进', 'A出'])
    expect(out).toBe('REJECTED')
  })

  it('异常穿透:内层抛错沿 Promise 链传给 run() 调用方;外层 finally 照常执行', async () => {
    const log: string[] = []
    const wf = new ValueWaterfall<string>()
    wf.on(async (v, next) => {
      try { return await next() } finally { log.push('A出(finally)') }
    })
    wf.on(async () => { throw new Error('C炸了') })

    await expect(wf.run('x', async () => '内置')).rejects.toThrow('C炸了')
    expect(log).toEqual(['A出(finally)'])
  })

  it('prepend 抢最外层 = 最后润色权;注销器一调即摘除', async () => {
    const log: string[] = []
    const wf = new ValueWaterfall<string>()
    wf.on(wrap('A', log))
    const disposeD = wf.on(wrap('D', log), { prepend: true })
    await wf.run('x', async (v) => v)
    expect(log).toEqual(['D进', 'A进', 'A出', 'D出']) // D 在最外层

    log.length = 0
    disposeD()
    await wf.run('x', async (v) => v)
    expect(log).toEqual(['A进', 'A出'])
  })
})

describe('流瀑布', () => {
  const numbers = async function* () { for (const n of [1, 2, 3]) yield n }

  it('透传监听器「观察即经过」:统计数与消费数一致,内置被执行', async () => {
    const wf = new StreamWaterfall<number>()
    let seen = 0
    wf.on(async function* (next) {
      for await (const chunk of next()) { seen += 1; yield chunk } // 数完再放行
    })

    const received: number[] = []
    for await (const chunk of wf.run(numbers)) received.push(chunk)
    expect(received).toEqual([1, 2, 3])
    expect(seen).toBe(3)
  })

  it('短路监听器不调 next:内置不执行,消费方拿到监听器自己的流', async () => {
    let builtinRan = false
    const wf = new StreamWaterfall<number>()
    wf.on(async function* () {
      yield 42 // 不调 next:更内层与内置全部短路
    })

    const received: number[] = []
    for await (const chunk of wf.run(async function* () { builtinRan = true; yield 0 })) {
      received.push(chunk)
    }
    expect(received).toEqual([42])
    expect(builtinRan).toBe(false)
  })
})
