/**
 * 目标:Demo 00 串场入口——继承与 this 指向的地基课。三幕递进,每一幕都回答同一
 *       个问题的一个侧面:「obj.method() 到底是怎么找到代码、this 又是谁?」
 *       末幕把前两幕的原理组装成简化版 prepareCall,直通 demos/06 的机制墙。
 * 思路:与测试共用同一批实验函数(每幕返回 string[] 剧本);main 只负责打印与
 *       幕间串词,行为锁定在测试里。
 * 对照:demos/06 registry/(facade-pattern/subclass-probe——同一机制的真实链路版);
 *       qa/03 追问二/三;规范:ECMAScript 方法调用求值规则。
 */
import { runLookupExperiments } from './lookup-vs-binding/experiments.ts'
import { runPrepareCallExperiments } from './preparecall-mini/mini.ts'
import { runEscapeExperiments } from './this-escape/escape.ts'

console.log('══ 幕一:查找决定代码,this 绑定决定身份(两个独立机制)══')
console.log('  调 obj.method() 时:查找沿原型链选「跑哪段代码」;this 恒等于发起调用的实例。\n')
for (const line of runLookupExperiments()) console.log(' ', line)

console.log('\n══ 幕二:this 的丢失与找回(this 属于「调用」,不属于方法)══')
console.log('  方法从对象上取下来直调,this 就没了(ESM 恒 strict → undefined,不是全局对象)。\n')
for (const line of runEscapeExperiments()) console.log(' ', line)

console.log('\n══ 幕三:简化版 prepareCall(同一调用形态,三种 prepare 写法三种命运)══')
console.log('  调用形态都是 p.stream("hi") —— 差别只在 prepare 方法体里 this 的去向。\n')
for (const line of runPrepareCallExperiments()) console.log(' ', line)

console.log(`
  回到 demos/06 的问题:「继承 DeepSeekAdapter + override stream 为什么是死代码?」
  = 幕三的姿势二(门面):闭包引用的名字不是 stream,且 this 已换成内部对象;
    「实例遮蔽 implementation 为什么生效?」= 幕一③(own property 优先于原型链);
    「父类代码能摸到子类实例吗?」= 幕一⑤(this === 子实例,从来都能)。`)
