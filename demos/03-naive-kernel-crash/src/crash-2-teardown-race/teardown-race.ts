/**
 * 目标:翻车现场二「异步清理撕裂共享资源」——v1 插件的 disposer 是异步的(关连接要 20ms),
 *       卸载 v1 后立刻上 v2。同一时间线跑 naive 与真 Cordis,看共享连接池归属。
 * 思路:naive 的 dispose 是同步 for 循环,异步 disposer 只是"被调用了"而不被等待——
 *       v2 已经拿到池子,v1 的迟到清理把它撕掉。Cordis 的 fiber.dispose() 返回的
 *       Promise 会等所有 disposer(含异步)落地(inertia),await 它再挂 v2 就是
 *       严格串行。
 * 对照:vendor/cordis/src/fiber.ts 的 dispose/effect 包装器(finalizeDisposal/inFlight——
 *       异步拆卸在结束前保持"owner 可见",await dispose() 即等待它);探针实测
 *       await dispose 耗时 ≈ 异步 disposer 时长。
 */
import { Context } from '@deepseek-ai/cordis'

import { NaiveKernel } from '../naive/naive-kernel.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Pool {
  owner: string
}

// ───────────────────────────── naive 侧 ─────────────────────────────

export async function runTeardownNaive(): Promise<string[]> {
  const out: string[] = []
  const kernel = new NaiveKernel()
  const pool: Pool = { owner: 'idle' }

  const v1 = kernel.plugin({
    name: 'pool-v1',
    apply: (ctx) => {
      pool.owner = 'v1'
      // 插件作者已尽力:把清理包进了 effect。但它是异步的——
      ctx.effect(() => () => {
        void (async () => {
          await sleep(20)
          pool.owner = 'released' // 真正的释放动作,20ms 后才发生
        })()
      })
    },
  })
  out.push(`[naive] t+0  v1 拿到连接池 → pool.owner = ${pool.owner}`)

  kernel.dispose(v1) // 同步返回,不等异步清理
  kernel.plugin({
    name: 'pool-v2',
    apply: (ctx) => {
      pool.owner = 'v2'
      ctx.effect(() => () => {
        pool.owner = 'released-v2'
      })
    },
  })
  out.push(`[naive] t+0  dispose(v1) 同步返回,立刻挂 v2 → pool.owner = ${pool.owner}`)

  await sleep(35)
  out.push(`[naive] t+35 v1 的异步清理姗姗来迟 → pool.owner = ${pool.owner}(v2 的连接被 v1 的幽灵清理撕掉)`)
  return out
}

// ───────────────────────────── cordis 侧 ─────────────────────────────

export async function runTeardownCordis(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()
  const pool: Pool = { owner: 'idle' }

  const v1 = await root.plugin({
    name: 'cordis-pool-v1',
    apply(ctx: Context) {
      pool.owner = 'v1'
      ctx.effect(() => async () => {
        await sleep(20)
        pool.owner = 'released'
      })
    },
  })
  out.push(`[cordis] t+0  v1 拿到连接池 → pool.owner = ${pool.owner}`)

  const started = Date.now()
  await v1.dispose() // ← 关键差异:dispose 的 Promise 等待异步 disposer 落地
  const waited = Date.now() - started >= 18 ? '是' : '否'
  out.push(`[cordis] t+2X await dispose(v1) 等到异步清理完成(≥18ms:${waited})→ pool.owner = ${pool.owner}`)

  await root.plugin({
    name: 'cordis-pool-v2',
    apply(ctx: Context) {
      pool.owner = 'v2'
      ctx.effect(() => () => {
        pool.owner = 'released-v2'
      })
    },
  })
  out.push(`[cordis] t+2X 再挂 v2 → pool.owner = ${pool.owner}`)

  await sleep(35)
  out.push(`[cordis] t+2X+35 pool.owner = ${pool.owner}(v2 的持有完好,没有迟到的清理覆盖它)`)
  await root.fiber.dispose()
  return out
}
