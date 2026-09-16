/**
 * demos/03 · 100 行自研版翻车现场 —— 按「先证明它行,再看它何时不行」串场
 *
 * 对应笔记:qa/02 §2.5(种子问题:"我自己很容易就能实现一个")
 * 运行:pnpm demo:03
 *
 * 论证线:
 *   ① naive 内核(约 110 行)先跑通快乐路径——顺序无关停靠/事件/逆序清理/级联重生
 *      (它不是稻草人,demo 02 概念三的同步场景它全会)
 *   ② 三个异步翻车现场,每个都是 naive 与真 Cordis 同时间线对照
 *   ③ 番外:形态陷阱(计划外发现,排查翻车一时挖出的 isConstructor 判别规则)
 *   结论:原语 100 行,不变量 754 行——付费点从来不在"能不能注册",在"世界变了以后还干不干净"。
 */
import { runRaceCordis, runRaceNaive } from './crash-1-race/race.ts'
import { runFormHazard } from './crash-1-race/form-hazard.ts'
import { runTeardownCordis, runTeardownNaive } from './crash-2-teardown-race/teardown-race.ts'
import { runStackCordis, runStackNaive } from './crash-3-stack/stack.ts'
import { NaiveKernel } from './naive/naive-kernel.ts'

const header = (title: string) => {
  console.log(`\n${'═'.repeat(62)}\n  ${title}\n${'═'.repeat(62)}`)
}

const play = (title: string, run: () => string[] | Promise<string[]>) => {
  header(title)
  return Promise.resolve(run()).then((lines) => {
    for (const line of lines) console.log(line)
  })
}

// ── 第〇幕:naive 内核不是稻草人(现场跑一个级联重生) ──────────────
await play('第〇幕 · naive 内核(约 110 行)的快乐路径——它真的能用', async () => {
  const kernel = new NaiveKernel()
  const runs: string[] = []
  const provider1 = kernel.plugin({ name: 'p1', apply: (ctx) => ctx.provide('db', { tag: 'v1' }) })
  kernel.plugin({
    name: 'consumer',
    inject: ['db'],
    apply: (ctx) => {
      runs.push(`run#${ctx.runId} 看到 ${ctx.service<{ tag: string }>('db').tag}`)
    },
  })
  kernel.dispose(provider1)
  kernel.plugin({ name: 'p2', apply: (ctx) => ctx.provide('db', { tag: 'v2' }) })
  return [
    '级联重生:dispose 提供者 → 依赖者拆掉重停靠 → 新提供者到位自动重跑',
    `  ${runs.join(' → ')}`,
    '(demo 02 概念三的同步场景它全部通过——见 naive/naive-kernel.test.ts,4 个用例)',
  ]
})

// ── 三个翻车现场:naive 与 cordis 同时间线对照 ─────────────────────
await play('翻车一 · 中途换依赖(竞态)—— 朴素版', runRaceNaive)
await play('翻车一 · 中途换依赖(竞态)—— 真 Cordis', runRaceCordis)
await play('翻车二 · 异步清理撕裂共享资源 —— 朴素版', runTeardownNaive)
await play('翻车二 · 异步清理撕裂共享资源 —— 真 Cordis', runTeardownCordis)
await play('翻车三 · 报错不知道找谁 —— 朴素版', runStackNaive)
await play('翻车三 · 报错不知道找谁 —— 真 Cordis', runStackCordis)

// ── 番外:形态陷阱 ────────────────────────────────────────────────
await play('番外 · 形态陷阱:plain function 返回 Promise = 脱离生命周期', runFormHazard)

header('结论:付费点清单(naive 省掉的,正是 fiber.ts 754 行在做的)')
const gaps: [string, string, string][] = [
  ['翻车一', '迟到副作用', 'epoch 代际作废:装载在途世界一变,带回的注册进废纸篓'],
  ['翻车二', '异步拆卸', 'inertia:dispose() 的 Promise 等所有 disposer 落地,换班严格串行'],
  ['翻车三', '异常与记账', '逐 disposer 隔离 + 注册点栈嫁接:兄弟不中断,错误指向注册现场'],
  ['番外', '形态判别', 'isConstructor 看 .prototype:插件主体用 async/箭头,别用返回 Promise 的普通函数'],
]
for (const [where, what, how] of gaps) console.log(`  ${where} · ${what}\n    → ${how}`)
console.log()
