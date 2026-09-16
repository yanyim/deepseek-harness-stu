/**
 * 目标:waterfall 的头号纪律——「只观察的监听器必须调 next()」。忘调 next() 不是
 *       报错,而是静默吞掉整条链的默认行为;在 dsh 里,这就是"模型请求再也发不出去"。
 * 思路:模拟一个 llm/request 瀑布事件,默认行为返回模型回复。依次:
 *       无监听 → 回复正常;挂一个"只打日志"的审计监听器但忘调 next() → 回复变 undefined;
 *       修复(补 return next())→ 回复恢复、审计仍在。
 * 对照:guide/02 §2.5 的警告框;官方文档 cordis-tutorial/04 的 waterfall 纪律一节;
 *       dsh 的 packages/llm/llm/src/invariant.ts——它自己就是 llm/stream 的合法包裹者(调了 next)。
 */
import { Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'discipline/llm-request'(prompt: string, next: () => Promise<string>): Promise<string>
  }
}

/** 默认行为:真正"发出模型请求"的兜底逻辑。 */
function dispatch(root: Context, prompt: string): Promise<string> {
  return root.waterfall('discipline/llm-request', prompt, async () => `模型回复:好的(${prompt})`)
}

export async function runDiscipline(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  // ── 基线:没有任何监听器,waterfall 直接落到默认行为 ──
  out.push(`[基线] ${await dispatch(root, '写首诗')}`)

  // ── bug 现场:审计监听器"只想打个日志",却忘了调 next() ──
  // 注意:类型层其实抓得住这个 bug——忘调 next() 的返回是 Promise<void>,
  // 与事件签名 Promise<string> 不符,编译器会报 TS2345。这里刻意 @ts-expect-error
  // 压制它,演示"如果类型没拦住(比如 any、动态注册),运行时会发生什么"。
  // @ts-expect-error 忘调 next():返回 void 不满足事件签名
  const removeAudit = root.on('discipline/llm-request', async (prompt, next) => {
    out.push(`  [审计] 观察到请求:${prompt}`)
    // ← 这里忘了 return next():函数隐式返回 undefined
    void next
  })
  const swallowed = await dispatch(root, '写首诗')
  out.push(`[bug] waterfall 返回 = ${String(swallowed)}`)
  out.push('  日志打上了,但模型回复被吞了——默认行为从未运行,也没有任何报错')

  // ── 修复:观察者的纪律——无条件委托 ──
  removeAudit() // ctx.on 返回 disposer,手动移除(插件卸载时也会自动移除)
  root.on('discipline/llm-request', async (prompt, next) => {
    out.push(`  [审计] 观察到请求:${prompt}`)
    return next() // 只读监听必须委托
  })
  out.push(`[修复] ${await dispatch(root, '写首诗')}`)

  await root.fiber.dispose()
  return out
}
