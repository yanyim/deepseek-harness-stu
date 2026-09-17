/**
 * 目标:姿势⑥·自指(反例,qa 追问)——门面自己当自己的内部对象:委托链没有
 *       基准情形,stream 转发 impl()、impl() 又 new 一个自己,无限递归,栈溢出。
 * 思路:这个反例实测过两种死法:原样写法先撞两个编译错误(.stream() 缺参、
 *       string 不是 Prepared);修成可编译形状后 RangeError 栈溢出。教训:门面
 *       的意义恰恰是「工作由别的对象做」;若不需要别的工作对象,就根本不需要
 *       门面——直接写 base-style.ts 那样的直活实现即可。
 * 对照:./facade-style.ts(内部对象=基准情形的正确版);dsh-llm-deepseek 的
 *       implementation() 永远 new 别的类(ChatCompletionsAdapter/MessagesAdapter)。
 */
import { AdapterRoot } from './prepared.ts'
import type { Prepared } from './prepared.ts'

/** 自指门面(反例):impl() 返回 new 自己——没有基准情形的委托链。 */
export class SelfFacadeStyle extends AdapterRoot {
  impl(): SelfFacadeStyle {
    return new SelfFacadeStyle() // 内部对象 = 另一个我(没有基准情形)
  }

  override prepare(): Prepared {
    return this.impl().prepare()
  }

  stream(msg: string): string {
    return this.impl().stream(msg)
  }
}
