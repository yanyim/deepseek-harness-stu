/**
 * 目标:概念五「注册是可逆的副作用」——所有注册都是 effect,插件卸载时逆序撤销;
 *       在已死的上下文上注册会得到 INACTIVE_EFFECT;非托管资源必须包进 ctx.effect。
 * 思路:一个"满配"插件同时注册监听器、服务、三个 ctx.effect 和一个静默定时器;
 *       dispose 后观察:清理逆序(C→B→A)、监听器消失、服务消失、定时器真的停了
 *       (卸载后两次采样计数不变)。
 * 对照:vendor/cordis/src/fiber.ts 的 _unload(逆序 clear _disposables)与
 *       CordisError.Code.INACTIVE_EFFECT;官方文档 cordis-tutorial/02 的三点注意事项。
 */
import { CordisError, Context, Service } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sink: SinkService
  }
  interface Events {
    'dispose/knock'(): void
  }
}

class SinkService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sink')
  }
  ping() {
    return 'pong'
  }
}

export async function runDisposal(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  let ticks = 0
  const kitchenSink = {
    name: 'kitchen-sink',
    apply(ctx: Context) {
      ctx.on('dispose/knock', () => {
        out.push('[生前] 监听器听到 knock')
      })
      ctx.effect(() => () => out.push('[卸载] effect C 清理(最先注册,最后清理)'))
      ctx.effect(() => {
        const timer = setInterval(() => {
          ticks += 1 // 非托管资源:不包进 effect 就是泄漏;包了就交给框架
        }, 5)
        return () => {
          clearInterval(timer)
          out.push('[卸载] effect B 清理(定时器已 clearInterval)')
        }
      })
      ctx.effect(() => () => out.push('[卸载] effect A 清理(最后注册,最先清理)'))
      ctx.plugin(SinkService)
    },
  }

  const fiber = await root.plugin(kitchenSink)
  root.emit('dispose/knock')
  out.push(`[生前] ctx.sink.ping() = ${root.sink.ping()}`)
  await new Promise((resolve) => setTimeout(resolve, 25)) // 让定时器先跑几拍,待会儿才有"冻结"可言

  // ── 卸载:一个 dispose 调用,全部登记在案的副作用逆序撤销 ──
  await fiber.dispose()
  root.emit('dispose/knock')
  out.push('[卸载后] 再 emit knock → 没有新的〔监听器〕行')
  out.push(`[卸载后] ctx.sink = ${String((root as { sink?: SinkService }).sink)}`)

  // 定时器真的停了:卸载后隔两段采样,计数不再增长
  await new Promise((resolve) => setTimeout(resolve, 30))
  const first = ticks
  await new Promise((resolve) => setTimeout(resolve, 30))
  out.push(`[卸载后] 定时器计数冻结:${first === ticks ? `是(两次采样都是 ${ticks})` : `否(${first} → ${ticks},泄漏!)`}`)

  // ── 已死上下文上注册:不是静默,是 INACTIVE_EFFECT ──
  try {
    fiber.ctx.on('dispose/knock', () => {
      void 0
    })
    out.push('不该到这里:死 ctx 上注册应当抛 INACTIVE_EFFECT')
  } catch (error) {
    const code = error instanceof CordisError ? error.code : String(error)
    out.push(`[死后] 在已卸载插件的 ctx 上 ctx.on → CordisError ${code}`)
  }

  await root.fiber.dispose()
  return out
}
