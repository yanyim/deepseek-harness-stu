/**
 * 目标:锁定翻车现场三的行为差异——naive 一个 disposer 抛错中断兄弟清理且栈里没有
 *       注册现场;cordis 逐个隔离、兄弟照常清理、错误栈同时含抛错现场与注册现场。
 * 思路:两侧剧本整列 toEqual。栈断言依据长栈嫁接(composeError/buildOuterStack),
 *       函数名 cordisMountBroken/naiveMountBroken 即"注册现场"的探针。
 * 对照:vendor/cordis/src/utils.ts 的 handleError(把外层栈拼进错误栈)。
 */
import { describe, expect, it } from 'vitest'

import { runStackCordis, runStackNaive } from './stack.ts'

describe('翻车现场三:报错不知道找谁', () => {
  it('naive:异常冒出、兄弟被中断(泄漏)、栈里无注册现场', () => {
    const lines = runStackNaive()
    expect(lines).toEqual([
      '[naive] 远处触发卸载 → 异常冒出:清理 A 时炸了:连接已失效',
      '[naive] resourceB.cleaned = false(逆序先执行的 disposer 炸了,兄弟被中断 → 泄漏)',
      '[naive] 错误栈里有注册现场 naiveMountBroken?否(内核不记账,注册点无从查起)',
    ])
  })

  it('cordis:异常被隔离记日志、兄弟照常清理、栈里有注册现场', async () => {
    const lines = await runStackCordis()
    expect(lines).toEqual([
      '[cordis] 远处触发卸载 → 异常被逐 disposer 隔离记入 logger,不冒泡、不中断(捕获 1 条)',
      '[cordis] resourceB.cleaned = true(兄弟照常清理,无泄漏)',
      '[cordis] 错误栈里有注册现场 cordisMountBroken?是(长栈:抛错现场 + 注册现场)',
    ])
  })
})
