/**
 * 目标:锁定 demos/07 的行为——真实 dsh 进程 + mock patch 的全链路 e2e、「配置即
 *       行为」的失败路径(教程实验 3)、dump-config 静态检查。
 * 思路:三个用例共用 runHeadless 与 mock.patch.yml:①干净 tmp DSH_HOME 跑通一次
 *       对话,断言 stdout 回复 + 会话日志的路由(request/header→mock)、turn 闭环
 *       (turn/end completed)、回复落盘(data.message.content)、注入上下文可见
 *       (user/message ≥ 3 条——模型看到的就是记录到的);②变体 patch 把
 *       agent-default-model 路由到不存在的 provider,断言 NO_ADAPTER 失败;③
 *       --dump-config 不启动任何插件,断言组合树里能看到被覆盖的路由。
 * 对照:教程 demos/05-headless-mock 的预期输出与「亲手做实验」;guide/03/05/07;
 *       本仓库 demos/06(适配器协议义务)。
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { readLatestSession } from './read-session.ts'
import { runHeadless } from './run-headless.ts'

const PATCH = fileURLToPath(new URL('../mock.patch.yml', import.meta.url))
const PLUGIN_URL = new URL('../plugins/mock-adapter.ts', import.meta.url).href

describe('demos/07:真实 dsh 进程 + mock patch 全链路', () => {
  it('e2e:零网络零 API Key 跑通 turn/step/持久化,日志可审计', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-07-e2e-'))
    const run = await runHeadless({ home, patch: PATCH, task: '你好,介绍一下你自己' })

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('（MockAdapter，无需网络与 API Key）')
    expect(run.stdout).toContain('provider=mock')

    const { rows } = readLatestSession(home)

    // 请求真的路由到了 mock:配置即行为
    const header = rows.find((r) => r.type === 'request/header')
    const headerData = (header?.data ?? {}) as { header?: { config?: { provider?: string; model?: string } } }
    expect(headerData.header?.config?.provider).toBe('mock')

    // turn 正常闭环:真实状态机走完了
    const turnEnd = rows.find((r) => r.type === 'turn/end')
    expect((turnEnd?.data as { reason?: { kind?: string } } | undefined)?.reason?.kind).toBe('completed')

    // 回复完整落盘(0.1.6 载荷在 data.message.content——版本差实录)
    const assistant = rows.find((r) => r.type === 'assistant/message')
    const content = ((assistant?.data as { message?: { content?: { type: string; text?: string }[] } } | undefined)?.message?.content) ?? []
    expect(content.some((b) => b.type === 'text' && (b.text ?? '').includes('收到你的消息'))).toBe(true)

    // 「模型可见即已记录」:任务之外,注入上下文(workspace 指令/runtime 快照/skills)也全在日志里
    const userRows = rows.filter((r) => r.type === 'user/message')
    expect(userRows.length).toBeGreaterThanOrEqual(3)
  }, 180_000)

  it('教程实验 3(配置即行为):路由到不存在的 provider → NO_ADAPTER 失败', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-07-noadapter-'))
    // 变体 patch 写在 tmp:插件名必须用 file:// 绝对 URL(解析基准是 patch 文件所在目录)
    const patch = join(home, 'no-such.patch.yml')
    writeFileSync(patch, [
      '- insert:',
      '    - id: mock-adapter',
      `      name: ${PLUGIN_URL}`,
      '',
      '- id: agent-default-model',
      '  config:',
      '    provider: no-such-provider',
      '    model: mock-1',
      '',
    ].join('\n'))

    const run = await runHeadless({ home, patch, task: '你好' })
    expect(run.status).not.toBe(0)
    expect(run.stderr + run.stdout).toContain('NO_ADAPTER')
  }, 180_000)

  it('dump-config:组合树静态检查——不启动任何插件即可看到被覆盖的路由', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-07-dump-'))
    const run = await runHeadless({ home, patch: PATCH, extraArgs: ['--dump-config'] })

    expect(run.status).toBe(0)
    // 层标记:dsh-base / dsh-headless / patch,组合过程可见
    expect(run.stdout).toContain('# == @deepseek-ai/dsh-base')
    // 定向替换生效:默认模型路由已是 mock
    expect(run.stdout).toContain('id: agent-default-model')
    expect(run.stdout).toContain('provider: mock')
  }, 60_000)
})
