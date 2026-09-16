/**
 * 目标:第二课姿态二「否决器」——策略插件在 pre-execute 直接拍板 deny,不调 next。
 * 思路:命中否决规则(演示:调用 forget-greeting 工具)→ 不调 next() 返回
 *       { kind: 'deny', reason };未命中 → next() 委托。这正是 approvals 子系统
 *       "策略代替用户作答"的最小形态。
 * 对照:guide/06 的审批链;官方文档 critique:PreToolDecision 注释"策略拒绝呈现
 *       为模型可见的 reason"(模型看到拒绝原因,才能自我纠正)。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

export const name = 'approver-veto'

/** 记录否决次数/原因,供测试与 demo 观察。 */
export const vetoes: string[] = []

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (exec.name === 'forbidden-tool') {
      const reason = `策略拒绝:${exec.name} 不在允许清单`
      vetoes.push(reason)
      return { kind: 'deny', reason } // ← 不调 next():工具承担体不会被调用
    }
    return next()
  })
}
