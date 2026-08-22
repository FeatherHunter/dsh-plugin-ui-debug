# G1 README 信息架构与视觉策略 — 定版大纲

> Wayfinder 票 #19 · Map #17 · 依赖 R1 #18 `photo-attraction.md` e0adfbc · 2026-08-22
> 目标：把 Map#17 “技术型+演示型混合” 操作化为可直接交付给 T4（截图）与最终 README 重塑的章节顺序、文案、视觉阈值与占位。

---

## 0. 决策总览（5 项拍板）

| 决策 | 结论 | 依据 |
|------|------|------|
| 章节顺序 | 以 R1 §5 为基准，升级合并进一键安装二级标题，构建链折叠 | R1 §5 + 现 README 12段 vs 票10段取交集，去重保留 build chain |
| 首屏语言 | 标题保留英文包名 `@feather_wch/dsh-plugin-ui-debug`，副标题中文价值主张，行话仅下半区出现 | Q2 已澄清：中英混合，首屏自然语言 |
| 预览区文案分层 | GIF 旁 1 句总括 ≤28字 + P1/P2/P3 各 1 句 ≤36字 | Q3 已澄清：分层避免冗长 |
| 视觉阈值 | 徽标 3 个（npm/dsh-plugin/Playwright），PNG 1280×720 oxipng -o3 120–280KB，GIF 800×450 10fps 限色128 <900KB | Q4 已澄清：可测阈值 |
| 产出物位置与 DONE | `docs/research/readme-outline.md` + 可粘贴占位文案，1 人确认后解 Block #23 | Q5 已澄清：验收颗粒度到 URL/alt |

---

## 1. 章节顺序定版（H2 清单，共 11 段）

> 按阅读扫读时间与折叠线优化：首屏 1 屏内完成“徽标+价值主张+安装+GIF”，二屏进入技术论证，尾部收口联系与生态。

1. `# @feather_wch/dsh-plugin-ui-debug` + 徽标墙（3 枚，紧随标题）
2. 一句话价值主张（中文，自然语言，无 `ui_shot` 行话）
3. `## 一条命令完成安装`（含 `### 升级` 二级标题合并）
4. `## 预览` — G1 GIF 8s 闭环（首屏吸睛）
5. `## 预览 · 分段拖拽护城河` — P2 三帧长图（H3 子标题分述）
6. `## 它解决什么`（3 能力点：ui_shot / ui_drive / skill）
7. `## 双产物设计`（markdown 表格，Plugin vs Skill）
8. `## 本地开发安装`（方式 1 注入 + 方式 2 tgz 自测）
9. `## 构建链说明`（`<details><summary>` 折叠，默认收起）
10. `## 目录结构`（树状，含 `lib/skill` 打包说明）
11. `## 联系作者`（居中二维码 `docs/contact-feishu-qr.png` width=280 + 双通道文案）
12. `## 更多作品 · FeatherHunter DSH 生态`（5 库表格 + awesome 收口）
13. `## License`（BSD-3-Clause）

> 旧 `## 升级` 单独 H2 取消，合并为安装章节的 `### 升级`；`构建链说明` 由平铺改为折叠，避免首屏过长；P1/P3 详情并入预览二级区或作为生态前过渡，不单独占 H2。

---

## 2. 首屏语言定版

- **标题**：`# @feather_wch/dsh-plugin-ui-debug`（英文包名保留，npm 可搜）
- **徽标墙**：紧随标题下一行，3 枚英文徽标（见 §5），不含 downloads/license
- **价值主张**（标题下首段，加粗，中文 ≤36字）：
  > **DSH 插件 UI 调试闭环工具 — 给 DSH 插件的 AI 配备真实 Chrome 眼睛与手，静默后台看界面、分段拖拽验布局、改后再验闭环。**
- **行话策略**：首屏用自然语言“真实 Chrome · 不抢焦点 · 分段拖拽可验”，`ui_shot`/`ui_drive`/`sizing-probe` 仅在 `## 它解决什么` 及以下出现；徽标与安装命令保持英文
- **技术来源小字**（GIF 下方 1 行，灰字）：
  > `基于 Playwright CDP · 三轨模型 headless/maximized/foreground 正交 · 真实 Chrome 复用系统浏览器`

---

## 3. 预览区文案分层

### 3.1 GIF 旁总括句（≤28字，置于 GIF 上方或下方 1 行）

```
真实 Chrome 静默后台验证 · 不抢 IDE 焦点 · 分段拖拽闭环可验
```

> 28字以内，覆盖黄金三角前两角；技术型与演示型观众 1 秒内抓住价值。

### 3.2 P1/P2/P3 各 1 句卖点（各 ≤36字，配图下方小字）

- **P1 有头最小化不抢焦点**：
  > 有头最小化不抢焦点 — foreground:false 时 IDE 仍前台，截图仍 1280×720 清晰

- **P2 分段拖拽 3 帧**：
  > 分段拖拽三帧拼图 — 每段 ≤30px 重建输入上下文，破解折叠死锁直观可验

- **P3 改前/改后对比**：
  > 改一行再验一次 — scrollWidth vs clientWidth 数值对比，data-fold 逐级折叠至不溢出

> 三句分别对应 R1 命题 P1/P2/P3，避免与总括句重复；T4 需在拼图角落保留 `steps:5 shots:3` / `foreground:false` / `scrollWidth/clientWidth` 标注作为视觉锚点。

---

## 4. 视觉规范阈值（可测）

| 资产 | 规格 | 体积目标 | 工具 | 失败 fallback |
|------|------|----------|------|---------------|
| 徽标墙 | 3 枚：npm version / dsh-plugin topic / Playwright，style=flat-square | — | shields.io | 缺一则首屏信任感降，不可增至 4+ |
| PNG P1/P2/P3 | 1280×720（或拼后总宽 1280），DPR=1，`oxipng -o 3` 无损 | 单张 120–280KB 为优，硬上限 <400KB | `oxipng -o 3` | >400KB 改 `pngquant --quality 80-90` 再 `oxipng` |
| GIF G1 | 800×450 裁到主区+dock，去任务栏/地址栏，10fps，8s，限色 128 FloydSteinberg | <900KB 硬上限（R1 共识 <1MB，票要求 <900KB）| `ffmpeg palettegen→paletteuse` 或 `gifski --quality 80` | >900KB 则首屏改用 `docs/demo-closed-loop-poster.png` + 外链“点开看 8s 演示” |
| 圆角阴影 | 不改二进制，仅 README 展示层 CSS 阴影或 SVG 卡片底色 `#f6f8fa` | — | markdown 外层 `<div>` | 暗色模式下白底刺眼则保留占位 SVG 底色 |
| 表格 | 双产物与生态均用 markdown 表格，不用卡片 | — | — | 移动端表格横向滚动可接受 |

> `package.json files: ["lib","cordis.patch.yml"]` 不含 `docs/`，故以上资产不进 npm 包，`npm pack --dry-run` 体积不变（T3 已验证 11 文件 32.7kB）；GitHub 相对路径 `docs/...` 可渲染，但 npm 详情页不显示 — 验收注明“真图仅 GitHub 生效”。

---

## 5. H2/H3 标题清单 + 每段 1 句要点

| 序号 | 标题（H2/H3） | 1 句要点（中文可直接落 README） |
|------|---------------|-------------------------------|
| 1 | `# @feather_wch/dsh-plugin-ui-debug` | npm 包名即标题，英文字面可搜，中文副标题承载价值主张 |
| 2 | 徽标墙（无标题，紧随 H1） | 3 徽标证明“已发布·属 dsh-plugin 生态·基于 Playwright” |
| 3 | 价值主张段（加粗段落） | 一句话说清“给 AI 配真实 Chrome 眼睛与手，闭环调试 DSH 插件 UI” |
| 4 | `## 一条命令完成安装` | 先装 DSH CLI 再 `dsh plugin add`，零配置 bundle 自动装配 |
| 4.1 | `### 升级` | `dsh plugin update` 或幂等 `add`，可钉版本 `@<version>` |
| 5 | `## 预览` | 首屏 GIF 8s 闭环：看→点→拖→改→验，自播放无需点击 |
| 5.1 | `### 分段拖拽护城河` | P2 三帧拼图证明“每段 30px 重新 press”解决单次长拖死锁 |
| 6 | `## 它解决什么` | 3 原语：`ui_shot` 看界面、`ui_drive` 驱动、`skill` 知道坑 |
| 7 | `## 双产物设计` | 表格：Plugin 是手（工具） vs Skill 是脑（方法论），同仓分发 |
| 8 | `## 本地开发安装` | 方式 1 `bash scripts/build.sh + dev_inject` 方式 2 `npm pack + dsh plugin add ./tgz` |
| 9 | `## 构建链说明` | 折叠 `<details>`：无 checkout 时 `tsc + cp skill` 最小构建 |
| 10 | `## 目录结构` | `src/index.ts / cdp.ts / skill/*.md` → `lib/` 产物说明 |
| 11 | `## 联系作者` | 居中 280px 白底二维码 + 双通道“飞书扫码 · Issues 提问更高效” |
| 12 | `## 更多作品 · FeatherHunter DSH 生态` | 5 库表格（卖点≤30字含动词+量化）+ awesome 聚合页收口 |
| 13 | `## License` | BSD-3-Clause，见 LICENSE |

---

## 6. 徽标 markdown（含 URL，可直接粘贴）

```markdown
[![npm version](https://img.shields.io/npm/v/@feather_wch/dsh-plugin-ui-debug?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@feather_wch/dsh-plugin-ui-debug) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-0052CC?style=flat-square)](https://github.com/topics/dsh-plugin) [![Playwright](https://img.shields.io/badge/Playwright-45ba62?style=flat-square)](https://playwright.dev)
```

- 数量：3 枚，不含 `downloads` / `license` / `bundle size`
- 顺序：npm version（信任）→ dsh-plugin（归属）→ Playwright（技术栈）
- 样式：`style=flat-square` 与现 README 一致，保持视觉延续

---

## 7. 图片资源清单（相对路径 + alt 全句）

| 文件（冻结） | 相对路径 | alt 全句（SEO 友好） | 用途 |
|--------------|----------|---------------------|------|
| G1 GIF | `docs/demo-closed-loop.gif` | `DSH 插件 UI 调试 8s 闭环 — 真实 Chrome 看界面·点按钮·分段拖拽·改代码·二次验证` | 首屏 `## 预览` 自播放 |
| G1 poster | `docs/demo-closed-loop-poster.png` | `DSH 插件 UI 调试 8s 闭环首帧 — fallback 静态图` | GIF 超限或加载失败时降级 |
| P1 | `docs/screenshot-p1-minimized.png` | `有头最小化不抢焦点 — foreground:false 时 IDE 仍前台，截图 1280×720 清晰` | 预览二级区 或 本地开发前 |
| P2 | `docs/screenshot-p2-drag-steps.png` | `分段拖拽三帧拼图 — 每段≤30px 重新建立输入上下文，破解折叠死锁` | `### 分段拖拽护城河` 三栏拼图 |
| P2 帧序列 | `docs/frames/p2-frame-01.png` `p2-frame-02.png` `p2-frame-03.png` | `分段拖拽帧 1/2/3 — cursor:col-resize 手柄定位·拖 30px 后·折叠级数变化` | GIF 合成源 + 留证 |
| P3 | `docs/screenshot-p3-before-after.png` | `改前改后对比 — scrollWidth vs clientWidth 溢出修复，data-fold 逐级折叠` | 它解决什么之后，证明闭环 |
| 占位保留 | `docs/screenshot-placeholder.svg` | `占位 SVG 保留不删，仅 README 去引用` | 避免中间态裂图，回退可用 |
| 二维码 | `docs/contact-feishu-qr.png` | `飞书扫码联系作者 — 280px 白底居中` | `## 联系作者` |

> 所有路径均为仓库内相对路径，GitHub README 直接渲染；`files` 白名单已隔离，不进 npm 包。

---

## 8. 可粘贴占位文案（中文可直接 commit）

### 8.1 预览区完整占位（G1 + P2）

```markdown
## 预览

![DSH 插件 UI 调试 8s 闭环 — 真实 Chrome 看界面·点按钮·分段拖拽·改代码·二次验证](docs/demo-closed-loop.gif)

> 真实 Chrome 静默后台验证 · 不抢 IDE 焦点 · 分段拖拽闭环可验 — 基于 Playwright CDP · 三轨模型 headless/maximized/foreground 正交

### 分段拖拽护城河

![分段拖拽三帧拼图 — 每段≤30px 重新建立输入上下文，破解折叠死锁](docs/screenshot-p2-drag-steps.png)

> 分段拖拽三帧拼图 — 每段 ≤30px 重建输入上下文，破解折叠死锁直观可验 · `ui_drive drag steps:5 shots:3`
```

### 8.2 构建链折叠占位

```markdown
## 构建链说明

<details>
<summary>本机无 dsh 源码 checkout 时的最小构建（点击展开）</summary>

```bash
corepack pnpm add -D typescript@^5.9 @types/node@^24 tsdown@^0.22.14 playwright-core@^1.62.1
node node_modules/typescript/bin/tsc -p tsconfig.json
mkdir -p lib/skill && cp src/skill/*.md lib/skill/
```

</details>
```

### 8.3 联系作者占位（T2 产出，原样复制）

```html
<p align="center">
  <img src="docs/contact-feishu-qr.png" width="280" alt="飞书扫码联系作者" />
  <br/>飞书扫码联系作者 · Issues 提问更高效<br/>
  <a href="https://github.com/FeatherHunter">@FeatherHunter</a> · <a href="https://github.com/FeatherHunter/dsh-plugin-ui-debug/issues">Issues</a>
</p>
```

### 8.4 生态占位（T1 产出后替换此 5 行示例）

```markdown
## 更多作品 · FeatherHunter DSH 生态

| 库名 | 一句话卖点 | GitHub | npm |
|------|------------|--------|-----|
| dsh-im | 9 通道 IM 聚合 · 一键切群聊 | [FeatherHunter/dsh-im](https://github.com/FeatherHunter/dsh-im) | [![npm](https://img.shields.io/npm/v/@feather_wch/dsh-im)](https://www.npmjs.com/package/@feather_wch/dsh-im) |
| dsh-prompt | 24 模板 prompt 库 · 中文直达 | [FeatherHunter/dsh-prompt](https://github.com/FeatherHunter/dsh-prompt) | [![npm](https://img.shields.io/npm/v/@feather_wch/dsh-prompt)](https://www.npmjs.com/package/@feather_wch/dsh-prompt) |
| dsh-chinese-skill-patch | 技能中文补丁 · 一键汉化 | [FeatherHunter/dsh-chinese-skill-patch](https://github.com/FeatherHunter/dsh-chinese-skill-patch) | [![npm](https://img.shields.io/npm/v/@feather_wch/dsh-chinese-skill-patch)](https://www.npmjs.com/package/@feather_wch/dsh-chinese-skill-patch) |
| dsh-opencode-palette | 34 主题调色盘 · 匠心配色 | [FeatherHunter/dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette) | GitHub only（private 待解） |
| dsh-mattpocock-skills-deck | Matt Pocock 技能甲板 · 任务流 | [FeatherHunter/dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) | GitHub only（private 待解） |

> 更多见 [awesome-dsh-plugin](https://github.com/harnesslabs/awesome-dsh-plugin) 聚合页
```

> 私有包（dsh-opencode-palette / dsh-mattpocock-skills-deck）当前 `private:true` 仅链 GitHub 不链 npm，待 T3 修复后补徽标；`dsh-im` topics 为 [] 已在 T1 标红，建议 `gh repo edit --add-topic dsh-plugin`。

---

## 9. 视觉与实现约束

- **移动端 320–400px**：PNG 自适应 `width:100%`，P2 三栏在窄屏下保持每栏 ≥100px 可读，必要时改上下排布
- **暗色模式**：白底 PNG 保留 `#f6f8fa` 卡片底色，避免刺眼；GIF 文字加描边
- **二维码**：物理白底 12px + 容器 `background:#fff;padding:8px;border-radius:8px` 双保险，`width=280` 不溢出 375px 视口
- **圆角 16px**：继承占位 SVG 的圆角卡片样式，仅 CSS 层实现，不改二进制
- **体积校验**：`ls -lh docs/screenshot-*.png docs/demo-closed-loop.gif && file docs/*.{png,gif}` 魔数确认

---

## 10. DONE 标准与解 Block 条件

- [x] 本大纲 `docs/research/readme-outline.md` 已落盘，含 H2/H3 清单、要点、徽标 URL、图片路径与 alt 全句、占位文案
- [ ] 经 1 人（OWNER）确认：评论区回复 `LGTM` 或 `确认按此大纲执行` 即视为确认
- [ ] 确认后，T4 #23 的 `Blocked by: #19` 物理移除（或 `gh issue edit 23 --remove-blocked-by 19`），T4 进入 frontier
- [ ] T5 双检时以本大纲为验收基线：线上 README 首屏顺序、徽标数、GIF 体积、P2 三栏、双产物表格、折叠构建链、二维码 280px 居中、生态 5 行表格逐项勾选

---

## 11. 与 R1 的一致性声明

- 本大纲章节顺序与 R1 §5 “首屏顺序建议”一致，仅将“升级”合并、“构建链”折叠，差异已在 §1 说明
- 视觉阈值（GIF 800×450 10fps 限色128 <900KB、PNG 1280×720 oxipng -o3）与 R1 §3 共识一致
- 黄金三角“不抢焦点→分段拖拽→改后二次验收”在 GIF 分镜与 P1/P2/P3 中完整落地

---

## 12. 下一步（给 T4）

1. 按 `browser-boot.mjs` 健康检查 → 三轨 `headless:false foreground:false maximized:true` 起真实 Chrome
2. 靶点优先级：better-sidebar 分隔条 `cursor:col-resize` > 已装 A 形态 dock > C 形态主区按钮
3. 产出 `docs/screenshot-p1-minimized.png` / `p2-drag-steps.png` / `p3-before-after.png` + `frames/p2-frame-0{1,2,3}.png` + `docs/demo-closed-loop.gif` / `poster.png`
4. 推送后 GitHub 不破图，`npm pack --dry-run` 体积不变，回填本大纲 §7 路径

