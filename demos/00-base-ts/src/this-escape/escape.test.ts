/**
 * 目标:锁定单元二行为——方法取出直调丢 this(ESM strict → undefined)、bind/箭头
 *       两法找回、普通函数回调与箭头回调的 this 语义差异。
 * 思路:剧本整列 toEqual + 单独断言 TypeError 类型(脱离 V8 报错文案)。
 * 对照:./escape.ts;单元三 mini.ts 的 DetachedStyle(同一原理的 prepareCall 反例)。
 */
import { describe, expect, it } from 'vitest'

import { Speaker, runEscapeExperiments } from './escape.ts'

describe('单元二:this 的丢失与找回', () => {
  it('六幕剧本整列锁定', () => {
    expect(runEscapeExperiments()).toEqual([
      '① s.speak()            → speak(this.tag=speaker)',
      '② 取出直调            → TypeError(this=undefined,读 this.tag 失败)',
      '③ detached.bind(s)()   → speak(this.tag=speaker)',
      '④ 箭头包装             → speak(this.tag=speaker)',
      '⑤ 普通函数回调         → fn 回调里的 this = undefined',
      '⑥ 箭头回调             → arrow 回调捕获的 this.tag = speaker',
    ])
  })

  it('取出直调抛的是 TypeError(this=undefined),不是 undefined 全局回退', () => {
    const s = new Speaker()
    const detached = s.speak
    expect(() => detached()).toThrow(TypeError)
  })
})
