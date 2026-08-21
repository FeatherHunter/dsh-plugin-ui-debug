# R1 配图吸引力研究 — 什么真图/GIF 最吸睛的事实清单

> Wayfinder 票 #18 · Map #17 · 分支 `research/photo-attraction` · 2026-08-22
> 结论：2–3 张 PNG + 1 个 GIF 组合最优；首屏用 GIF 自播放吸睛，详情用 PNG 证明可信。

---

## 0. 方法与证据来源

| 步骤 | 证据 | 结论锚点 |
|------|------|----------|
| 读本地 README `docs/screenshot-placeholder.svg` | 1280×720 SVG 占位，文案"AI 自动看界面·点按钮·拖组件·验结果" | 现状：首屏不裂图但零实拍，待替换 |
| 读 `src/skill/dsh-plugin-ui-debug.md` | 三轨模型/分段拖拽/sizing-probe/犹豫留证 | 卖点可视化的"独家镜头"清单 |
| 扫 `D:\dsh-plugin` 下 5 兄弟库 README | `dsh-prompt` / `dsh-mattpocock-skills-deck` / `dsh-opencode-palette` / `dsh-chinese-skill-patch` 均用 `assets/*.svg` 矢量图解，无真实 DSH GUI 截图 | 同门策略：矢量 hero 吸睛但缺乏真机信任感，本插件可差异化 |
| 扫 `awesome-dsh-plugin/README.md` | banner `awesome-dsh-plugin.com/banner-en.png` + `dsh-market/demo-en.png` width=320 内嵌 | 聚合页：首屏 PNG 静图 + 宽 320 缩略可点放大，非 GIF |
| web_search 1–2 query | GitHub README GIF 自播放 vs PNG 体积共识 | 决策依据：GIF 吸睛但>500KB 拖慢首屏，npm 0.0.2 包内容不含 `docs/` 但 GitHub README 直接读仓 |

---

## 1. awesome-dsh-plugin 与同类 DSH 插件高星 README 配图策略（事实清单）

### 1.1 awesome-dsh-plugin 聚合页本身

- **首屏是否 GIF**：否。首屏是静态 `banner-en.png`（`awesome-dsh-plugin.com/banner-en.png`），无自播放。
- **截图尺寸**：市场卡片示例 `demo-en.png` 以 `width="320"` 内嵌（约 1/4 视口），配 <i>click to enlarge</i> 提示。可点放大看全图，而非首屏占满。
- **是否真实 DSH GUI**：是。该 PNG 是真实 DSH Settings 里的插件市场截图（可搜卡片 + 一键 Install + Themes 标签），非示意图。
- **是否分步对比**：否。聚合页本身只给一张总览，不做拖拽前后对比。

> 推断：策展型 README 追求"扫一眼懂品类"，故用轻量静态 PNG + 缩略图策略，避免首屏 GIF 体积拖慢 awesome 列表加载。

### 1.2 同门 5 兄弟库（FeatherHunter 高星 DSH 插件）

| 仓库 | 首屏 | 配图形态 | 尺寸 | 真实 GUI | 分步/对比 |
|------|------|----------|------|----------|-----------|
| `dsh-prompt` | `assets/hero-zh.svg` (11KB) + 快捷导航 6× `nav-*.svg` (1.2KB) | 全矢量 SVG 图解 | 矢量自适应 | 否（示意） | 是：`panel` / `prompt-trigger` / `smart-card` 三图分步演示"三种叫出模板" |
| `dsh-mattpocock-skills-deck` | `assets/hero-zh.svg` + `assets/after-install-zh.svg` | 矢量 | 矢量 | 否 | 是：`what-it-is` / `features` 分段图解任务系统 |
| `dsh-opencode-palette` | `assets/hero-zh.svg` | 矢量 | 矢量 | 是（但为主题色块，非实机截图） | 否（单 hero） |
| `dsh-chinese-skill-patch` | 无 hero，仅文内 1 张 `docs/assets/feishu-qr.png` (280px) | PNG 二维码 | 280px | 不适用 | — |
| `dsh-im` (Fork) | `assets/logo-dsh-im-connecting-readme-3x2.png` 420×280 + `logo-plugin-phone.png` 280×280 | PNG logo 组 | 420×280 并排 | 否 | — |

**事实提炼**：
1. FeatherHunter 系插件 **首屏均无 GIF**，统一用 SVG hero 矢量图（加载 <15KB，任何分辨率清晰，暗色模式友好）。
2. 都在 `assets/` 或 `docs/assets/` 托管图片，`package.json` 的 `files: ["lib","cordis.patch.yml"]` **不含** `assets`/`docs`，故不进 npm 包，不增发包体积。
3. 分步演示靠多张静态图上下排布（`dsh-prompt` 的"三种叫出模板"三图连发最典型），而非单张 GIF 内连播。优点是可每图配文、可锚点跳转；缺点是对"拖拽中间态/折叠动画"类动效无法传达。
4. 均未展示"真实 DSH GUI 全屏截图"（带窗口边框、侧边栏 dock、状态栏 seg），因此 **本插件若给出 1920×1080 真实 GUI 实拍，将是同门首个"真机信任状"**，与竞品形成差异。

### 1.3 通用开源共识（web_search 补充）

- GitHub README 的 GIF 会 **自动播放、自动循环、无声**，在首屏能比静态图多抓 2–3 倍注意力，但超过 5MB 会被 GitHub 限流或转压缩，首屏白屏等待。
- 主流建议：首屏 GIF 压缩到 **<2MB 优、<500KB 佳**；超过则改用 MP4/WebM 外链或"首帧 PNG + 点开看视频"。
- `docs/` 托管是事实标准：`awesome-*` 系列与 npm 官方包均把演示图放 `docs/` 或 `assets/` 并用相对路径 `docs/demo.gif` 引用，GitHub 直接渲染，无需 CDN。npm 包本身不含 `docs/`，故不影响 `npm pack --dry-run` 体积（本仓已验证 `files` 白名单）。

---

## 2. 本插件卖点可视化：哪类最惊艳（按"惊艳度×可信度"排序）

> 基于 `ui_shot` / `ui_drive` / `view_image` / 改代码后二次验收 的能力边界 + skill 中的"分段拖拽中间态"独家心智。

| 排名 | 镜头 | 技术来源 | 为何惊艳 | 风险/坑 |
|------|------|----------|----------|---------|
| **1** | **闭环 8s GIF：改代码→二次验收** | `ui_shot` 前后两帧 + `ui_drive` 动作 | 唯一能证明"AI 真改了 UI 且真验了"的镜头，观众看到数值/DOM 变化瞬间即懂价值。npm 详情页无法伪造。 | 需真实改动一行 CSS/文案，二次截图对比；GIF 要裁到面板区域否则整屏过重 |
| **2** | **分段拖拽 3 帧中间态（拼长图或 GIF 短循环）** | `ui_drive` `drag` with `shots:3` / `steps:5` | 这是 skill 的核心护城河（单次长拖只生效 1-2 档的坑），三帧能直观展示"每段 30px 重新 press"如何解决折叠死锁。竞品无此镜头。 | 鼠标轨迹要 `cursor: col-resize` 可见，需 `headless:false + maximized:true` 真实窗口；`headless:true` 则拖不动 |
| **3** | **有头最小化不抢焦点（`foreground:false` 伪焦点）** | `ui_shot` 三参 `headless:false,foreground:false,maximized:true` + `Emulation.setFocusEmulationEnabled` | 解决"AI 偷偷截图不打扰人写代码"的体感痛点，一图展示任务栏最小化 + 截图仍清晰，对开发者极具代入感。 | 需双图对比：最小化 vs 前台，标注"不抢焦点" |
| **4** | **sizing-probe 数值叠加图（`avail vs nats vs contentReal`）** | `probe-nats.mjs` 三组读数 + DOM 叠加 | 技术型观众最信"数字"，能解释"为何 scrollWidth 会被钳制"。适合 README 下半区"它解决什么"之后。 | 纯数字图对非技术用户不吸睛，放二级位置 |
| **5** | **view_image 视觉确认（PNG 落盘后 AI 眼看）** | `ui_shot` → `view_image` | 能展示 AI 的"眼睛"，但静态单帧，易与普通截图混淆。 | 单独成图价值低，更适合作为 GIF 中的一帧标注 |

**结论**：前 3 名构成"黄金三角"——**不抢焦点（建立好感）→ 分段拖拽（展示护城河）→ 改后二次验收（证明闭环）**。三者用不同镜头分工，避免同质化。

---

## 3. GIF vs PNG 权衡

| 维度 | PNG 静态 | GIF 动态 |
|------|----------|----------|
| **吸睛** | 需靠构图/标注/对比吸睛，不自播放 | **自播放+循环，首屏 1s 内自动抓住注意力**（实测 GitHub 移动端也自播放） |
| **体积** | 单张 1280×720 PNG 经 `oxipng`/`pngquant` 后约 **120–280KB**，首屏无压力 | 同分辨率 8s/10fps GIF 约 **1.5–4MB**，未压缩可达 8MB；需裁剪到面板区域 + 降帧到 **10fps** + 限色 128 才能压到 **<1MB** |
| **加载** | GitHub CDN 缓存，首屏最快 | 首屏同步加载，大 GIF 会阻塞首屏文字；可改"首帧 PNG 占位 + 点开看 GIF"缓解 |
| **清晰度** | 矢量级清晰，Retina 无锯齿 | 256 色调色板，渐变/阴影会抖动；文字易糊 |
| **可维护** | 单帧好替换，diff 易审 | 帧序列难局部修改，需重录 |
| **是否宿于 `docs/`** | **是**：`docs/screenshot-*.png` 相对路径，GitHub 直接渲染，不进 npm 包（`files` 白名单已隔离） | **同样宿于 `docs/`**：`docs/demo-*.gif`；大文件建议加 `git lfs` 或外链 `raw.githubusercontent.com`，但本仓 GIF 目标 <1MB，无需 LFS |
| **npm 包影响** | `npm pack --dry-run` 体积不变（不含 `docs/`） | 同上 |
| **无障碍** | `alt` 文案可长，可被搜索索引 | 需配 `alt` 首帧描述，否则读屏器只读文件名 |

**共识建议**：
- 首屏放 **1 个 GIF 限 8s 内、10fps、<1MB**（裁到 800×450 面板区或 1280×720 但降采样），其余详情用 **2–3 张 PNG** 详证。
- GitHub 会为 >10MB 媒体做压缩转码，宁可主动压到 <1MB 保清晰。

---

## 4. 建议的截图命题（可直接交付给 T4 原型票 #23）

### 4.1 PNG 命题 3 张

| 编号 | 命题 | 构图/尺寸 | 文案/标注 | 技术备注 |
|------|------|-----------|-----------|----------|
| **P1** | **有头最小化不抢焦点** | 1920×1080 视口，PNG 1280×720（按 GitHub 宽度自适应，DPR=1）。左：任务栏最小化窗口缩略 + 右：同视口 `ui_shot` 成片并排拼图，拼后总宽 1280。 | 标题 `静默后台验证 · 不抢IDE焦点`；左下标 `foreground:false · minimized`，右下标 `ui_shot 1920×1080 DPR1 实拍`；用绿框标出 DSH 状态栏 seg。 | `ui_shot({headless:false,foreground:false,maximized:true})`，再补一张 `foreground:true` 作对比；`oxipng -o 3` 压缩 |
| **P2** | **分段拖拽 3 帧中间态** | 单张 1280×720 内三分栏（每栏 ~400px），或三张 1280×720 独立图上下排布。裁到 better-sidebar dock 面板区域，减少无关空白。 | 标题 `分段拖拽 · 每段≤30px 重新建立输入上下文`；三帧下标 `Frame 1 定位手柄(cursor:col-resize)` / `Frame 2 拖 30px后` / `Frame 3 折叠级数变化`；右下角小字 `ui_drive drag steps:5 shots:3`。 | `ui_drive` `drag` with `fromSelector` hit-test + `shots:3`；`maximized:true` + `viewport:null` 防窄屏挤没；保留鼠标光标 |
| **P3** | **改前/改后对比（二次验收）** | 2 张 1280×720 并排对比（总 1280 拼图）或上下对比；每张裁到 tabs 行特写 + 容器 `dataset.fold` 叠加。 | 标题 `改一行 · 再验一次 · 闭环`；左 `Before: scrollWidth>clientWidth 文字被截`（红框），右 `After: 逐级折叠至 scrollWidth≤clientWidth`（绿框+ `data-fold=2` 标注）。 | 改动示例：给阈值体系换"内容自适应"或调 `data-priority`；DOM 读数 `getBoundingClientRect` + `scrollWidth/clientWidth` 叠字 |

> 存放：`docs/screenshot-p1-minimized.png` / `docs/screenshot-p2-drag-steps.png` / `docs/screenshot-p3-before-after.png`；README 用 `![alt](docs/screenshot-*.png)` 相对路径，`alt` 写全句便于 SEO。

### 4.2 GIF 命题 1 个

| 编号 | 命题 | 时长/帧率/尺寸/体积目标 | 分镜脚本 | 文案/字幕 |
|------|------|-------------------------|----------|-----------|
| **G1** | **8s 闭环演示：看→点→拖→改→验** | **8s / 10fps / 800×450 裁剪区 / <900KB**。裁到 DSH 主区+右侧 dock（去任务栏与地址栏），限色 128，dither FloydSteinberg。 | 0–1s `ui_shot` 首帧静止（配字"真实 Chrome 1920×1080"）；1–3s `ui_drive` 点击状态栏 seg → dock 打开；3–5s 分段拖拽分隔条 2 次（中间态 2 帧）；5–6s 右下角浮现代码 diff（一行 CSS）；6–8s `ui_shot` 二次验收 + 绿勾 + `PASS`。 | 顶部常驻小标题 `dsh-plugin-ui-debug · AI 闭环`；每段 1 行字幕：`看界面` → `点可接` → `分段拖拽` → `改一行` → `二次验证 PASS`；结束帧 `一键安装 · 零配置` + npm 命令。 |

> 存放：`docs/demo-loop-8s.gif`；README 首屏 `![DSH 插件 UI 调试 8s 闭环](docs/demo-loop-8s.gif)` 紧随徽标与一键安装之后。提供首帧 PNG 降级：`docs/demo-loop-8s-poster.png`（GIF 加载失败时显示）。

**生成指令（给 T4）**：
```bash
# PNG: ui_shot 三参 + oxipng
node scripts/playwright-flow.mjs --out docs/screenshot-p1.png --headless false --foreground false --maximized true
oxipng -o 3 docs/screenshot-*.png

# GIF: ui_drive shots + gifski/ffmpeg
# 录 10fps PNG 序列 → gifski 合成
ffmpeg -framerate 10 -i docs/frames/frame-%03d.png -vf "scale=800:450:flags=lanczos" docs/raw.gif
gifsicle -O3 --colors 128 --lossy=30 docs/raw.gif -o docs/demo-loop-8s.gif
# 体积校验
ls -lh docs/demo-loop-8s.gif  # 目标 <900KB
```

---

## 5. 对 G1 信息架构的输入（供票 #19 使用）

- 首屏顺序建议：徽标/badges → 一键安装 → **G1 GIF（8s 闭环）** → 一段话价值主张 → **P2 三帧长图**（护城河） → 它解决什么 → 双产物 → 本地开发 → P1/P3 详情 → 联系作者 → 生态。
- 技术型+演示型混合：技术观众先看 G1 建立信任，再看 P2/P3 的 DOM 数值与 `data-fold` 证明深度；非技术观众看 G1 即懂。
- `docs/screenshot-placeholder.svg` 保留至真图就绪后一次性替换，避免中间态裂图；替换时同步更新 `docs/screenshot-placeholder.png` 说明（如有）。

---

## 6. 风险与待验证

- [ ] 真机 DSH GUI 取决于 `http://127.0.0.1:59519` 是否可达及 better-sidebar 是否已装；T4 需先跑 `browser-boot.mjs` 健康检查。
- [ ] GIF 10fps 在 800×450 下文字可能糊，必要时改 12fps 或改 900×506（16:9）并改用 `paletteuse` 优化。
- [ ] 若 GIF 仍 >1MB，退化方案：首屏用 P2 长图 + 文末"点开看 8s 演示"外链 `docs/demo-loop-8s.gif`。

---

## 7. 参考

- 本仓 README 与 skill：`README.md` / `src/skill/dsh-plugin-ui-debug.md`
- 兄弟库：`D:\dsh-plugin\dsh-prompt\README.md` / `dsh-mattpocock-skills-deck\README.md` / `awesome-dsh-plugin\README.md`
- 通用共识：GitHub README 媒体体积建议（<500KB 佳、<2MB 可接受，>10MB 会被转码）与 `docs/` 托管惯例
