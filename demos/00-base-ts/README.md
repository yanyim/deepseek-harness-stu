# Demo 00 · TS 地基课:继承与 this 指向

> 编号说明:本仓库 demos/NN 按**创建顺序**编号,唯 00 例外——它是后补的「第 0 课」
> 基础单元,给读 dsh 源码时最容易迷路的两条 JS/TS 机制做地基(诞生自 qa/03 的
> 追问链,见下「为什么有这个 demo」)。

回答的问题:「`obj.method()` 到底是怎么找到代码、`this` 又是谁?」——以及它
的直接后果:「为什么继承 `DeepSeekAdapter` 之后 `override stream` 是死代码?」

**答案一句话**:方法查找(跑哪段代码)与 this 绑定(以谁的身份跑)是**两个
独立机制**;override 生效的唯一条件是「分派链上有 `this.你改的名字` 这个晚绑定
引用」,闭包捕获的 `this` 决定 dispatch 的身份。

## 运行

```sh
pnpm demo:00     # 三幕串场,肉眼观察
pnpm test        # 三单元剧本整列锁定 + 字段级断言
pnpm typecheck
```

## 三幕总图

```
幕一 lookup-vs-binding    查找决定代码,this 绑定决定身份
  ①② 原型链查找:Grand → Mid,同名方法不同深度命中不同代码
  ③   实例遮蔽:own property 优先于整条原型链(demos/06 探针 D(b) 的原理)
  ④   晚绑定引用:Grand.hello 里写 this.who → 子类 override 命中
  ⑤   同一性:父类代码运行时记录的 this === 子类实例(不存在「parent 的 this」)
  ⑥   super:选最近祖先的代码,不换 this

幕二 this-escape          this 属于「调用」,不属于方法
  ①② 方法取出直调 → this 丢失(ESM 恒 strict → undefined,读字段即 TypeError)
  ③④ 找回两法:bind / 箭头包装
  ⑤⑥ 回调对照:普通函数调用时丢,箭头定义时捕——prepareCall 必须用箭头的缘故

幕三 preparecall-mini     一个抽象根(= LlmAdapter),两条血脉,四路对照 + 反例
  根:abstract stream 逼所有具体子类实现它(不挂编译不过,@ts-expect-error 即证据)
  ① 基类血脉(用缺省 prepare)      闭包写 this.stream    → override 生效
  ② 门面血脉(= DeepSeekAdapter)    prepare 改写为体内 new 内部对象 → override 死代码
  ③ 门面直调(不经 prepare)         stream 实现为转发     → 直调也是活路
  ④ 子类旁路直调                   直调同样晚绑定         → override 命中
  ⑤ 解构(反例)                     const s = this.stream → this 丢失直接炸
  ⑥ 自指(反例)                     impl() 返回 new 自己 → 无基准情形,RangeError 栈溢出

  门面挂 stream 的完整答案:abstract 逼它挂(第一层);它选择挂成「转发给内部
  对象」(第二层),所以直调能用;只是 runtime 的分派链(prepare)不走它(第三层)。
  门面不能自己当自己的内部对象(⑥):委托链必须有基准情形——真正干活的工作对象。
```

## 组织:目录树 = 论证树

```
00-base-ts/src/
  lookup-vs-binding/       幕一:查找 vs 绑定
    experiments.ts           六个实验(runLookupExperiments 返回剧本)
    experiments.test.ts      整列 toEqual 锁定
  this-escape/             幕二:丢失与找回
    escape.ts                六个实验 + TypeError 单独断言
    escape.test.ts
  preparecall-mini/        幕三:简化版 prepareCall(一姿势一标本文件)
    prepared.ts              公共地基:Prepared 接口 + AdapterRoot 抽象根(+ NoStream
                             的 @ts-expect-error:abstract 强制力证据)
    base-style.ts            姿势①:基类血脉(缺省 prepare → override 生效)
    facade-style.ts          姿势②③:门面血脉(prepare 转移 + stream 转发)+ WireTransport
    detached-style.ts        姿势⑤:解构反例(this 丢失)
    self-facade.ts           姿势⑥:自指反例(无基准情形,栈溢出)
    experiments.ts           串场:六姿势缝成对照矩阵剧本
    mini.test.ts             剧本整列锁定 + 每姿势字段级断言
  main.ts                  串场(幕间串词把三幕缝回 demos/06 的问题)
```

## 实验 ↔ demos/06 真实链路 ↔ dsh 源码 对照

| 本 demo | demos/06 的哪个实验 | dsh 源码 |
|---|---|---|
| 幕一③ 实例遮蔽 | 探针 D(b):遮蔽 `implementation()` 生效 | —(JS 语言机制) |
| 幕一⑤ 同一性 | `WitnessOfThis`:父类代码 this === 子实例 | —(JS 语言机制) |
| 幕一④ 晚绑定命中 | EchoAdapter/DuckAdapter 的 override 生效 | `LlmAdapter` 缺省 `prepareCall`:`stream: (options) => this.stream(options)` |
| 幕二⑤⑥ 闭包捕获 | — | 同上:箭头捕获 prepareCall 运行时的 this |
| 幕三 ② 门面 prepare | 探针 C/D(a):override 死代码、闭包绑内部对象 | `DeepSeekAdapter.prepareCall` → `this.implementation().prepareCall()` |
| 幕三 ③ 门面 stream 转发 | —(直调活路,mini 补齐的保真点) | `DeepSeekAdapter.stream` → `this.implementation().stream(options)` |
| 幕三 ⑤ 解构 | —(反例,真实代码不这么写) | — |

## 为什么有这个 demo

qa/03 的追问链一路问到「registerAdapter 只知道 subA,怎么避开 subA 调用」——
表面是 dsh 的注册机制问题,根子是 JS 继承的 this 语义。与其每次在 dsh 语境里
补课,不如把地基单独成课:这里的每个实验都零依赖、可独立观察,结论直接映射回
demos/06 的真实链路。

## 刻意省了什么

- `call`/`apply` 完整语法、`new.target`、原型链底层 API
  (`getPrototypeOf`/`Reflect` 全家)——用到再学;
- class fields 的语义细节(`useDefineForClassFields` 开关)——本 demo 不依赖差异;
- `Symbol.hasInstance`、 mixin、组合优于继承的架构讨论——离主线远。
