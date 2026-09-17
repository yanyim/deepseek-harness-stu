/**
 * 目标:单元二「this 的丢失与找回」——this 不属于方法,属于「方法调用」;把方法
 *       从对象上取下来直调,this 就没了(ESM 恒为 strict → undefined)。这是理解
 *       prepareCall 为什么必须「返回箭头闭包」的前置课。
 * 思路:① 取出直调 → TypeError;②③ 找回两法(bind / 箭头包装);④⑤ 对照实验:
 *       普通函数回调里的 this 是 undefined,箭头回调捕获定义处的 this——prepareCall
 *       的 dispatch 闭包用的正是箭头(捕获 prepareCall 运行时的 this)。
 * 对照:单元三 mini.ts 的 DetachedStyle(解构丢 this 的 prepareCall 反例);
 *       dsh 源码 LlmAdapter 缺省 prepareCall 的 `stream: (options) => this.stream(options)`
 *       ——箭头不是风格选择,是机制必需。
 */

export class Speaker {
  tag = 'speaker'

  speak(): string {
    return `speak(this.tag=${this.tag})`
  }

  /** 普通函数回调:this 在「调用时」才定,谁都不是 → strict 下 undefined。 */
  callbackFn(): () => string {
    return function (this: undefined) {
      return `fn 回调里的 this = ${String(this)}`
    }
  }

  /** 箭头回调:this 在「定义时」捕获 = 这里的 Speaker 实例。 */
  callbackArrow(): () => string {
    return () => `arrow 回调捕获的 this.tag = ${this.tag}`
  }
}

export function runEscapeExperiments(): string[] {
  const out: string[] = []
  const s = new Speaker()

  // ① 直接调用:this = s
  out.push(`① s.speak()            → ${s.speak()}`)

  // ② 取出直调:方法与对象分离,this 丢失(strict 模式下是 undefined,不是全局对象)
  const detached = s.speak
  try {
    detached()
    out.push('② 取出直调            → (不该到这里)')
  } catch (err) {
    out.push(`② 取出直调            → ${err instanceof TypeError ? 'TypeError(this=undefined,读 this.tag 失败)' : String(err)}`)
  }

  // ③ 找回法一:bind 把 this 焊回对象
  out.push(`③ detached.bind(s)()   → ${detached.bind(s)()}`)

  // ④ 找回法二:箭头包装——箭头自己没有 this,外层的 s 直接可见
  const wrapped = () => s.speak()
  out.push(`④ 箭头包装             → ${wrapped()}`)

  // ⑤⑥ 闭包对照:两种回调,一个调用时丢、一个定义时捕
  out.push(`⑤ 普通函数回调         → ${s.callbackFn()()}`)
  out.push(`⑥ 箭头回调             → ${s.callbackArrow()()}`)
  return out
}
