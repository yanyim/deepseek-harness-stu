/**
 * 目标:锁定机制墙的最小复刻——同一调用形态(obj.prepareCall().stream(x)),
 *       门面姿势下 override 是死代码,基类姿势下 override 生效。
 * 思路:两组对照各一断言;不依赖任何 dsh 包,机制就是「原型链查找 + 方法体内
 *       this 转移 + 闭包引用哪个名字」三件事的叠加。
 * 对照:./facade-pattern.ts(骨架);./subclass-probe.ts 与 registry.test.ts
 *       的探针 C/D(同一机制在真实 dsh-llm-deepseek 上的实测);qa/03。
 */
import { describe, expect, it } from 'vitest'

import { SubOfBase, SubOfFacade, WitnessOfThis } from './facade-pattern.ts'

describe('qa/03 追问二:12 行复刻「this 换人」——registerAdapter 只知道 sub,怎么避开 sub.stream', () => {
  it('门面姿势:runtime 调了 sub,但父类方法体把调用转移给内部对象 → override 死代码', () => {
    const sub = new SubOfFacade()
    // runtime 视角的唯一调用形态:
    const out = sub.prepareCall().stream('hi')
    // 走的是内部对象的真传输层,不是 sub 的 override
    expect(out).toBe('真传输层(hi)')
    expect(out).not.toContain('override')
  })

  it('基类姿势(LlmAdapter 缺省 prepareCall):闭包写 this.stream → 同一个 override 生效', () => {
    const sub = new SubOfBase()
    const out = sub.prepareCall().stream('hi')
    expect(out).toBe('我的override(hi)')
  })

  it('追问三校对:父类代码里的 this 就是子类实例本身——查找决定跑哪段代码,不改变 this 绑定', () => {
    const w = new WitnessOfThis()
    w.prepareCall() // runtime 入口:方法在 Facade.prototype 上找到,this 却是 w
    expect(w.receivers[0]).toBe(w) // 同一性:父类链路运行时的 receiver === 子类实例
  })
})
