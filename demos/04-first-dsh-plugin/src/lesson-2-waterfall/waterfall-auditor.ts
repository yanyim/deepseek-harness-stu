/**
 * 目标:第二课姿态三「观察者」+ 记录器——pre-execute 最外层记账(含 "看到了谁的
 *       决策"),以及 post-execute 记录工具结果,验证"否决时工具承担体未运行"。
 * 思路:pre-execute 观察者在最外层(next 之前记 exec,next 之后记决策)——同一
 *       listener 内先 await next() 再记,能同时看到输入与下游决策;
 *       post-execute 只在真正执行后有事件,由此区分"否决"与"执行完"。
 * 对照:demos/01 解法⑥(waterfall 三姿态正是 dsh 拦截点的设计原型);
 *       guide/06 流水线图(pre-execute → execute → post-execute)。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'waterfall-auditor'

/** 第二课全部观察记录,测试与 demo 共用。 */
export const audit: string[] = []

export function apply(ctx: Context) {
  // ---- pre-execute 最外层:看输入,也看下游拍板 ----
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next() // 观察者纪律:必须委托
    audit.push(`pre:${exec.name} -> ${decision.kind}`)
    return decision
  })

  // ---- post-execute:同样是 waterfall,观察者必须委托 ----
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    audit.push(`post:${exec.name}(result isError=${String(result.isError)})`)
    return decision
  })
}
