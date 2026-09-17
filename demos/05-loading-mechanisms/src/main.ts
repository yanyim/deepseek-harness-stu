/**
 * demos/05 · import 的第二个输入 —— await import vs internal.import 双机制演示
 *
 * 对应笔记:qa/02 附录四 §1.5(两种加载机制)与 §1(cordis-plugin-loader 两档)
 * 运行:pnpm demo:05(= node --expose-internals 本文件)
 *       不带旗子跑 `node src/main.ts` 也安全:自动降级为"兜底档"模式,前门实验照常。
 *
 * 论证线(剧本行 = 论证句):
 *   实验一 前门:同一句 import('twin-pkg'),写在两个世界的文件里 → 拿到两个不同的包
 *   实验二 后门:同一句查询,身份(parentURL)是参数 → 想要哪个世界给哪个
 *   实验三 同一本账:内部档两次、内部档 vs 前门,同 URL → 同实例(Symbol 指纹相等)
 *   实验四 解析视角:resolveSync 把"起点决定终点"直接摊开(含真实 dsh-tools 双起点对照)
 */
import { fileURLToPath } from 'node:url'

import { fromInternal } from './internal-loader.ts'

/** twin-pkg 的模块面(两个世界同构)。 */
interface TwinModule {
  world: string
  marker: symbol
}

const demoDir = new URL('..', import.meta.url) // demos/05-loading-mechanisms/
const worldA = new URL('fixtures/world-a/', demoDir)
const worldB = new URL('fixtures/world-b/', demoDir)
const repoRoot = new URL('../../', demoDir) // deepseek-harness-stu/(demoDir 已在 05 层,再退两层)

const out: string[] = []
const say = (line: string) => {
  out.push(line)
  console.log(line)
}

// ── 模式检测:两扇门开了吗 ─────────────────────────────────────────
const internal = fromInternal()
say(`[模式] --expose-internals:${process.execArgv.includes('--expose-internals') ? '开' : '关'};内部加载器档:${internal ? '可用' : '不可用(→cordis-plugin-loader 此形态走兜底档:相对路径 new URL(name, baseUrl),裸包名按 loader 包自身位置解析)'}`)

// 加载 fixtures 里的前门助手(计算 URL 的动态 import:助手文件的"住址"决定它的身份)
const frontDoor = async (world: URL): Promise<TwinModule> => {
  const helper = (await import(new URL('via-front-door.js', world).href)) as {
    load: () => Promise<TwinModule>
  }
  return helper.load()
}

// ── 实验一:前门——身份 = 调用文件的住址,不可指定 ───────────────────
say('[实验一·前门] 同一句 await import(\'twin-pkg\'),写在两个世界的文件里:')
const viaA = await frontDoor(worldA)
const viaB = await frontDoor(worldB)
say(`  住在 world-a 的文件拿到 = ${viaA.world}`)
say(`  住在 world-b 的文件拿到 = ${viaB.world}`)
say(`  身份(文件住址)决定你看见谁;await import 的身份不可指定——这就是"按本人身份办理"`)

if (internal) {
  // ── 实验二:后门——身份是参数 ───────────────────────────────────
  say('[实验二·后门] 同一句查询,身份(parentURL)是我传的参数:')
  const backA = (await internal.import('twin-pkg', worldA.href, {})) as TwinModule
  const backB = (await internal.import('twin-pkg', worldB.href, {})) as TwinModule
  say(`  import('twin-pkg', world-a) = ${backA.world}`)
  say(`  import('twin-pkg', world-b) = ${backB.world}`)
  say('  loader 插件就是这样以 ctx.baseUrl 为身份加载用户插件的裸包名')

  // ── 实验三:同一本账——进程唯一的模块缓存 ─────────────────────────
  say('[实验三·同一本账] Symbol 指纹比对(每个模块实例的 marker 唯一):')
  const againA = (await internal.import('twin-pkg', worldA.href, {})) as TwinModule
  say(`  内部档两次取 world-a:同实例? ${againA.marker === backA.marker ? '是' : '否(两份!)'}`)
  say(`  内部档 vs 前门(world-a 同一 URL 两条路):同实例? ${backA.marker === viaA.marker ? '是——进程只有一本模块缓存' : '否(两份!)'}`)
  say(`  跨世界对照:world-a vs world-b 的实例? ${backA.marker === backB.marker ? '相同(不对!)' : '不同(正确的两份——URL 不同,理应两份)'}`)

  // ── 实验四:解析视角——起点决定终点 ─────────────────────────────
  say('[实验四·resolveSync] 同一查询、不同起点,摊开看:')
  say(`  twin-pkg @ world-a → ${fileURLToPath(new URL(internal.resolveSync('twin-pkg', worldA.href).url))}`)
  say(`  twin-pkg @ world-b → ${fileURLToPath(new URL(internal.resolveSync('twin-pkg', worldB.href).url))}`)
  try {
    internal.resolveSync('@deepseek-ai/dsh-tools', 'file:///private/tmp/')
    say('  dsh-tools @ /tmp → (不该成功)')
  } catch (error) {
    say(`  dsh-tools @ /private/tmp → ❌ ${(error as Error).message.split('\n')[0].slice(0, 60)}`)
  }
  say(`  dsh-tools @ 仓库根 → ✅ ${fileURLToPath(new URL(internal.resolveSync('@deepseek-ai/dsh-tools', repoRoot.href).url)).split('node_modules')[0]}…/node_modules`)
} else {
  say('[实验二~四·跳过] 内部档不可用(两扇门均未开)。带旗子重跑可看全:node --expose-internals src/main.ts')
}
