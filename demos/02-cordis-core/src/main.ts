/**
 * demos/02 · Cordis 五概念 —— 按 guide/02 的论证顺序串场
 *
 * 对应笔记:笔记库 dsh-harness-tutorial/guide/02-cordis-core.md
 * 运行:pnpm demo:02
 *
 * 本 demo 与 demo 01 的分工:demo 01 手写了迷你内核,刻意省掉 inject/isolate/
 * fiber/事件分发(见其 README「刻意省了什么」);本 demo 用 npm 上的真 Cordis
 * (@deepseek-ai/cordis,即 dsh vendor 的同一版本 4.0.2)把欠的债还上——
 * 全程零 dsh 代码,证明 Cordis 可独立运行。
 */
import { runForms } from './plugin-forms/forms.ts'
import { runContainer } from './service-container/container.ts'
import { runDependency } from './inject-loading/dependency.ts'
import { runFiveModes } from './events-five-modes/five-modes.ts'
import { runDiscipline } from './events-five-modes/waterfall-discipline.ts'
import { runDisposal } from './reversible-effect/disposal.ts'
import { runHmr } from './reversible-effect/hmr.ts'

const header = (title: string) => {
  console.log(`\n${'═'.repeat(62)}\n  ${title}\n${'═'.repeat(62)}`)
}

const play = async (title: string, run: () => Promise<string[]>) => {
  header(title)
  for (const line of await run()) console.log(line)
}

await play('概念一 · 插件是实现服务的对象(三形态 + Config)', runForms)
await play('概念二 · 上下文是服务的容器(proxy / extend / isolate / intercept)', runContainer)
await play('概念三 · 用 inject 声明服务依赖(等待 / 级联 / 静默 PENDING)', runDependency)
await play('概念四 · 类型化事件(五种分发模式)', runFiveModes)
await play('概念四续 · waterfall 纪律:观察者必须调 next()', runDiscipline)
await play('概念五 · 注册是可逆的副作用(逆序清理 / INACTIVE_EFFECT)', runDisposal)
await play('概念五续 · HMR 最小模型:dispose 旧 fiber → 启动新 fiber', runHmr)

header('五概念 → dsh 对应物(guide/02 §2.7)')
const map: [string, string][] = [
  ['① 插件(函数/对象/类)', 'llm-deepseek 适配器、AgentLoop(类插件 + static inject + zod Config)'],
  ['② Context 服务容器', 'ctx.llm / ctx.tools / ctx.sessions;agent.ctx = isolate 出的局部世界'],
  ['③ inject 依赖驱动', 'AgentLoop 注入 agents/sessions/llm/tools/systemPrompt,最后启动'],
  ['④ 类型化事件', 'agent/pre-step、llm/stream、tools/pre-execute 瀑布;session/event 广播'],
  ['⑤ 可逆 effect', 'dsh --profile headless 退出时整棵插件树逆序拆除,HMR 无幽灵状态'],
]
for (const [concept, dsh] of map) console.log(`  ${concept}\n    → ${dsh}`)
console.log()
