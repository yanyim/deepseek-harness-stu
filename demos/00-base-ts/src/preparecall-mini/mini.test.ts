/**
 * 目标:锁定单元三行为——六姿势对照矩阵 + 字段级断言(与 demos/06 真实链路版
 *       探针 C/D 同构)。
 * 思路:剧本整列 toEqual(experiments.ts 共用)+ 每姿势标本一个字段级用例;
 *       abstract 强制力的编译层证据在 prepared.ts 的 @ts-expect-error。
 * 对照:./prepared.ts ./base-style.ts ./facade-style.ts ./detached-style.ts
 *       ./self-facade.ts;demos/06 registry/subclass-probe.ts + facade-pattern.ts;
 *       qa/03「机制墙的原理」与「门面为什么挂 stream」。
 */
import { describe, expect, it } from 'vitest'

import { BaseSub } from './base-style.ts'
import { DetachedStyle } from './detached-style.ts'
import { FacadeStyle, FacadeSub, wireObserver } from './facade-style.ts'
import { runPrepareCallExperiments } from './experiments.ts'
import { SelfFacadeStyle } from './self-facade.ts'

describe('单元三:简化版 prepareCall——四路对照 + 反例', () => {
  it('五幕剧本整列锁定', () => {
    expect(runPrepareCallExperiments()).toEqual([
      '① 基类姿势(用缺省 prepare):prepare().stream("hi") → SUB.stream(hi)',
      '   (闭包写 this.stream → 子类 stream 生效)',
      '② 门面姿势(prepare 改写为转移):prepare().stream("hi") → wire(hi)',
      '   (分派链不经过 stream → 子类 override 死代码)',
      '③ 门面直调(不经 prepare):stream("hi") → wire(hi)',
      '   (stream 是 abstract 逼出来的转发方法——直调也是一条活路)',
      '   (汇合实测:两扇门各走一次,WireTransport.stream 执行 2 次——一套实现,不是两套)',
      '④ 子类旁路直调:stream("hi") → SUB.stream(hi)',
      '   (直调同样晚绑定——override 死不死取决于走哪条路,不是方法本身)',
      '⑤ 解构姿势:prepare().stream("hi") → TypeError(this=undefined)',
      '   (const s = this.stream 取出的瞬间 this 就丢了——箭头只捕获「自己的」外层 this,救不了别人)',
      '⑥ 自指门面:stream("hi") → RangeError(栈溢出:无限递归)',
      '   (自己当自己的内部对象 = 委托链没有基准情形;不需要别的工作对象,就不需要门面——那是姿势一)',
    ])
  })

  it('字段级:同一条 prepare 链,血脉决定命运', () => {
    expect(new BaseSub().prepare().stream('x')).toBe('SUB.stream(x)') // 缺省 prepare → override 活
    expect(new FacadeSub().prepare().stream('x')).toBe('wire(x)') // 门面 prepare → override 死
  })

  it('字段级:直调两条路——门面转发是活路,子类 override 直调命中', () => {
    expect(new FacadeStyle().stream('x')).toBe('wire(x)') // 转发实现
    expect(new FacadeSub().stream('x')).toBe('SUB.stream(x)') // 直调晚绑定
  })

  it('字段级:一套实现,两扇门——prepare 路与直调路汇合到同一段 WireTransport.stream', () => {
    wireObserver.calls = 0
    const viaPrepare = new FacadeStyle().prepare().stream('x')
    const viaDirect = new FacadeStyle().stream('x')
    expect(viaPrepare).toBe(viaDirect) // 两扇门输出一致
    expect(wireObserver.calls).toBe(2) // 且执行的是同一段代码(共两次,不多不少)
  })

  it('字段级:解构姿势抛 TypeError', () => {
    const prepared = new DetachedStyle().prepare()
    expect(() => prepared.stream('x')).toThrow(TypeError)
  })

  it('字段级:自指门面抛 RangeError——委托链没有基准情形即无限递归', () => {
    expect(() => new SelfFacadeStyle().stream('x')).toThrow(RangeError)
    expect(() => new SelfFacadeStyle().prepare()).toThrow(RangeError)
  })
})
