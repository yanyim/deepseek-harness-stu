/**
 * 目标:概念二「上下文是服务的容器」——服务占一个稳定的 ctx.<key>,查找靠 key 不靠
 *       import;以及三种作用域派生 extend / isolate / intercept 如何"不改父级"。
 * 思路:一个服务类 + 声明合并,依次观察:proxy 解析(挂载前 undefined)、同名服务
 *       重复注册报错、extend 原型继承、isolate 给单个 agent 一个"局部世界"、
 *       intercept 为下方服务合并配置。
 * 对照:vendor/cordis/src/context.ts 的 extend/isolate/intercept 实现;
 *       vendor/cordis/src/service.ts 的 [Service.resolveConfig](intercept 合并逻辑);
 *       dsh 里 ctx.llm / ctx.tools / ctx.sessions 全部经此机制;agent.ctx 即 isolate 的产物。
 */
import { Context, Service } from '@deepseek-ai/cordis'

// 声明合并:类型层让 ctx.greeter / ctx.llm 有类型;泛型参数是 intercept 配置的类型(幽灵类型)
declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService
    llm: DemoLlmService
  }
}

export class GreeterService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greeter') // 这一行就是服务注册:内部调 ctx.reflect.provide,本身是 effect
  }
  greet(who: string) {
    return `你好,${who}!`
  }
}

/** 演示 intercept 用:构造时经 resolveConfig 合并祖先 intercept 配置。 */
interface LlmConfig {
  model: string
  temperature: number
}

export class DemoLlmService extends Service<LlmConfig> {
  temperature: number

  constructor(ctx: Context, config?: LlmConfig) {
    super(ctx, 'llm')
    // Service.resolveConfig:沿祖先 intercept 链合并(base 优先级最低,越近的 intercept 越高)
    const merged = this[Service.resolveConfig]({ model: 'deepseek-chat', temperature: 0.7 })
    this.temperature = merged.temperature
    void config // 插件 config 与 intercept 配置是两条通道,这里只演示 intercept
  }
  generate(prompt: string) {
    return `${prompt} @t=${this.temperature}`
  }
}

export async function runContainer(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  // ── 服务解析:读 ctx.greeter 是一次 proxy 拦截,转交服务解析器 ──
  out.push(`挂载前 ctx.greeter = ${String((root as { greeter?: GreeterService }).greeter)}`)
  await root.plugin(GreeterService)
  out.push(`挂载后 ctx.greeter.greet('Cordis') = ${root.greeter.greet('Cordis')}`)

  // ── 一个服务一个坑:同名再注册直接报错(dsh 的 llm/tools 也靠这个保证单实现) ──
  try {
    await root.plugin(GreeterService)
    out.push('不该到这里:同名服务二次注册应当抛错')
  } catch (error) {
    out.push(`同名二次注册:${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
  }

  // ── extend:子上下文原型继承父级全部属性,自有 meta 遮蔽;父级不被修改 ──
  const child = root.extend({ extra: 'meta' })
  out.push(`extend 后 child.greeter 仍可用(原型链)= ${child.greeter.greet('child')}`)
  out.push(`child.extra = ${(child as { extra?: string }).extra},root.extra = ${(root as { extra?: string }).extra}`)

  // ── isolate:给单个 agent 一个"局部世界"。root 的 greeter 不受影响 ──
  class FastGreeter extends Service {
    constructor(ctx: Context) {
      super(ctx, 'greeter') // 注册进的是 agentA 的隔离作用域,不是全局
    }
    greet(who: string) {
      return `FAST(${who})`
    }
  }
  const agentA = root.isolate('greeter')
  await agentA.plugin(FastGreeter)
  out.push(`agentA(隔离)看到的 greeter = ${agentA.greeter.greet('agentA')}`)
  out.push(`root 看到的 greeter 仍是原实现 = ${root.greeter.greet('root')}`)
  const agentB = root.isolate('greeter') // 新 label = 又一个空世界
  out.push(`agentB(另一个隔离)没注册过 greeter = ${String((agentB as { greeter?: GreeterService }).greeter)}`)

  // ── intercept:为下方构造的服务合并配置;作用域只影响"构造时解析到什么",不改父级 ──
  const careful = root.intercept('llm', { temperature: 0.2 })
  await careful.plugin(DemoLlmService)
  out.push(`intercept(t=0.2) 下构造的 llm.generate = ${careful.llm.generate('写代码')}`)
  out.push(`(intercept 只改变构造配置;服务注册后全局可见,root.llm 同一个实例)`)

  // 换个干净 root 验证:没有 intercept 时,resolveConfig 只有 base 默认值 t=0.7
  const plain = new Context()
  await plain.plugin(DemoLlmService)
  out.push(`无 intercept 的 root 下 llm.generate = ${plain.llm.generate('写代码')}`)

  await root.fiber.dispose()
  await plain.fiber.dispose()
  return out
}
