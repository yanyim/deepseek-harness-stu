# deepseek-harness-stu · DeepSeek Harness 学习实践仓库

本仓库用于学习 DeepSeek Harness(dsh,基于 Cordis 的「一切皆插件」Agent 框架):跑通教程 demo、重写验证、编写测试用例。

## 资源坐标

| 资源 | 位置 |
|---|---|
| dsh 源码(阅读对象) | `/Users/yzj_03/projects/stu/deepseek-harness` |
| Obsidian 笔记库 | `/Users/yzj_03/store/ysnnn/ysnnn3/TECH-开源项目/deepseek-harness/` |
| 笔记入口 | 上述目录下 `学习大纲.md`(学习路线 + 进度清单) |
| 教程收录 | 笔记库 `dsh-harness-tutorial/`(正文 + 参考代码 demos/ + final-project) |
| 官方文档收录 | 笔记库 `官方文档/`(160 篇中文,guide/develop/reference/postmortem) |

⚠️ **版本差**:本地 dsh 检出停在 `0a53fb5`(0.1.2-alpha.2,2026-08-30),落后 origin/master 约 2717 提交;笔记库中的官方文档取自 origin/master(`0d1f500`,2026-09-16 fetch)。读码与文档不符时先怀疑版本差,用 `git -C /Users/yzj_03/projects/stu/deepseek-harness show origin/master:<路径>` 看最新版。

## 工作约定

- 学习路径:① 原理篇 8 章 → ② 源码拆解 6 章 → ③ 实战 Demo 8 个 → ④ 教学项目 mini-harness(详见笔记库学习大纲)
- 每学一章:先跑通教程参考代码 → 在本仓库重写 → 写测试锁定行为;总结记入笔记库
- 学习问答(Q&A)产生的结论落笔记库 `dsh-harness-tutorial/qa/NN-*.md`,配套 demo 落本仓库 `demos/`,两者互相链接
- **会话交接:根目录 `HANDOVER.md` 是进度+背景知识速查文档;开工先读,收尾(每完成一个 demo/qa)更新它**
- 教学项目 mini-harness 不抄答案,卡住才看 `dsh-harness-tutorial/参考代码/final-project/`
- 常规操作直接执行,无需反复确认(用户已授权)
- 运行环境:Node ≥ 20.19(实际用 22.19);教程 demo 从 Demo 4 起可用 Mock 适配器,无需 API Key

## 目录约定

```
demos/NN-主题/                  # 每个 demo 一个目录;NN=本仓库创建顺序,主题对应笔记章节或 qa
  README.md                     # 困境/总图:演示什么、怎么跑、解法↔dsh源码↔笔记对照、刻意省了什么
  src/main.ts                   # 串场入口(叙事顺序=论证顺序);根 package.json 注册 demo:NN 脚本
  src/<单元>/                   # 按「目标→解题思路」分单元,目录树=论证树(不按文件类型归堆)
    <解法>.ts                   #   每个源文件头固定三段:目标/思路/对照(dsh 哪个包)
    <单元>.test.ts              #   测试与被测单元同目录,锁定行为
```

- 单元划分原则:一个目录 = 一个论点(问题/目标 + 解法们);公共地基放 `stage/`(或类似公共单元)
- 只用可擦除 TS 语法(Node strip-types 限制):禁 enum / namespace / 构造器参数属性;abstract 方法用「缺省抛错」表达
- 类型断言(`// @ts-expect-error`)配合 `pnpm typecheck` 也算测试的一部分
- 收尾三绿:`pnpm typecheck` + `pnpm demo:NN` + `pnpm test`
