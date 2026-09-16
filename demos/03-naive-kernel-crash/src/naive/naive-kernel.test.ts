/**
 * 目标:证明 naive 内核不是稻草人——demo 02 概念三的同步场景它全部跑通:
 *       顺序无关停靠、依赖激活、事件、逆序清理、级联+重停靠。
 *       (它翻车的三个异步场景在 crash 各单元里,与本文件形成对照。)
 * 思路:每个用例只测同步快乐路径;行/计数断言。
 * 对照:demos/02-cordis-core/src/inject-loading/dependency.ts 的同款场景。
 */
import { describe, expect, it } from 'vitest'

import { NaiveKernel } from './naive-kernel.ts'

describe('naive 内核 · 快乐路径(非稻草人证明)', () => {
  it('顺序无关:consumer 先挂靠停,provider 后到自动激活', () => {
    const kernel = new NaiveKernel()
    const events: string[] = []
    kernel.plugin({
      name: 'consumer',
      inject: ['db'],
      apply: (ctx) => {
        events.push(`consumer 激活,看到 ${ctx.service<{ tag: string }>('db').tag}`)
      },
    })
    expect(events).toEqual([]) // 停靠中,没执行
    kernel.plugin({ name: 'provider', apply: (ctx) => ctx.provide('db', { tag: 'v1' }) })
    expect(events).toEqual(['consumer 激活,看到 v1'])
  })

  it('事件:注册、派发、dispose 后监听器消失', () => {
    const kernel = new NaiveKernel()
    const seen: string[] = []
    const listener = kernel.plugin({
      name: 'listener',
      apply: (ctx) => {
        ctx.on('tick', (who) => {
          seen.push(`tick:${who}`)
        })
      },
    })
    kernel.plugin({ name: 'emitter', apply: (ctx) => ctx.emit('tick', 'a') })
    expect(seen).toEqual(['tick:a'])
    kernel.dispose(listener)
    kernel.plugin({ name: 'emitter2', apply: (ctx) => ctx.emit('tick', 'b') })
    expect(seen).toEqual(['tick:a'])
  })

  it('逆序清理:effect 按注册逆序撤销', () => {
    const kernel = new NaiveKernel()
    const order: string[] = []
    const rec = kernel.plugin({
      name: 'ordered',
      apply: (ctx) => {
        ctx.effect(() => () => {
          order.push('A')
        })
        ctx.effect(() => () => {
          order.push('B')
        })
        ctx.effect(() => () => {
          order.push('C')
        })
      },
    })
    kernel.dispose(rec)
    expect(order).toEqual(['C', 'B', 'A'])
  })

  it('级联:dispose provider → 依赖者拆掉并重停靠,新 provider 到位后重跑', () => {
    const kernel = new NaiveKernel()
    const runs: string[] = []
    const provider = kernel.plugin({ name: 'p1', apply: (ctx) => ctx.provide('db', { tag: 'v1' }) })
    kernel.plugin({
      name: 'consumer',
      inject: ['db'],
      apply: (ctx) => {
        runs.push(`run#${ctx.runId} 看到 ${ctx.service<{ tag: string }>('db').tag}`)
      },
    })
    expect(runs).toEqual(['run#1 看到 v1'])
    kernel.dispose(provider)
    kernel.plugin({ name: 'p2', apply: (ctx) => ctx.provide('db', { tag: 'v2' }) })
    expect(runs).toEqual(['run#1 看到 v1', 'run#2 看到 v2'])
  })
})
