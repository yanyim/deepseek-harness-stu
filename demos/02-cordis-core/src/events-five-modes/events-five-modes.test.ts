/**
 * 目标:锁定概念四的行为——五种分发模式在"等待/顺序/返回值/短路"上的差异,
 *       以及 waterfall 观察者忘调 next() 吞掉默认行为的 bug 现场。
 * 思路:runFiveModes / runDiscipline 剧本整列 toEqual;parallel 用完成顺序
 *       (乙先于甲)证明并发;serial 第二监听器的 marker 只在常规问题里出现。
 * 对照:vendor/cordis/src/events.ts 的 EventsService 各 dispatch 实现。
 */
import { describe, expect, it } from 'vitest'

import { runFiveModes } from './five-modes.ts'
import { runDiscipline } from './waterfall-discipline.ts'

describe('概念四:类型化事件五种分发模式', () => {
  it('emit 不等待 / parallel 并发 / serial 拍板 / bail 同步 / waterfall 包裹与否决', async () => {
    const lines = await runFiveModes()
    expect(lines).toEqual([
      '  [emit] 同步监听器先记:world',
      '  [emit] emit() 已返回',
      '  [emit] 异步监听器事后落账:world(emit 没等它)',
      '[parallel] 注册顺序甲、乙,但完成顺序反过来(并发不排队):',
      '  [parallel] job-乙(睡 10ms)完成',
      '  [parallel] job-甲(睡 30ms)完成',
      '  [parallel] await 返回:全部完成才继续',
      '[serial] 常规问题,第一位不拍板、委托给第二位:',
      '  [serial] 第二监听器运行了(问题:今天天气?)',
      '  结果 = 第二监听器:回答 今天天气?',
      '[serial] 敏感问题,第一位直接拍板:',
      '  结果 = 审计插件:这个问题我拍板拒绝',
      '  (第二监听器没有再运行)',
      '[bail] 同步询问"工具坏了谁管" = tools 服务管',
      '[bail] 同步询问"别的事谁管"     = 兜底插件管',
      '[waterfall] 常规请求,内层改写 + 外层审计都生效:',
      '  〔审计〕模型回复(HELLO)',
      '[waterfall] 敏感请求,内层否决短路,默认行为(最内层)从未运行:',
      '  〔审计〕** 已拦截 **',
    ])
  })

  it('waterfall 纪律:忘调 next() 的观察者吞掉整条链,补上即恢复', async () => {
    const lines = await runDiscipline()
    expect(lines).toEqual([
      '[基线] 模型回复:好的(写首诗)',
      '  [审计] 观察到请求:写首诗',
      '[bug] waterfall 返回 = undefined',
      '  日志打上了,但模型回复被吞了——默认行为从未运行,也没有任何报错',
      '  [审计] 观察到请求:写首诗',
      '[修复] 模型回复:好的(写首诗)',
    ])
  })
})
