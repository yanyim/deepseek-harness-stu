/**
 * 目标:锁定第二课——瀑布三姿态在真实 tools/pre-execute 上的行为:
 *       放行路径 isError=false、否决路径 isError=true 且 content 带 reason、
 *       auditor 看到完整决策序列。
 * 思路:走 harness-inline(vitest 不经 loader 文件路径);插件模块与 demo 同一份。
 *       approve 组合三件(allow/veto/auditor)全挂,driver 只做 execute。
 * 对照:guide/06(审批链:策略代替用户作答);demos/01 解法⑥(三姿态原型)。
 */
import { describe, expect, it } from 'vitest'

import { startInlineHarness } from '../../harness-inline.ts'
import * as greetRegistry from './greet-registry.ts'
import * as approverAllow from './approver-allow.ts'
import * as approverVeto from './approver-veto.ts'
import * as auditor from './waterfall-auditor.ts'
import * as driver from './lesson-2-driver.ts'
import { vetoes } from './approver-veto.ts'
import { audit } from './waterfall-auditor.ts'

describe('第二课:tools/pre-execute 瀑布三姿态', () => {
  it('放行正常执行;否决得到带 reason 的 isError 结果,工具体未运行', async () => {
    vetoes.length = 0
    audit.length = 0
    const ctx = startInlineHarness([auditor, approverAllow, approverVeto, greetRegistry, driver])
    // driver 的两次 execute 是 async,轮询等 audit 收齐(allow 的 pre+post,veto 的 pre)
    for (let i = 0; i < 50 && audit.length < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    expect(vetoes).toEqual(['策略拒绝:forbidden-tool 不在允许清单'])
    // 观察者视角:driver 先调 greet(放行),再调 forbidden-tool(否决)。
    // 实测点:否决 ≠ 跳过 post-execute——调度器把拒绝结果作为 post-result 送入
    // post-execute(源码注释"A post-result still receives post-execute"),
    // 所以否决也有 post 记录,只是 isError=true。
    expect(audit).toEqual([
      'pre:greet -> allow',
      'post:greet(result isError=false)',
      'pre:forbidden-tool -> deny',
      'post:forbidden-tool(result isError=true)',
    ])
    await ctx.fiber.dispose()
  })
})
