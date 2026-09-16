/**
 * 目标:锁定翻车现场一的行为差异——同一时间线,naive 产生永久幽灵监听器且越积越多,
 *       cordis 迟到注册被代际作废、重启后只有干净的一轮。
 * 思路:两侧剧本整列 toEqual;番外形态陷阱断言 ACTIVE/LOADING 的实测值。
 * 对照:vendor/cordis/src/fiber.ts 的 epoch 门(迟到副作用 → 惰性空操作)。
 */
import { describe, expect, it } from 'vitest'

import { runFormHazard } from './form-hazard.ts'
import { runRaceCordis, runRaceNaive } from './race.ts'

describe('翻车现场一:中途换依赖(竞态)', () => {
  it('naive:迟到注册成永久幽灵,重启后监听器翻倍', async () => {
    const lines = await runRaceNaive()
    expect(lines).toEqual([
      '[naive] t+0  provider v1 + consumer 就位(consumer 的 apply 正在 sleep)',
      '[naive] t+10 显式 dispose provider v1 → consumer 被级联拆掉并重停靠',
      '[naive] t+35 窗口期 emit → 命中 1 次:run#1(幽灵:apply 在插件被拆掉后仍完成了注册)',
      '[naive] t+70 新提供者到位后再 emit → 命中 2 次:run#1 + run#2(幽灵永不消失,监听器越积越多)',
    ])
  })

  it('cordis:迟到注册被代际作废,重启后只有干净一轮', async () => {
    const lines = await runRaceCordis()
    expect(lines).toEqual([
      '[cordis] t+0 provider v1 + consumer 就位(consumer 的 apply 正在 sleep)',
      '[cordis] t+10 dispose provider v1 → consumer 状态轨迹:PENDING→LOADING LOADING→UNLOADING UNLOADING→PENDING(装载在途被拆,从未 ACTIVE;拆掉后回 PENDING 等新提供者)',
      '[cordis] t+35 窗口期 emit → 命中 0 次(迟到注册已被代际作废)',
      '[cordis] t+70 新提供者到位后再 emit → 命中 1 次:run@v2(只有 run@v2,无幽灵)',
    ])
  })

  it('番外:形态陷阱——plain function 返回 Promise 不被等待,async 会被等待', async () => {
    const lines = await runFormHazard()
    expect(lines).toEqual([
      '[形态A] plain function 返回 Promise:被 isConstructor 判为类,new 出的"实例"就是那个 Promise',
      '[形态A] apply 的 then 还没跑,fiber 已 = ACTIVE(后半段脱离生命周期)',
      '[形态B] async 箭头函数:睡满 20ms 前 fiber 仍是 = LOADING(返回值被等待)',
      '[形态B] 等待完成后 = ACTIVE',
      '[规则] 插件主体要么 async function/箭头,要么同步返回 disposer;普通 function 只做同步副作用',
    ])
  })
})
