/**
 * 目标:单元一「两个独立机制」——方法查找(跑哪段代码)与 this 绑定(以谁的身份跑)
 *       完全解耦。调用 obj.method() 时:查找沿原型链选代码;this 恒等于发起调用的实例。
 * 思路:四个实验递进:①②③ 三层查找优先级(实例遮蔽 > 子类原型 > 父类原型);
 *       ④ Grand 代码里的 this.who() 晚绑定命中子类 override(override 生效的唯一
 *       条件);⑤ 同一性见证——父类代码运行时记录的 this === 子类实例(不存在
 *       「parent 的 this」);⑥ super 选代码、不换 this。
 * 对照:demos/06 registry/facade-pattern.ts(单元一的真实链路版);qa/03 追问三
 *       「理解校对」;规范:ECMAScript 方法调用求值规则(receiver = 引用的基础值)。
 */

/** 三层继承链的顶层:who 是「被查找的名字」,hello 是「晚绑定引用者」。 */
class Grand {
  tag = 'grand'
  /** 父类代码运行时把 this 记下来——同一性见证的记录点。 */
  seen: unknown[] = []

  who(): string {
    return `Grand.code(this.tag=${this.tag})`
  }

  /** 关键一行:Grand 的代码里写的是 this.who ——名字查找发生在调用时,子类可命中。 */
  hello(): string {
    this.seen.push(this)
    return `hello → ${this.who()}`
  }
}

/** 中层:遮蔽 tag 与 who。 */
class Mid extends Grand {
  override tag = 'mid'
  override who(): string {
    return `Mid.code(this.tag=${this.tag})`
  }
}

/** 底层:super 链——代码选父类,this 仍是自己。 */
class MidChild extends Mid {
  override tag = 'mid-child'
  override who(): string {
    return `MidChild(super ${super.who()})`
  }
}

export function runLookupExperiments(): string[] {
  const out: string[] = []

  // ①② 原型链查找:同一个名字,不同深度命中不同代码;代码读 this.tag 拿到的是「实例的字段」
  const g = new Grand()
  const m = new Mid()
  out.push(`① new Grand().who() → ${g.who()}`)
  out.push(`② new Mid().who()   → ${m.who()}`)

  // ③ 实例遮蔽:own property 优先于原型链上的一切(D(b) 实验的原理)
  const shadowed = new Mid()
  ;(shadowed as unknown as { who: () => string }).who = () => 'instance-shadow'
  out.push(`③ 实例遮蔽 who      → ${shadowed.who()}`)
  delete (shadowed as unknown as { who?: () => string }).who
  out.push(`   delete 后回落     → ${shadowed.who()}`)

  // ④ 晚绑定引用:hello 的代码在 Grand 上一步没改,输出却跟着 who 的命中走
  out.push(`④ m.hello()         → ${m.hello()}`)

  // ⑤ 同一性:Grand.hello(父类代码)运行时 push 进去的 this,与子实例是同一个对象
  out.push(`⑤ 父类代码里的 this === 子实例 → ${String(m.seen[0] === m)}`)

  // ⑥ super:选父类代码,不换 this(Grand.who 读到的 this.tag 是 mid-child)
  const c = new MidChild()
  out.push(`⑥ super 链          → ${c.who()}`)
  return out
}
