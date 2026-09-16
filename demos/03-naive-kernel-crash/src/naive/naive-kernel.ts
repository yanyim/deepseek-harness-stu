/**
 * 目标:一个"诚实"的 100 行自研插件内核——能跑通快乐路径(挂载/事件/服务/逆序清理/
 *       inject 停靠/级联重停靠),不是稻草人。它是翻车现场的主角:三个异步场景里
 *       它必然失败,对照真 Cordis 全部存活。
 * 思路:朴素实现的全部常规选择——services 一个 Map、listeners 一个数组、disposers
 *       挂在插件记录上、activate 不 await apply、dispose 同步 for 循环不等待。
 *       每一处"没人会多想"的选择,都是后面某个翻车现场的门。
 * 对照:vendor/cordis/src/fiber.ts(754 行)——本文件刻意省掉的 epoch(代际作废)、
 *       inertia(在途迁移等待)、逐 disposer 异常隔离、注册点栈记账,就是差价清单。
 *
 * 刻意省掉的东西(以及为什么省不起):
 * - dispose 改 async 并 await 所有 disposer?那级联顺序、在途装载、重入都要跟着
 *   重做——这就是 naive 100 行与 fiber.ts 754 行的差距来源。
 */
export interface NaivePluginDef {
  name?: string
  inject?: string[]
  apply: (ctx: NaiveContext) => void | Promise<void>
}

export interface NaiveContext {
  on(name: string, fn: (...args: unknown[]) => void): () => void
  emit(name: string, ...args: unknown[]): void
  provide(name: string, impl: unknown): void
  service<T>(name: string): T
  effect(body: () => () => void): void
  readonly runId: number
}

/** 一个插件实例的运行时记录(朴素版的"fiber")。 */
export interface NaiveRecord {
  def: NaivePluginDef
  disposers: Array<() => void>
  parked: boolean // 依赖未满足,等待提供者
  dead: boolean // 被显式 dispose,永不复生
  runId: number // 第几次激活(用于辨认幽灵来自哪一轮 apply)
  ctx: NaiveContext
}

export class NaiveKernel {
  private services = new Map<string, { impl: unknown; owner: NaiveRecord }>()
  private listeners = new Map<string, Array<{ owner: NaiveRecord; fn: (...args: unknown[]) => void }>>()
  private records: NaiveRecord[] = []

  plugin(def: NaivePluginDef): NaiveRecord {
    const record: NaiveRecord = { def, disposers: [], parked: false, dead: false, runId: 0, ctx: undefined as unknown as NaiveContext }
    record.ctx = this.makeCtx(record)
    this.records.push(record)
    if (this.ready(record)) this.activate(record)
    else record.parked = true // 依赖未满足:停靠等待(与 Cordis 的 PENDING 同思路)
    return record
  }

  private makeCtx(record: NaiveRecord): NaiveContext {
    const kernel = this
    return {
      get runId() {
        return record.runId
      },
      on(name, fn) {
        const entry = { owner: record, fn }
        const list = kernel.listeners.get(name) ?? []
        list.push(entry)
        kernel.listeners.set(name, list)
        const off = () => {
          const current = kernel.listeners.get(name)
          const index = current ? current.indexOf(entry) : -1
          if (index >= 0) current?.splice(index, 1)
        }
        record.disposers.push(off)
        return off
      },
      emit(name, ...args) {
        for (const { fn } of kernel.listeners.get(name) ?? []) fn(...args)
      },
      provide(name, impl) {
        kernel.services.set(name, { impl, owner: record })
        record.disposers.push(() => kernel.services.delete(name))
        for (const other of kernel.records) {
          if (other.parked && !other.dead && kernel.ready(other)) kernel.activate(other)
        }
      },
      service<T>(name: string): T {
        return kernel.services.get(name)?.impl as T
      },
      effect(body) {
        record.disposers.push(body())
      },
    }
  }

  private ready(record: NaiveRecord): boolean {
    return (record.def.inject ?? []).every((name) => this.services.has(name))
  }

  private activate(record: NaiveRecord) {
    record.parked = false
    record.runId += 1
    void record.def.apply(record.ctx) // ← 不 await:朴素内核不知道"装载在途"这回事(竞态之门)
  }

  private ownedServices(record: NaiveRecord): string[] {
    return [...this.services].filter(([, v]) => v.owner === record).map(([k]) => k)
  }

  /**
   * 卸载:同步、逆序、不等待、异常会中断兄弟 disposer。
   * @param rebirth 级联卸载的依赖者走"重停靠"(对应 Cordis 级联后回 PENDING 等新提供者);
   *                用户显式 dispose 则死透(对应 fiber.dispose() 的 DISPOSED)。
   */
  dispose(record: NaiveRecord, rebirth = false): void {
    if (record.dead) return
    const services = this.ownedServices(record)
    // 级联-lite:活着且依赖我服务的插件,先拆掉并重停靠——对应 Cordis 的 UNLOADING→PENDING
    for (const other of this.records) {
      if (other === record || other.dead || other.parked) continue
      if ((other.def.inject ?? []).some((name) => services.includes(name))) {
        this.dispose(other, true)
      }
    }
    for (const d of [...record.disposers].reverse()) d() // ← 异常会中断循环;异步 disposer 不被等待
    record.disposers = [] // 清空了;但迟到的注册还会 push 进来,且全局 listeners 里那条永远没人再清 → 幽灵
    record.dead = !rebirth
    record.parked = rebirth
  }
}
