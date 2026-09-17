/**
 * 目标:姿势①·基类血脉——不改写 prepare(用缺省),只实现 stream;分派链的
 *       闭包写 this.stream,晚绑定命中本实现 → override 生效。
 * 思路:一个类,零机关;它是其余所有姿势的「对照基准」:谁偏离它,谁就要付出
 *       相应代价(死代码/丢 this/无限递归)。
 * 对照:./prepared.ts(AdapterRoot 缺省 prepare);demos/06 EchoAdapter/DuckAdapter
 *       (override 生效的真实例子)。
 */
import { AdapterRoot } from './prepared.ts'

/** 基类姿势血脉:不碰 prepare(用缺省),只实现 stream → 分派链命中本实现。 */
export class BaseSub extends AdapterRoot {
  stream(msg: string): string {
    return `SUB.stream(${msg})`
  }
}
