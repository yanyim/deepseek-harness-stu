/**
 * 目标:Demo 07 串场入口——零网络、零 API Key,把 Mock 适配器塞进真实 dsh 进程
 *       跑通 Agent 全链路。叙事顺序=论证顺序:先静态看组合树(patch 改了什么),
 *       再动态跑一次任务(链路真的在转),最后打开会话日志看「模型实际看到了
 *       什么」(模型可见即已记录)。
 * 思路:与测试共用 runHeadless/read-session;DSH_HOME 用本 demo 目录下的
 *       .dsh-home(保留现场供手动复看,测试里才用 tmp 隔离)。
 * 对照:教程 demos/05-headless-mock 的运行-验证流程;guide/03(架构)§patch 覆盖层。
 */
import { fileURLToPath } from 'node:url'

import { readLatestSession, summarize } from './read-session.ts'
import { runHeadless } from './run-headless.ts'

const HERE = fileURLToPath(new URL('..', import.meta.url))
const HOME = `${HERE}.dsh-home`
const PATCH = `${HERE}mock.patch.yml`

// ── §1 命题:能不能不碰网络,跑一次「真」的 Agent?──────────────────────
// 真的定义:真实的 boot/profile 组合、真实的 turn/step 状态机、真实的系统提示词
// 装配、真实的会话持久化——只有模型是假的。patch 覆盖层只改两行配置。

// ── §2 静态:先看 patch 改了组合树的哪里(不启动任何插件)──────────────
const dump = await runHeadless({ home: HOME, patch: PATCH, extraArgs: ['--dump-config'] })
const treeLines = dump.stdout.split('\n')
const at = treeLines.findIndex((l) => l.includes('id: agent-default-model'))
console.log('§2 dump-config(组合树,不启动插件):')
for (const line of treeLines.slice(Math.max(at - 1, 0), at + 4)) console.log(`  ${line}`)
console.log('  (dsh-base → dsh-headless → mock.patch.yml 三层叠加,agent-default-model 被定向替换)\n')

// ── §3 动态:真实跑一次任务 ────────────────────────────────────────────
console.log('§3 真实 dsh --profile headless --patch mock.patch.yml "你好,介绍一下你自己":')
const run = await runHeadless({ home: HOME, patch: PATCH, task: '你好,介绍一下你自己' })
console.log(`  exit=${run.status}`)
console.log(`  stdout: ${run.stdout.trim()}`)
console.log('  (boot→loader→插件→agent-loop→持久化整条链路原样运转,只有模型是假的)\n')

// ── §4 审计:打开会话日志,看模型实际看到了什么 ─────────────────────────
const { file, rows } = readLatestSession(HOME)
console.log(`§4 会话日志(${file.split('/').slice(-2).join('/')}):共 ${rows.length} 行`)
for (const row of rows) {
  console.log(`  ${String(row.seq ?? '-').padStart(4)} ${row.type.padEnd(24)} ${summarize(row)}`)
}
console.log(`
  三个观察点:
  ① 任务只是 user/message 的第 1 条——workspace 指令、runtime 快照、skills 提醒
     都以 user-role 注入排在后面;模型看到的一切,日志里全有。
  ② request/header 的路由是 mock/mock-1——「配置即行为」的落盘证据。
  ③ session/title-llm-request 也路由到 mock:标题生成这类辅助调用走同一条接缝。
  (0.1.6 版本差:v3 格式不再逐 chunk 落盘,教程 0.1.0-rc.6 的 1.1 万行
   assistant/chunk 已收敛为一条组装好的 assistant/message)`)
