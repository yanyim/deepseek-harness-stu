/**
 * 目标:翻车现场一「中途换依赖」——consumer 的 apply 是异步的,跑到一半时它依赖的
 *       服务被换掉。同一时间线分别跑 naive 内核与真 Cordis,数 emit 命中数。
 * 思路:consumer 在 sleep 之后注册事件监听器。naive:级联拆掉 consumer 时 apply
 *       还在路上,迟到的注册落进已清空的记录 + 全局列表 → 幽灵监听器永久存活,
 *       且新提供者到位后 apply 重跑,监听器越积越多。Cordis:迟到的注册撞上
 *       epoch 门(效果包装器发现代际失效,注册静默作废),新提供者到位后干净重启。
 * 对照:vendor/cordis/src/fiber.ts 的 effect 包装器(`if (!runner.epoch) return ...`)
 *       ——迟到副作用变惰性空操作的闸门;探针已验证窗口期 emit 命中 0 次。
 */
import { Context, Service } from '@deepseek-ai/cordis'

import { NaiveKernel } from '../naive/naive-kernel.ts'
import { stateName } from '../stage/states.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ───────────────────────────── naive 侧 ─────────────────────────────

export async function runRaceNaive(): Promise<string[]> {
  const out: string[] = []
  const kernel = new NaiveKernel()
  const hits: string[] = []

  const provider1 = kernel.plugin({
    name: 'provider-v1',
    apply: (ctx) => ctx.provide('db', { tag: 'v1' }),
  })
  kernel.plugin({
    name: 'consumer',
    inject: ['db'],
    apply: async (ctx) => {
      await sleep(20)
      const run = ctx.runId // 注册时记住自己属于哪一轮 apply
      ctx.on('race/tick', () => hits.push(`run#${run}`))
    },
  })
  out.push('[naive] t+0  provider v1 + consumer 就位(consumer 的 apply 正在 sleep)')

  await sleep(10)
  kernel.dispose(provider1)
  out.push('[naive] t+10 显式 dispose provider v1 → consumer 被级联拆掉并重停靠')

  await sleep(25) // 迟到的注册在此发生
  kernel.plugin({ name: 'emitter', apply: (ctx) => ctx.emit('race/tick') })
  out.push(`[naive] t+35 窗口期 emit → 命中 ${hits.length} 次:${hits.join(' + ')}(幽灵:apply 在插件被拆掉后仍完成了注册)`)

  kernel.plugin({ name: 'provider-v2', apply: (ctx) => ctx.provide('db', { tag: 'v2' }) })
  await sleep(30) // consumer 重跑 apply(run#2)
  hits.length = 0
  kernel.plugin({ name: 'emitter2', apply: (ctx) => ctx.emit('race/tick') })
  out.push(`[naive] t+70 新提供者到位后再 emit → 命中 ${hits.length} 次:${hits.join(' + ')}(幽灵永不消失,监听器越积越多)`)
  return out
}

// ───────────────────────────── cordis 侧 ─────────────────────────────

declare module '@deepseek-ai/cordis' {
  interface Context {
    racedb: RaceDbService
  }
  interface Events {
    'race/tick'(): void
  }
}

class RaceDbService extends Service {
  tag: string

  constructor(ctx: Context, config: { tag: string }) {
    super(ctx, 'racedb')
    this.tag = config.tag
  }
}

function raceProvider(tag: string) {
  return {
    name: `race-provider-${tag}`,
    apply(ctx: Context) {
      ctx.plugin(RaceDbService, { tag })
    },
  }
}

export async function runRaceCordis(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()
  const hits: string[] = []
  const transitions: string[] = []
  root.on('internal/status', (fiber, old) => {
    if (fiber.name === 'race-consumer') transitions.push(`${stateName(old)}→${stateName(fiber.state)}`)
  })

  const provider1 = await root.plugin(raceProvider('v1'))
  root.plugin({
    name: 'race-consumer',
    inject: ['racedb'],
    async apply(ctx) {
      const tag = ctx.racedb.tag // 本轮依赖快照
      await sleep(20)
      ctx.on('race/tick', () => hits.push(`run@${tag}`))
    },
  })
  out.push('[cordis] t+0 provider v1 + consumer 就位(consumer 的 apply 正在 sleep)')

  await sleep(10)
  await provider1.dispose()
  out.push(`[cordis] t+10 dispose provider v1 → consumer 状态轨迹:${transitions.join(' ')}(装载在途被拆,从未 ACTIVE;拆掉后回 PENDING 等新提供者)`)

  await sleep(25) // 迟到的注册在此发生:撞上 epoch 门,静默作废
  root.emit('race/tick')
  out.push(`[cordis] t+35 窗口期 emit → 命中 ${hits.length} 次(迟到注册已被代际作废)`)

  await root.plugin(raceProvider('v2'))
  await sleep(30) // consumer 自动重启(apply 第二轮)
  hits.length = 0
  root.emit('race/tick')
  out.push(`[cordis] t+70 新提供者到位后再 emit → 命中 ${hits.length} 次:${hits.join(' + ')}(只有 run@v2,无幽灵)`)

  await root.fiber.dispose()
  return out
}
