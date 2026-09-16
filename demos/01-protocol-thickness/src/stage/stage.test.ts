/**
 * 【舞台】行为锁定:迷你内核的可逆副作用语义
 * 对应解法④(内核无领域知识)的可靠性前提 —— 注册必须有主人,卸载必须干净。
 */

import { describe, it, expect } from 'vitest'
import { Context } from './kernel.ts'

describe('舞台:一切注册皆可逆副作用', () => {
  it('插件卸载按逆序撤销其全部注册', () => {
    const ctx = new Context()
    const order: string[] = []
    const unload = ctx.plugin('p1', (ctx) => {
      ctx.on('boot', async () => {
        order.push('listener-1')
      })
      ctx.effect(() => order.push('effect-1 撤销'))
      ctx.effect(() => order.push('effect-2 撤销')) // 后注册的先撤销
    })
    expect(order).toEqual([]) // 未卸载前无副作用
    unload()
    expect(order).toEqual(['effect-2 撤销', 'effect-1 撤销']) // 逆序撤销
  })

  it('卸载后监听器收不到事件、服务不可再用', () => {
    const ctx = new Context()
    const seen: string[] = []
    const unload = ctx.plugin('p1', (ctx) => {
      ctx.on('app/started', async (name: string) => {
        seen.push(name)
      })
      ctx.provide('ephemeral', () => ({ tag: 'x' }))
    })
    ctx.emit('app/started', 'a')
    expect(seen).toEqual(['a'])
    unload()
    ctx.emit('app/started', 'b')
    expect(seen).toEqual(['a']) // 监听器已撤销
    expect(() => ctx.use('ephemeral')).toThrow(/服务未注册/)
  })

  it('嵌套插件:卸父必卸子', () => {
    const ctx = new Context()
    const seen: string[] = []
    const unloadParent = ctx.plugin('parent', (ctx) => {
      // 子插件的卸载器没有单独保留 —— 刻意:子插件生命周期由父持有
      ctx.plugin('child', (ctx) => {
        ctx.on('app/started', async () => {
          seen.push('child')
        })
      })
      ctx.on('app/started', async () => {
        seen.push('parent')
      })
    })
    ctx.emit('app/started', 'x')
    expect(seen).toEqual(['child', 'parent'])
    unloadParent()
    ctx.emit('app/started', 'y')
    expect(seen).toEqual(['child', 'parent']) // 父卸载带走子
  })

  it('后注册的同名服务替换前者,撤销后恢复前者', () => {
    const ctx = new Context()
    ctx.plugin('base-slot', (ctx) => {
      ctx.provide('slot', () => ({ v: 1 }))
    })
    const unload = ctx.plugin('replacement', (ctx) => {
      ctx.provide('slot', () => ({ v: 2 }))
    })
    expect(ctx.use<{ v: number }>('slot').v).toBe(2)
    unload()
    expect(ctx.use<{ v: number }>('slot').v).toBe(1)
  })

  it('注册必须发生在 plugin() 之内 —— 一切注册都要有主人', () => {
    const ctx = new Context()
    expect(() => ctx.provide('orphan', () => ({}))).toThrow(/plugin\(\) 之内/)
  })
})
