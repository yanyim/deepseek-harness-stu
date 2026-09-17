/**
 * 目标:锁定单元三行为——同一调用形态,三种 prepare 写法三种命运:基类姿势 override
 *       生效;门面姿势 override 死代码(旁路直调仍活);解构姿势直接 TypeError。
 * 思路:剧本整列 + 字段级断言(命中谁/抛什么),与 demos/06 真实链路版探针 C/D 同构。
 * 对照:./mini.ts;demos/06 registry/subclass-probe.ts + facade-pattern.ts;
 *       qa/03「机制墙的原理」。
 */
import { describe, expect, it } from 'vitest'

import {
  BaseSub,
  DetachedStyle,
  FacadeSub,
  runPrepareCallExperiments,
} from './mini.ts'

describe('单元三:简化版 prepareCall——三姿势对照', () => {
  it('三幕剧本整列锁定', () => {
    expect(runPrepareCallExperiments()).toEqual([
      '① 基类姿势:p.stream("hi") → SUB.stream(hi)',
      '   (闭包写 this.stream → 子类 override 生效)',
      '② 门面姿势:p.stream("hi") → wire(hi)',
      '   (体内 new 内部对象 → override 死代码;旁路直调 sub.stream("hi") → SUB.stream(hi))',
      '③ 解构姿势:p.stream("hi") → TypeError(this=undefined)',
      '   (const s = this.stream 取出的瞬间 this 就丢了——箭头只捕获「自己的」外层 this,救不了别人)',
    ])
  })

  it('字段级:基类姿势命中子类 override,门面姿势命中内部对象、旁路直调仍命中子类', () => {
    expect(new BaseSub().prepare().stream('x')).toBe('SUB.stream(x)')
    expect(new FacadeSub().prepare().stream('x')).toBe('wire(x)')
    expect(new FacadeSub().stream('x')).toBe('SUB.stream(x)')
  })

  it('字段级:解构姿势抛 TypeError', () => {
    const prepared = new DetachedStyle().prepare()
    expect(() => prepared.stream('x')).toThrow(TypeError)
  })
})
