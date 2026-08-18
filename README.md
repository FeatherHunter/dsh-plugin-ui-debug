# @dsh-external/dsh-plugin-ui-debug

**DSH 插件 UI 调试闭环工具** — 给开发/测试 DSH 插件的 AI 提供「真实 Chrome (Playwright) 驱动 + UI 查看/测试/验证/问题解决」全套能力。

> 安装本插件后，**自动注册同名 skill（`dsh-plugin-ui-debug`）**，任何 session 的 AI 在调试 DSH 插件 UI 时都会自动获得这套方法论（激活会话 → hit-test → 分段拖拽 → DOM 断言 → sizing-probe → 犹豫留证），无需任何手工配置。

## 它解决什么

DSH 插件（面板 / dock / tabs / 弹窗 / 布局 / 交互）的 UI bug，AI 需要真实打开浏览器去看、去点、去拖、去读 DOM 数值才能定位和验证。本插件提供：

- **`ui_shot`** — 截图任意 http(s) 页面（含运行中的 DSH GUI），PNG 落盘，供 view_image 视觉确认。
- **`ui_drive`** — 动作脚本驱动页面（导航/点击/输入/按键/滚动/拖拽/分步截图/JS 求值），用于 UI 调试与断言。
- **`dsh-plugin-ui-debug` skill** — 随插件自动注册的调试方法论（含已验证的坑与最佳实践）。

## 双产物设计

| 产物 | 形态 | 作用 |
|---|---|---|
| Plugin | host 工具插件（`ui_shot` / `ui_drive`） | AI 的"手"——真实驱动浏览器 |
| Skill | 随 `apply()` 用 `ctx.skills.register()` 原生注册 | AI 的"脑"——知道怎么用、有什么坑 |

两个产物在同一源码仓库，随包分发。skill 通过 DSH 原生 runtime skill 注册机制注入，**零文件写入、零本机路径硬编码**，装到任何机器都自动生效。

## 安装

```bash
# 方式 1：本地构建注入（开发期）
cd dsh-plugin-ui-debug
# 构建（依赖 bash + node）：scripts/build.sh（tsc 编译 + 复制 skill 资源到 lib/skill）
bash scripts/build.sh
# 注入器环境内
dev_inject_plugin <本目录>
```

```bash
# 方式 2：GitHub Release 安装
# 从 Release 下载 dsh-plugin-ui-debug-<version>.tgz，按 DSH 插件安装流程装配
```

## 构建链说明

本机无 dsh 源码 checkout 时的构建（npm 装依赖报 edgesOut 坏图时）：

```bash
corepack pnpm add -D typescript@^5.9 @types/node@^24 tsdown@^0.22.14 playwright-core@^1.62.1
# 把 agent 的 @deepseek-ai/* junction 到 node_modules/@deepseek-ai 供 tsc 解析类型
node node_modules/typescript/bin/tsc -p tsconfig.json
# 复制 skill 资源（tsc 不复制 .md，build.sh 已含此步）
mkdir -p lib/skill && cp src/skill/*.md lib/skill/
```

## 目录结构

```
dsh-plugin-ui-debug/
├── package.json          # @dsh-external/dsh-plugin-ui-debug
├── src/
│   ├── index.ts          # 插件入口：注册 ui_shot/ui_drive 工具 + ctx.skills.register()
│   ├── cdp.ts            # 零依赖 CDP 引擎（Node 22 WebSocket，attach/launch）
│   └── skill/
│       └── dsh-plugin-ui-debug.md   # skill 正文（打包到 lib/skill/）
├── scripts/              # 验证/调试脚本（poc-*、playwright-flow3 等）
└── lib/                  # 构建产物（含 lib/skill/）
```

## License

BSD-3-Clause（见 LICENSE）。
