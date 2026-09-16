/**
 * 目标:番外「形态陷阱」——排查翻车现场一时的计划外发现:普通 `function` 插件返回
 *       Promise 时,后半段会彻底脱离生命周期管理。
 * 思路:cordis 用 isConstructor 判别类插件,判据是 `.prototype` 的存在。普通函数
 *       声明有 prototype → 被 `new`;`new` 一个返回对象的函数,返回值就是"实例"——
 *       于是你的 Promise 成了实例,fiber 立即 ACTIVE,then 里的副作用裸奔。
 *       async 函数与箭头函数没有 prototype → 按函数插件调用,返回值被等待。
 * 对照:vendor/cordis/src/utils.ts 的 isConstructor(`if (!func.prototype) return false`);
 *       fiber.ts execute 分支(new vs call)。探针 A/B 实测:plain fn 挂载即 ACTIVE,
 *       async fn 睡满 20ms 才 ACTIVE。
 */
import { Context } from '@deepseek-ai/cordis'

import { stateName } from '../stage/states.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function runFormHazard(): Promise<string[]> {
  const out: string[] = []
  const root = new Context()

  // 形态 A:普通 function(有 .prototype)返回 Promise → 被当类插件 new
  function plainFnPlugin(ctx: Context) {
    void ctx
    return sleep(20).then(() => {
      void 0 // 这里的副作用在 fiber 看来根本不存在
    })
  }
  const fiberA = root.plugin(plainFnPlugin)

  // 形态 B:async function(无 .prototype)→ 按函数插件调用,返回值被等待
  const asyncFnPlugin = async (ctx: Context) => {
    void ctx
    await sleep(20)
  }
  const fiberB = root.plugin(asyncFnPlugin)

  out.push('[形态A] plain function 返回 Promise:被 isConstructor 判为类,new 出的"实例"就是那个 Promise')
  await sleep(10)
  out.push(`[形态A] apply 的 then 还没跑,fiber 已 = ${stateName((fiberA as { state: number }).state)}(后半段脱离生命周期)`)
  out.push(`[形态B] async 箭头函数:睡满 20ms 前 fiber 仍是 = ${stateName((fiberB as { state: number }).state)}(返回值被等待)`)
  await fiberA
  await fiberB
  out.push(`[形态B] 等待完成后 = ${stateName((fiberB as { state: number }).state)}`)
  out.push('[规则] 插件主体要么 async function/箭头,要么同步返回 disposer;普通 function 只做同步副作用')

  await root.fiber.dispose()
  return out
}
