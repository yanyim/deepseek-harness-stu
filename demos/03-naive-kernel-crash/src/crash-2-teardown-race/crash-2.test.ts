/**
 * 目标:锁定翻车现场二的行为差异——naive 的同步 dispose 撕裂 v2 的连接,
 *       cordis 的 await dispose 等到异步清理落地后再换班,交接无损。
 * 思路:两侧剧本整列 toEqual(耗时已布尔化为 ≥18ms 判断,数字不进断言)。
 * 对照:vendor/cordis/src/fiber.ts 的 finalizeDisposal/inFlight(异步拆卸的可等待性)。
 */
import { describe, expect, it } from 'vitest'

import { runTeardownCordis, runTeardownNaive } from './teardown-race.ts'

describe('翻车现场二:异步清理撕裂共享资源', () => {
  it('naive:dispose 同步返回,v1 的迟到清理撕掉 v2 的连接', async () => {
    const lines = await runTeardownNaive()
    expect(lines).toEqual([
      '[naive] t+0  v1 拿到连接池 → pool.owner = v1',
      '[naive] t+0  dispose(v1) 同步返回,立刻挂 v2 → pool.owner = v2',
      '[naive] t+35 v1 的异步清理姗姗来迟 → pool.owner = released(v2 的连接被 v1 的幽灵清理撕掉)',
    ])
  })

  it('cordis:await dispose 等待异步清理落地,交接无损', async () => {
    const lines = await runTeardownCordis()
    expect(lines).toEqual([
      '[cordis] t+0  v1 拿到连接池 → pool.owner = v1',
      '[cordis] t+2X await dispose(v1) 等到异步清理完成(≥18ms:是)→ pool.owner = released',
      '[cordis] t+2X 再挂 v2 → pool.owner = v2',
      '[cordis] t+2X+35 pool.owner = v2(v2 的持有完好,没有迟到的清理覆盖它)',
    ])
  })
})
