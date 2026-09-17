/**
 * 目标:机制墙的零依赖复刻(qa/03 追问二)——「registerAdapter 只知道 subA,
 *       怎么做到不调 subA.stream?」答案:runtime 确实调了 subA,但原型链查找
 *       让调用落进父类代码;父类代码在方法体内 new 出内部对象并转移调用。
 *       this 的「换人」发生在父类方法体内部——继承 + new,无需任何特殊机制。
 * 思路:两个 12 行对照组,调用形态完全一致(obj.prepareCall().stream(x)),
 *       唯一变量是 prepareCall 方法体里 this 的去向:门面姿势(转移给内部对象,
 *       闭包绑内部对象→override 死代码)vs 基类姿势(闭包写 this.stream→
 *       override 生效)。这就是 LlmAdapter 与 DeepSeekAdapter 的全部差别。
 * 对照:dsh-llm-deepseek lib/index.js 的 DeepSeekAdapter(门面姿势,逐方法转发
 *       this.implementation())与 @deepseek-ai/dsh-llm 的 LlmAdapter 缺省
 *       prepareCall(基类姿势 this.stream);subclass-probe.ts(真实链路版);
 *       qa/03「机制墙的原理」节。
 */

/** 内部实现对象:DeepSeekAdapter 的 ChatCompletionsAdapter 骨架。 */
class Internal {
  prepareCall() {
    // ② 闭包:箭头函数捕获 this=internal,引用名字 realTransport(≠ stream)
    return { stream: (opts: string) => this.realTransport(opts) }
  }
  realTransport(opts: string) {
    return `真传输层(${opts})`
  }
}

/** 门面:DeepSeekAdapter 的骨架——每个方法都是转发。 */
export class Facade {
  prepareCall() {
    // ★ 转移点:new 出内部对象,后续调用的目标换人,this=internal
    return this.implementation().prepareCall()
  }
  implementation() {
    return new Internal()
  }
}

/** 子类:你的 override——链上没人引用 stream 这个名字,死代码。 */
export class SubOfFacade extends Facade {
  stream(opts: string) {
    return `我的override(${opts})`
  }
}

/** 基类:LlmAdapter 缺省 prepareCall 的骨架——闭包写 this.stream。 */
export class BaseLikeLlm {
  prepareCall() {
    // 闭包:捕获 this=sub,引用名字 stream → 子类 override 晚绑定命中
    return { stream: (opts: string) => this.stream(opts) }
  }
  stream(_opts: string) {
    return '基类缺省实现(缺省抛错的抽象感)'
  }
}

/** 子类:同一个 override,在基类姿势下生效。 */
export class SubOfBase extends BaseLikeLlm {
  stream(opts: string) {
    return `我的override(${opts})`
  }
}

/** 见证者(qa/03 追问三校对):父类代码经原型链执行时,this 就是子类实例本身,
 *  不是「parent 的 this」——查找决定跑哪段代码,不改变 this 绑定。 */
export class WitnessOfThis extends Facade {
  readonly receivers: unknown[] = []

  override implementation() {
    this.receivers.push(this) // 此刻正在执行的是 Facade.prepareCall 调来的父类链路
    return new Internal()
  }
}
