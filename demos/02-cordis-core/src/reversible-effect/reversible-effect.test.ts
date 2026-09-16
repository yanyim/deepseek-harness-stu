/**
 * 目标:锁定概念五的行为——卸载逆序撤销全部注册、服务与监听器随 fiber 消失、
 *       定时器真的停了、死 ctx 上注册抛 INACTIVE_EFFECT;以及 HMR 的"无幽灵状态"。
 * 思路:runDisposal / runHmr 剧本 toEqual;定时器行带计时数字,用正则锁定形状;
 *       状态轨迹行整列锁定,证明 v1 DISPOSED、v2 ACTIVE 且无残留迁移。
 * 对照:vendor/cordis/src/fiber.ts 的 _unload 与 CordisError.Code.INACTIVE_EFFECT。
 */
import { describe, expect, it } from 'vitest'

import { runDisposal } from './disposal.ts'
import { runHmr } from './hmr.ts'

describe('概念五:注册是可逆的副作用', () => {
  it('dispose:逆序清理 C→B→A,监听器/服务/定时器全部消失,死 ctx 抛 INACTIVE_EFFECT', async () => {
    const lines = await runDisposal()
    expect(lines.slice(0, 2)).toEqual(['[生前] 监听器听到 knock', '[生前] ctx.sink.ping() = pong'])
    expect(lines.slice(2, 5)).toEqual([
      '[卸载] effect A 清理(最后注册,最先清理)',
      '[卸载] effect B 清理(定时器已 clearInterval)',
      '[卸载] effect C 清理(最先注册,最后清理)',
    ])
    // 定时器行含计时数字,锁定形状而非具体次数(在两次采样之后才入列)
    expect(lines[5]).toBe('[卸载后] 再 emit knock → 没有新的〔监听器〕行')
    expect(lines[6]).toBe('[卸载后] ctx.sink = undefined')
    expect(lines[7]).toMatch(/^\[卸载后\] 定时器计数冻结:是\(两次采样都是 \d+\)$/)
    expect(lines[8]).toBe('[死后] 在已卸载插件的 ctx 上 ctx.on → CordisError INACTIVE_EFFECT')
    // 全程没有幽灵监听器行
    expect(lines.filter((line) => line.includes('监听器听到'))).toHaveLength(1)
  })

  it('HMR:dispose 旧 fiber → 启动新 fiber,v1 的监听器与服务不复活', async () => {
    const lines = await runHmr()
    expect(lines).toEqual([
      '[v1 运行中] 事件回应 = v1 回应:hello',
      '[v1 运行中] 服务问候 = 来自 v1 的问候:hello',
      '[热重载后] 事件回应 = v2 回应:你好(v1 的监听器没有复活)',
      '[热重载后] 服务问候 = 来自 v2 的问候:你好(新实现)',
      '[状态轨迹] v1 走完卸载,v2 完整激活:',
      '  plugin-v1: PENDING -> LOADING',
      '  plugin-v1: LOADING -> ACTIVE',
      '  plugin-v1: ACTIVE -> UNLOADING',
      '  plugin-v1: UNLOADING -> DISPOSED',
      '  plugin-v2: PENDING -> LOADING',
      '  plugin-v2: LOADING -> ACTIVE',
    ])
  })
})
