/**
 * 目标:翻车现场三「报错不知道找谁」——两个 effect,后注册的那个清理时会抛错。
 *       从远处触发卸载,对比:异常是否冒泡中断兄弟清理、错误栈里有没有注册现场。
 * 思路:naive 的 dispose 是无保护的反向 for 循环:一个 disposer 抛错 → 异常冒泡、
 *       循环中断 → 先注册的兄弟 disposer 永不执行(资源泄漏);栈里只有抛错点与
 *       触发点,注册点无从谈起。Cordis 逐 disposer 隔离(composeError 包裹,错误
 *       记日志不冒泡不中断),且把注册时的调用栈快照嫁接进错误栈——栈同时含
 *       "谁注册的"与"哪里炸的"。
 * 对照:vendor/cordis/src/fiber.ts 的 _unload(逐个 composeError + logger.error)、
 *       vendor/cordis/src/utils.ts 的 composeError/buildOuterStack/handleError(长栈嫁接)。
 */
import { Context } from '@deepseek-ai/cordis'

import { NaiveKernel } from '../naive/naive-kernel.ts'

interface Resource {
  cleaned: boolean
}

const resourceB: Resource = { cleaned: false }

// ───────────────────────────── naive 侧 ─────────────────────────────

/** 注册现场:naive 内核不记录任何栈,这个名字只会存在于源码里,不会出现在错误栈里。 */
function naiveMountBroken(kernel: NaiveKernel) {
  return kernel.plugin({
    name: 'naive-broken',
    apply: (ctx) => {
      ctx.effect(() => () => {
        resourceB.cleaned = true // 先注册 → 逆序后执行
      })
      ctx.effect(() => () => {
        throw new Error('清理 A 时炸了:连接已失效') // 后注册 → 逆序先执行,炸了
      })
    },
  })
}

/** 卸载触发点:离注册现场很远。 */
function naiveFarTrigger(kernel: NaiveKernel, record: ReturnType<NaiveKernel['plugin']>): Error | undefined {
  try {
    kernel.dispose(record)
    return undefined
  } catch (error) {
    return error as Error
  }
}

export function runStackNaive(): string[] {
  const out: string[] = []
  const kernel = new NaiveKernel()
  const record = naiveMountBroken(kernel)
  const caught = naiveFarTrigger(kernel, record)

  out.push(`[naive] 远处触发卸载 → 异常冒出:${caught?.message ?? '(没抛?!)'}`)
  out.push(`[naive] resourceB.cleaned = ${resourceB.cleaned}(逆序先执行的 disposer 炸了,兄弟被中断 → 泄漏)`)
  const stack = caught?.stack ?? ''
  out.push(`[naive] 错误栈里有注册现场 naiveMountBroken?${stack.includes('naiveMountBroken') ? '是' : '否(内核不记账,注册点无从查起)'}`)
  return out
}

// ───────────────────────────── cordis 侧 ─────────────────────────────

const cordisResourceB: Resource = { cleaned: false }

/** 注册现场:这个名字会被 buildOuterStack 的快照带进错误栈(长栈嫁接)。 */
function cordisMountBroken(root: Context) {
  return root.plugin({
    name: 'cordis-broken',
    apply(ctx: Context) {
      ctx.effect(() => () => {
        cordisResourceB.cleaned = true
      })
      ctx.effect(() => () => {
        throw new Error('清理 A 时炸了:连接已失效')
      })
    },
  })
}

/** 卸载触发点:离注册现场很远。 */
async function cordisFarTrigger(fiber: { dispose: () => Promise<void> }): Promise<void> {
  await fiber.dispose()
}

export async function runStackCordis(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()
  const captured: string[] = []
  // 拦截 logger 收集清理错误(探针已验证此法可行;错误在 _unload 里被逐个隔离记日志)
  ;(root.logger as { error: (...args: unknown[]) => void }).error = (...args: unknown[]) => {
    for (const arg of args) if (arg instanceof Error) captured.push(arg.stack ?? String(arg))
  }

  const fiber = await cordisMountBroken(root)
  await cordisFarTrigger(fiber)

  out.push(`[cordis] 远处触发卸载 → 异常被逐 disposer 隔离记入 logger,不冒泡、不中断(捕获 ${captured.length} 条)`)
  out.push(`[cordis] resourceB.cleaned = ${cordisResourceB.cleaned}(兄弟照常清理,无泄漏)`)
  const stack = captured[0] ?? ''
  out.push(`[cordis] 错误栈里有注册现场 cordisMountBroken?${stack.includes('cordisMountBroken') ? '是(长栈:抛错现场 + 注册现场)' : '否'}`)
  await root.fiber.dispose()
  return out
}
