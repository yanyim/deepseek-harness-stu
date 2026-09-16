/**
 * 目标:概念三「用 inject 声明服务依赖」——加载顺序由依赖推导,不由人工编排;
 *       依赖消失触发级联卸载再等待;未满足的依赖不是错误,是 PENDING 等待状态。
 * 思路:consumer 先挂载、provider 后挂载,观察 PENDING → 自动激活;卸载 provider
 *       观察 consumer 级联回 PENDING;换新 provider 观察 consumer 拿到新实现;
 *       最后演示"inject 拼写错误 = 永远静默 PENDING"及其诊断手段。
 * 对照:vendor/cordis/src/registry.ts 的 Inject.resolve;vendor/cordis/src/fiber.ts 的
 *       _checkImpl/_reload(PENDING 的判定与激活);dsh 的 AgentLoop 声明
 *       static inject = ['agents','sessions','llm','tools','systemPrompt',...],
 *       是"最后启动的那批插件"——不是因为写在最后,而是因为依赖最深。
 */
import { Context, Service } from '@deepseek-ai/cordis'

import { diagnosePending, stateName, traceStates } from '../stage/fiber-trace.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    toolbox: ToolboxService
  }
}

/** 提供方一:工具箱服务。 */
export class ToolboxService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'toolbox')
  }
  list(): string[] {
    return ['read_file', 'write_file']
  }
}

/** 提供方二:同名服务的另一实现(演示级联后"等新的提供者出现再启动")。 */
export class RichToolboxService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'toolbox')
  }
  list(): string[] {
    return ['read_file', 'write_file', 'web_search', 'run_code']
  }
}

export async function runDependency(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()
  const trace = traceStates(root, (name) => ['toolboxConsumer', 'ToolboxService', 'RichToolboxService'].includes(name))

  // 消费方:inject ['toolbox']——框架负责等,apply 里 toolbox 一定就绪
  const consumerRuns: string[] = []
  function toolboxConsumer(ctx: Context) {
    consumerRuns.push(`  [consumer] apply 运行,看到工具:${ctx.toolbox.list().join(' + ')}`)
  }
  toolboxConsumer.inject = ['toolbox']

  // ── 顺序无关:consumer 先挂,provider 后到 ──
  const consumerFiber = root.plugin(toolboxConsumer)
  await new Promise((resolve) => setTimeout(resolve, 20)) // 给调度器一个呼吸
  out.push('[顺序无关] consumer 先挂载,provider 还没来:')
  out.push(`  apply 执行了吗?${consumerRuns.length} 次;PENDING 诊断 = [${diagnosePending(root).join(', ')}]`)

  const toolboxFiber = await root.plugin(ToolboxService)
  await consumerFiber
  out.push('  provider 后到,依赖满足自动激活:')
  out.push(consumerRuns[0])

  // ── 级联:provider 卸载 → consumer 跟着卸载,回到 PENDING 等新提供者 ──
  consumerRuns.length = 0
  await toolboxFiber.dispose()
  await new Promise((resolve) => setTimeout(resolve, 20))
  out.push('[级联] provider 卸载后:')
  out.push(`  consumer 状态 = ${stateName(consumerFiber.state)}(不是 DISPOSED——它在等)`)

  // ── 新提供者出现 → consumer 用新实现重新启动(这就是 HMR 的地基) ──
  await root.plugin(RichToolboxService)
  await new Promise((resolve) => setTimeout(resolve, 20))
  out.push('  新 provider 到位,consumer 自动重启:')
  out.push(consumerRuns[0])

  // ── 状态轨迹回放:依赖驱动的全部迁移 ──
  out.push('[状态轨迹] fiber 迁移回放:')
  for (const line of trace) out.push(`  ${line}`)

  // ── 拼写错误:静默的 PENDING(FAQ 常客) ──
  const typoRoot = new Context()
  function misspelled(ctx: Context) {
    void ctx
    return undefined
  }
  // 少写个 box:core 的数组 inject 是 string[],类型层不拦(见本单元 test 的类型断言)
  misspelled.inject = ['tools']
  const typoFiber = typoRoot.plugin(misspelled)
  await new Promise((resolve) => setTimeout(resolve, 20))
  out.push('[拼写错误] inject: [\'tools\'](少个 box)之后:')
  out.push(`  fiber 状态 = ${stateName(typoFiber.state)} — 不报错、不执行、无日志`)
  out.push(`  registry 诊断:PENDING 的插件 = [${diagnosePending(typoRoot).join(', ')}]`)

  // ── ctx.inject 速记:一次性的依赖回调 = 匿名插件,同样依赖驱动 ──
  // 先声明回调(此刻 toolbox 还没有,回调停在 PENDING),再挂提供者,回调自动触发
  out.push('[ctx.inject] 一次性依赖回调(先声明、后满足):')
  const helperFiber = typoRoot.inject({ toolbox: null }, (ctx) => {
    out.push(`  回调运行:${ctx.toolbox.list().join(' + ')} — 先声明后满足,自动触发`)
  })
  await typoRoot.plugin(ToolboxService)
  await helperFiber

  await root.fiber.dispose()
  await typoRoot.fiber.dispose()
  return out
}
