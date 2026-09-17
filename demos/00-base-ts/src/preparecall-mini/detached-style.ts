/**
 * 目标:姿势⑤·解构(反例)——把方法从 this 上取下来再调,this 直接丢,
 *       连箭头闭包也救不了(箭头只捕获「自己的」外层 this)。
 * 思路:prepare 里 const s = this.stream——取出的瞬间方法与 this 的关系断裂;
 *       stream 读 this.stamp,this=undefined 即 TypeError。真实代码不这么写,
 *       它是最能暴露「this 属于调用而非方法」的反面教材。
 * 对照:幕二 escape.ts ②(取出直调丢 this——同一原理的裸版本)。
 */
import { AdapterRoot } from './prepared.ts'
import type { Prepared } from './prepared.ts'

/** 解构姿势(反例):方法从 this 上取下来,连箭头也救不了。 */
export class DetachedStyle extends AdapterRoot {
  stamp = 'detached'

  override prepare(): Prepared {
    const s = this.stream // 取出的瞬间,方法与 this 的关系就断了
    return { stream: (msg) => s(msg) }
  }

  stream(msg: string): string {
    return `detached.stream[${this.stamp}](${msg})` // 读 this.stamp:this 丢失则炸
  }
}
