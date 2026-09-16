/**
 * 目标:概念一「插件是实现服务的对象」——三种合法形态地位平等,外加 Config 元数据。
 * 思路:同一个根上下文依次挂载函数/对象/类插件,各自在 apply 里记一行剧本;
 *       再用手写的 Standard Schema v1 做配置校验,演示"配错时启动即报错"。
 * 对照:vendor/cordis/src/registry.ts 的 `Plugin` 联合类型与 `resolveConfig`(校验入口);
 *       dsh 的 AgentLoop(packages/core/agent-loop)是"类插件 + static inject + zod Config"的满配形态。
 *
 * 为什么函数就能当插件?插件的全部职责是"对上下文做点事"(注册服务、挂监听器、
 * 产生副作用),不需要实现特定接口——约定一个签名 (ctx, config),剩下交给组合。
 */
import { Context } from '@deepseek-ai/cordis'

import { stateName } from '../stage/fiber-trace.ts'

// 类型化事件:声明合并注册签名(概念四的前菜——这里只用 emit 同步广播)
declare module '@deepseek-ai/cordis' {
  interface Events {
    'forms/bump'(): void
  }
}

/** 手写的 Standard Schema v1(不引 zod,证明协议是开放的:~standard.validate 即可)。 */
const prefixSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'demo-02',
    validate(raw: unknown) {
      if (typeof raw !== 'object' || raw === null || typeof (raw as { prefix?: unknown }).prefix !== 'string') {
        return { issues: [{ message: 'prefix 必须是 string', path: [] }] }
      }
      return { value: { prefix: (raw as { prefix: string }).prefix } }
    },
  },
}

export async function runForms(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  // ── 形态一:函数插件。约定签名即插件,inject 元数据声明"我不依赖任何服务" ──
  function clockPlugin(ctx: Context, config: { prefix: string }) {
    void ctx // 函数插件拿到 ctx 才能注册副作用;本形态只演示最小约定
    out.push(`[形态一·函数] ${config.prefix} hello`)
  }
  clockPlugin.inject = [] as string[]
  await root.plugin(clockPlugin, { prefix: 'tick' })

  // ── 形态二:对象插件。name 用于诊断(日志/fiber 名),apply 是入口 ──
  const listenerPlugin = {
    name: 'listener-plugin',
    apply(ctx: Context) {
      out.push('[形态二·对象] apply 运行')
    },
  }
  await root.plugin(listenerPlugin)

  // ── 形态三:类插件。构造函数即 apply;需要跨生命周期持有状态时选它 ──
  class CounterPlugin {
    count = 0
    constructor(ctx: Context) {
      // ctx.on 注册的是 effect:本插件卸载时自动移除(概念五展开)
      ctx.on('forms/bump', () => {
        this.count += 1
      })
      root.emit('forms/bump')
      out.push(`[形态三·类] 构造即 apply,count=${this.count}`)
    }
  }
  await root.plugin(CounterPlugin)

  // ── 元数据 Config:标准 schema 校验,配错时启动即报错(fiber FAILED,不炸进程) ──
  const configured = {
    name: 'greeter-config',
    Config: prefixSchema,
    apply(ctx: Context, config: { prefix: string }) {
      void ctx
      out.push(`[Config] 校验通过,apply 收到 = ${JSON.stringify(config)}`)
    },
  }
  // 同一个插件对象可以多次挂载:registry 以回调为身份,每次 ctx.plugin 产出一个新 fiber。
  // 注意:schema 的类型推断其实已经把 config 收紧成 { prefix: string }(多传/传错都编译报错);
  // 真实世界 config 常来自 YAML 等无类型来源,运行时校验才是兜底——所以这里刻意 as 放宽,
  // 演示运行时那条防线。
  const raw = { prefix: 'hello', extra: '多余字段,看 schema 认不认' } as { prefix: string }
  await root.plugin(configured, raw)

  const bad = root.plugin(configured, { prefix: 42 } as unknown as { prefix: string })
  try {
    await bad
    out.push('[Config] 不该到这里:校验失败应当在 await 时抛错')
  } catch (error) {
    out.push(`[Config] await fiber 抛错:${error instanceof Error ? error.constructor.name : String(error)}`)
  }
  out.push(`[Config] 坏配置的 fiber 终态:${stateName(bad.state)}(状态可见,进程仍活着)`)

  await root.fiber.dispose()
  return out
}
