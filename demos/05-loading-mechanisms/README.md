# Demo 05 · import 的第二个输入:await import vs internal.import

回答的问题(出自笔记库 `qa/02-附录四` §1.5):`await import()` 和 `eval` 之外,
cordis-plugin-loader 的「首选档」`internal.import` 是什么机制?

**答案一句话**:`import` 有一个被语法糖藏起来的第二输入——解析起点 parentURL。
`await import()` 把它自动填成「写这行代码的文件」(身份不可指定);拿到 Node 内部
加载器本体后,起点**成了你传的参数**。两个世界放同名包,前门按住址取货、后门按
指定身份取货——「你是谁决定你看见谁」变成可运行的实验。

## 运行

```sh
pnpm demo:05    # node --expose-internals src/main.ts(四实验全跑)
node demos/05-loading-mechanisms/src/main.ts   # 无旗子:前门实验照常,内部档优雅降级
pnpm test       # spawn 真实 node 子进程,双模式输出整列锁定
```

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

## 四实验 ↔ 机制 ↔ 对照

| 实验 | 演示 | 一句话 |
|---|---|---|
| 一·前门 | 同一句 `import('twin-pkg')` 写在两个世界的文件里 → 拿到 A / B | 身份=文件住址,不可指定 |
| 二·后门 | `internal.import('twin-pkg', worldA/worldB)` → A / B | 身份是参数;loader 插件以 ctx.baseUrl 为身份 |
| 三·同一本账 | Symbol 指纹:内部档两次同实例;内部档 vs 前门同实例;跨世界不同(理应两份) | 进程唯一模块缓存,按绝对 URL 记账 |
| 四·resolveSync | twin-pkg 双起点双 URL;dsh-tools @ 仓库根 ✅ / @ /tmp ❌ | 起点决定终点,直接摊开 |

## 看点提示

- **marker = Symbol 是模块实例的指纹**:每个模块实例求值时各生成一个;两个加载路线
  拿到同一 Symbol ⟺ 同一实例——比 JSON 内容比对严格得多(内容可以相同,实例是唯一的)。
- **无旗子模式本身是展品**:两扇门都关 → `fromInternal()` 返回 undefined → 实验二~四
  跳过但进程不炸——与 cordis-plugin-loader 的 "documented no-internals path" 同款
  防御性降级;此时 loader 插件走兜底档(相对路径 `new URL(name, baseUrl)`,裸包名
  按 loader 包自身位置解析)。
- **fixtures 的 node_modules 是仓库的一部分**(gitignore 反排除):它们是实验装置,
  不是依赖——这也顺便演示了「node_modules 目录名本身就是解析算法的一部分」。
- **main.ts 自身用计算 URL 的动态 import 取助手文件**(`import(new URL(...).href)`):
  因为助手的身份必须来自它的住址,加载路线无所谓——绝对 URL 交给进程加载器即可。

## 刻意省了什么

- 门二(node-addon-require-builtin):需原生插件,未装——注释说明姿势即可
- v2 形状(Node 24.12+ 的 getOrCreateModuleJob):本机 Node 22.19 是 v1,能力检测
  逻辑写好但无法在本机验证第二分支
- tsx/loader hook 链(register 钩子如何让原生 loader 认识 .ts)——demo 04 已实测现象,
  钩子机制本身留给源码拆解篇
