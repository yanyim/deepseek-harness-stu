/**
 * 目标:第二课「拦截三姿态」——同一个 tools/pre-execute 瀑布上的三个监听者:
 *       观察者(只记账,必须调 next)、放行者(无条件 next)、否决器(命中规则直接 deny)。
 * 思路:每姿态一个独立插件,组合里按需挂载。观察者先注册(最外层,先执行),
 *       能看到改写/否决前的完整 exec 以及后续监听者的决策——这正是 dsh 审计
 *       插件的位置。
 * 对照:guide/06 工具流水线;packages/core/tools/src/index.ts:144(事件签名);
 *       PreToolDecision 四分支(allow/deny/cancel/ask)——第二课只演示 allow/deny。
 */
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

export const name = 'approver-allow'

export function apply(ctx: import('@deepseek-ai/cordis').Context) {
  ctx.on('tools/pre-execute', async (_exec, next): Promise<PreToolDecision> => {
    return next() // 姿态一:放行——无条件委托
  })
}
