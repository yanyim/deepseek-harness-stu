# Demo 05 · import 的第二个输入:await import vs internal.import

回答的问题(出自笔记库 `qa/02-附录四` §1.5):`await import()` 和 `eval` 之外,
cordis-plugin-loader 的「首选档」`internal.import` 是什么机制?

**答案一句话**:`import('twin-pkg')` 这句话**本身不完备**——还差一个信息:**从哪个目录开始找**。
Node 把这第二个输入**自动填成「写这行代码的文件住在哪」**;拿到加载器本体后,这个输入
**变成你传的参数**。本 demo 把这条隐藏规则摆上台面,做成可以亲眼看的实验。

## 运行

```sh
pnpm demo:05    # node --expose-internals src/main.ts(四实验全跑)
node demos/05-loading-mechanisms/src/main.ts   # 无旗子:前门实验照常,内部档优雅降级
pnpm test       # spawn 真实 node 子进程,双模式输出整列锁定
```

## 讲解版:demo 在制造一个什么现场

### 现场布置(fixtures 就是道具)

```
fixtures/
  world-a/                              ← 「世界 A」= 一个普通目录
    node_modules/twin-pkg/index.js      ←   装了一个叫 twin-pkg 的包,内容是 A
    via-front-door.js                   ←   一个只写了一句话的文件(见下)
  world-b/                              ← 「世界 B」
    node_modules/twin-pkg/index.js      ←   同名的包!内容是 B
    via-front-door.js                   ←   一模一样的那句话
```

关键道具:**两个同名但内容不同的包**,和**两份一字不差的代码**:

```js
// via-front-door.js(world-a 和 world-b 里各一份,内容完全相同)
export async function load() {
  return import('twin-pkg')   // 就这一句:给我 twin-pkg
}
```

### 实验一·前门:同一句话,两种结果

```
住在 world-a 的文件拿到 = A     ← Node 从 .../world-a/ 开始找 → 那里的 twin-pkg
住在 world-b 的文件拿到 = B     ← Node 从 .../world-b/ 开始找 → 那里的 twin-pkg
```

**一字不差的代码,结果不同——唯一的变量是代码住在哪。**就像「隔壁的便利店」这句话,
从你家说和从我家说,指的是两家不同的店。这就是「`await import()` 的身份不可指定」
的全部含义:它永远按「说话人的住址」理解。

### 实验二·后门:把「住址」变成参数

`internal.import` 的第二个参数**就是那个被藏起来的输入**:

```
internal.import('twin-pkg', worldA 的地址) → A
internal.import('twin-pkg', worldB 的地址) → B
```

我坐在哪里都无所谓——**我指定「当作我在 world-a 说这句话」**。cordis-plugin-loader
正是这么干的:它自己住在 `.pnpm` 深处,但加载 `cordis.yml` 里的包时传 `ctx.baseUrl`
(你的项目根),等于说「当作我在用户项目里说这句话」。

### 实验三·同一本账:验「同一实例」

两个 twin-pkg 里各有一个 `Symbol()`——模块每被**加载成一份实例**,就生成一个新 Symbol。
所以 Symbol 相不相等 = 是不是同一个实例:

```
内部档要两次 world-a             → 同实例(缓存命中)
内部档 vs 前门(都指向 world-a)  → 同实例 ← 两条路,一本账
world-a vs world-b              → 不同实例 ← URL 不同,理应两份
```

### 实验四·resolveSync:把「从哪找」直接摊开

`resolveSync(包名, 起点)` 只做「解析」不做加载,返回绝对路径——亲眼看到同一个包名
配不同起点,解析出**两个不同的文件路径**;还有真实对照:`dsh-tools` @ 仓库根 ✅ /
@ /private/tmp ❌ Cannot find package。

### 无旗子模式(本身就是展品)

不带 `--expose-internals` 跑,连不上 Node 内部加载器(两扇门没开)→ 实验二~四自动
跳过,**进程不报错**——这正是 cordis-plugin-loader "documented no-internals path"
降级行为的复刻:拿不到内部档,退回普通 `await import()`(相对路径 `new URL(name, baseUrl)`,
裸包名按 loader 包自身位置解析)。

## 组织:目录树 = 论证树

```
fixtures/
  world-a/node_modules/twin-pkg/   # 同名包,内容 'A',marker = Symbol('…@world-a')
  world-b/node_modules/twin-pkg/   # 同名包,内容 'B',marker = Symbol('…@world-b')
  world-a/via-front-door.js        # 前门助手:住在 A,它的 await import 永远拿到 A
  world-b/via-front-door.js        # 同款文件,住在 B
src/
  internal-loader.ts               # 复刻 cordis-plugin-loader 的两扇门 + 能力检测
  main.ts                          # 串场:模式检测 + 四实验
  loading.test.ts                  # 子进程双模式锁定
```

## 看点提示

- **marker = Symbol 是模块实例的指纹**:比 JSON 内容比对严格——内容可以相同,实例是
  唯一的;两个加载路线拿到同一 Symbol ⟺ 同一实例。
- **fixtures 的 node_modules 是仓库的一部分**(gitignore 反排除):它们是实验装置,
  不是依赖——顺便演示了「node_modules 目录名本身就是解析算法的一部分」。
- **main.ts 自身用计算 URL 的动态 import 取助手文件**(`import(new URL(...).href)`):
  助手的身份必须来自它的住址,加载路线无所谓——绝对 URL 交给进程加载器即可。

## 回到原始问题

「loader 是 async import 吗?」——是,但当它要加载**别人项目里的包**时,普通
`await import()` 会按「loader 包自己的住址」找(找不到你的包),所以它优先翻进内部
拿加载器本体,把「从哪找」指定成你的项目根。本 demo = 把这背后的两个机制各做成
一个可以亲眼看的实验。

## 刻意省了什么

- 门二(node-addon-require-builtin):需原生插件,未装——注释说明姿势即可
- v2 形状(Node 24.12+ 的 getOrCreateModuleJob):本机 Node 22.19 是 v1,能力检测
  逻辑写好但无法在本机验证第二分支
- tsx/loader hook 链(register 钩子如何让原生 loader 认识 .ts)——demo 04 已实测现象,
  钩子机制本身留给源码拆解篇
