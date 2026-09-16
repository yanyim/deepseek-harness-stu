/**
 * 目标:锁定概念三的行为——依赖未满足是 PENDING 不是错误;provider 后到自动激活;
 *       provider 卸载触发级联(consumer 回 PENDING 而非 DISPOSED);新 provider
 *       到位后 consumer 拿新实现重启;拼错的 inject 永远静默。
 * 思路:runDependency 剧本整列 toEqual(状态轨迹回放行一并锁定);
 *       类型断言演示数组 inject 的松类型是 FAQ 的根源。
 * 对照:vendor/cordis/src/fiber.ts 的 _checkImpl/_reload/_unload。
 */
import { describe, expect, it } from 'vitest'

import { Context } from '@deepseek-ai/cordis'

import { runDependency } from './dependency.ts'

describe('概念三:用 inject 声明服务依赖', () => {
  it('等待 → 激活 → 级联 → 重启,以及拼写错误的静默 PENDING', async () => {
    const lines = await runDependency()
    expect(lines).toEqual([
      '[顺序无关] consumer 先挂载,provider 还没来:',
      '  apply 执行了吗?0 次;PENDING 诊断 = [toolboxConsumer]',
      '  provider 后到,依赖满足自动激活:',
      '  [consumer] apply 运行,看到工具:read_file + write_file',
      '[级联] provider 卸载后:',
      '  consumer 状态 = PENDING(不是 DISPOSED——它在等)',
      '  新 provider 到位,consumer 自动重启:',
      '  [consumer] apply 运行,看到工具:read_file + write_file + web_search + run_code',
      '[状态轨迹] fiber 迁移回放:',
      '  ToolboxService: PENDING -> LOADING',
      '  ToolboxService: LOADING -> ACTIVE',
      '  toolboxConsumer: PENDING -> LOADING',
      '  toolboxConsumer: LOADING -> ACTIVE',
      '  ToolboxService: ACTIVE -> UNLOADING',
      '  toolboxConsumer: ACTIVE -> UNLOADING',
      '  toolboxConsumer: UNLOADING -> PENDING',
      '  ToolboxService: UNLOADING -> DISPOSED',
      '  RichToolboxService: PENDING -> LOADING',
      '  RichToolboxService: LOADING -> ACTIVE',
      '  toolboxConsumer: PENDING -> LOADING',
      '  toolboxConsumer: LOADING -> ACTIVE',
      "[拼写错误] inject: ['tools'](少个 box)之后:",
      '  fiber 状态 = PENDING — 不报错、不执行、无日志',
      '  registry 诊断:PENDING 的插件 = [misspelled]',
      '[ctx.inject] 一次性依赖回调(先声明、后满足):',
      '  回调运行:read_file + write_file — 先声明后满足,自动触发',
    ])
  })

  it('类型层:数组 inject 是 string[],拼错不拦(静默 PENDING 的类型根源)', () => {
    const root = new Context()
    const typo = (ctx: Context) => {
      void ctx
    }
    // 这里没有任何 @ts-expect-error——typo.inject = ['toolsbo'] 也能通过编译,
    // 这正是"插件一直 PENDING 不执行"排在 FAQ 前列的原因;防线只有 registry 诊断。
    typo.inject = ['toolsbo']
    expect(typo.inject).toEqual(['toolsbo'])
  })
})
