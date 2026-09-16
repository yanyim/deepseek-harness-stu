/**
 * 目标:把概念三+五拼成 HMR 的最小模型——热重载 = dispose 旧 fiber(逆序撤销全部
 *       effect)→ 用新代码启动新 fiber;中途没有任何幽灵状态残留。
 * 思路:插件工厂产出 v1/v2 两个"版本"(新代码 = 新的插件对象);v1 注册事件监听器
 *       和服务后,模拟"编辑保存":卸载 v1、挂载 v2;再派发事件验证只有 v2 回应,
 *       服务已是新实现;状态轨迹显示 v1 走完 UNLOADING→DISPOSED、v2 完整激活。
 * 对照:@deepseek-ai/cordis-plugin-hmr(监听文件变化,做的正是这两步);
 *       官方文档 cordis-tutorial/06 的 HMR 一节;dsh 的 profile 热更新同理
 *       (loader 按 id 比较配置项,只动变化的部分)。
 */
import { Context, Service } from '@deepseek-ai/cordis'

import { traceStates } from '../stage/fiber-trace.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    greetings: GreetingService
  }
  interface Events {
    'hmr/ask'(): void
  }
}

/** 服务即类插件:构造签名 (ctx, config) 恰好就是类插件的约定。 */
class GreetingService extends Service {
  message: string

  constructor(ctx: Context, config: { message: string }) {
    super(ctx, 'greetings')
    this.message = config.message
  }
}

export async function runHmr(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()
  const trace = traceStates(root, (name) => name.startsWith('plugin'))

  // 用闭包记录器让监听器能写入剧本(闭包世界里的"控制台")
  const responses: string[] = []
  function makeVersioned(version: string, greeting: string) {
    return {
      name: `plugin-v${version}`,
      apply(ctx: Context) {
        ctx.on('hmr/ask', () => {
          responses.push(`v${version} 回应:${greeting}`)
        })
        // 子插件随父插件一同 dispose——v1 卸载时,它挂的服务也自动撤销
        ctx.plugin(GreetingService, { message: `来自 v${version} 的问候:${greeting}` })
      },
    }
  }

  const fiber1 = await root.plugin(makeVersioned('1', 'hello'))
  root.emit('hmr/ask')
  out.push(`[v1 运行中] 事件回应 = ${responses.join(' / ')}`)
  out.push(`[v1 运行中] 服务问候 = ${root.greetings.message}`)

  // ── 模拟"编辑插件文件并保存":dispose 旧 fiber → 启动新 fiber ──
  responses.length = 0
  await fiber1.dispose()
  await root.plugin(makeVersioned('2', '你好'))
  root.emit('hmr/ask')
  out.push(`[热重载后] 事件回应 = ${responses.join(' / ')}(v1 的监听器没有复活)`)
  out.push(`[热重载后] 服务问候 = ${root.greetings.message}(新实现)`)

  out.push('[状态轨迹] v1 走完卸载,v2 完整激活:')
  for (const line of trace) out.push(`  ${line}`)

  await root.fiber.dispose()
  return out
}
