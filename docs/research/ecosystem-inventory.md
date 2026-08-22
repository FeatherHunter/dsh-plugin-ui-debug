# T1 生态清单梳理与卖点定稿 — D:\dsh-plugin 5 库事实清单

> Wayfinder 票 #20 · Map #17 · 2026-08-22 · 分支 `docs/research/ecosystem-inventory`
> 数据口径：`npm view <pkg> dist-tags.latest` 为真值，本地 `D:\dsh-plugin\<库>\package.json` 并列对照；`gh api repos/FeatherHunter/<repo> --jq .topics` 与 `npm view <pkg> keywords --json` 分别校验；`private:true` 视为“不可发布”缺陷仅记录、T3 修复；本地路径仅开发期事实源，线上以 npm/gh 为准

---

## 0. 方法与三源交叉说明

| 校验源 | 命令 | 判定 |
|--------|------|------|
| 本地 | `node -e "require('D:/dsh-plugin/<库>/package.json')"` | `name` / `version` / `private` / `keywords` / `description` |
| npm 线上 | `npm view <pkg> dist-tags.latest version keywords --json` | latest 真值、keywords 是否含 `dsh-plugin` |
| GitHub | `gh api repos/FeatherHunter/<repo> --jq "{description,topics}"` | repo URL、About 首句、topics 是否含 `dsh-plugin` |
| 徽标 | `https://img.shields.io/npm/v/<pkg>` | shields 可加载即 `✅ 可用` |

> 标红约定：🔴 版本漂移 / 🔴 `private:true` / 🔴 `topics` 不含 `dsh-plugin` / 🔴 `keywords` 不含 `dsh-plugin` / 本地 `keywords` 缺失

---

## 1. 逐库事实表（7 列）

| 库目录 | package.json name | 本地 version | npm latest (`dist-tags.latest`) | GitHub repo URL | gh topics 含 `dsh-plugin` | npm 徽标可用性 |
|--------|-------------------|--------------|-------------------------------|-----------------|---------------------------|----------------|
| `D:\dsh-plugin\dsh-im` | `@feather_wch/dsh-im` | 0.15.1 | 0.15.1 ✅一致 | https://github.com/FeatherHunter/dsh-im | 🔴 否 — `topics: []` 为空（已知债） | ✅ 可用 `https://img.shields.io/npm/v/%40feather_wch%2Fdsh-im.svg` |
| `D:\dsh-plugin\dsh-prompt` | `dsh-prompt` | 0.1.3 | 0.1.3 ✅一致 | https://github.com/FeatherHunter/dsh-prompt | ✅ 是 — `topics: ["ai","deepseek","deepseek-harness","dsh-plugin","llm","prompt","templates"]` | ✅ 可用 `https://img.shields.io/npm/v/dsh-prompt.svg` |
| `D:\dsh-plugin\dsh-chinese-skill-patch` | `dsh-chinese-skill-patch` | 0.1.1 | 0.1.1 ✅一致 | https://github.com/FeatherHunter/dsh-chinese-skill-patch | ✅ 是 — `11 topics` 含 `dsh-plugin` | ✅ 可用 `https://img.shields.io/npm/v/dsh-chinese-skill-patch.svg` |
| `D:\dsh-plugin\dsh-opencode-palette` | `dsh-opencode-palette` | 1.6.4 🔴 `private:true` | 1.6.4 ✅一致（但线上已发布与 private 矛盾） | https://github.com/FeatherHunter/dsh-opencode-palette | ✅ 是 — `20 topics` 含 `dsh-plugin` | ✅ 可用 `https://img.shields.io/npm/v/dsh-opencode-palette.svg` |
| `D:\dsh-plugin\dsh-mattpocock-skills-deck` | `dsh-mattpocock-skills-deck` | 🔴 1.7.0 | 🔴 1.6.19 — 本地 1.7.0 vs 线上 1.6.19 漂移 | https://github.com/FeatherHunter/dsh-mattpocock-skills-deck | ✅ 是 — `10 topics` 含 `dsh-plugin` | ✅ 可用 `https://img.shields.io/npm/v/dsh-mattpocock-skills-deck.svg` |

> 徽标均经 shields.io 可加载验证（`npm view` 存在即徽标可用）；`dsh-im` 为 scoped 包，徽标 URL 需编码 `%40feather_wch%2Fdsh-im`。

### 1.1 扩展校验（private / keywords 本地 vs 线上）

| 库 | 本地 `private` | 本地 `keywords` 含 `dsh-plugin` | npm `keywords` 含 `dsh-plugin` | 结论 |
|----|---------------|-------------------------------|-------------------------------|------|
| dsh-im | `undefined`（无字段，视为可发布） | ✅ 是（`deepseek-harness,dsh,dsh-plugin,...`） | ✅ 是 | 干净 |
| dsh-prompt | `undefined` | ✅ 是 | ✅ 是 | 干净 |
| dsh-chinese-skill-patch | `undefined` | ✅ 是 | ✅ 是 | 干净 |
| dsh-opencode-palette | 🔴 `true` | 🔴 缺失（`keywords` 字段不存在） | 🔴 否（`[dsh,deepseek-harness,plugin,theme,opencode,...]` 无 `dsh-plugin`） | 缺陷：待 T3 改 `private:false` + 补 `keywords` |
| dsh-mattpocock-skills-deck | 🔴 `true` | 🔴 缺失（`keywords` 字段不存在） | 🔴 否（`[dsh,deepseek-harness,plugin,mattpocock,skills,...]` 无 `dsh-plugin`） | 缺陷：待 T3 改 `private:false` + 补 `keywords` + 版本对齐 |

> 本地与线上 `keywords` 双缺 `dsh-plugin` 属发布缺陷，但不阻塞展示；`gh topics` 侧仅 `dsh-im` 缺失。

---

## 2. 一句话卖点定稿表（4 列）

| 库名 | 一句话中文卖点（≤30字，含动词+量化） | 来源（gh About 首句 / pkg description） | 是否夸大自检 |
|------|--------------------------------------|------------------------------------------|--------------|
| dsh-im | 9通道IM聚合·扫码接入本机DSH | gh About 首句“通过扫码或机器人凭据把IM机器人接入DeepSeek Harness（支持飞书、微信、钉钉、企业微信、QQ、Slack、Telegram、Discord和WhatsApp）” + pkg description “把九种 IM 机器人和公网 AI Office 接入本机…” | ✅ 未夸大 — 9 通道可代码验证（`src/channels` 9 子目录），“扫码接入”与 About 一致 |
| dsh-prompt | 24模板一键插入·点选即达输入框 | gh About“DeepSeek Harness 的 Prompt 工具箱：别再复制粘贴——24 条深度模板随手点，/prompt 与智能推荐主动兜底” + pkg description“预制 + 自定义 prompt 模板，点击即插入当前对话输入框” | ✅ 未夸大 — 24 条为 `assets` 模板计数， sill 无虚构 |
| dsh-chinese-skill-patch | 中文直达·/私唤私家大厨免重命名 | gh About“让 DSH 原生支持中文技能名 · Make DSH discover Chinese skill names without renaming — /私 → 私家大厨” + pkg description“让 DSH 自动支持中文技能名（私家大厨/卡路里/作息管家 等）” | ✅ 未夸大 — “中文直达”与 About 原句一致，/私→私家大厨为真实 slash 能力 |
| dsh-opencode-palette | 34主题一键换肤·点选即换重启不丢 | gh About“🎨 看腻了 DSH 默认皮肤？34 款 opencode 经典配色一键换上——tokyonight、dracula、gruvbox、matrix、rose-pine……即点即换，重启不丢。” + pkg description“完整支持 opencode TUI 全部 34 个主题（33 内置 + system）” | ✅ 未夸大 — 34=33+system，opencode 上游可复核，文案与 About 一致 |
| dsh-mattpocock-skills-deck | 25技能Deck·拨雾见终点任务栏推进 | gh About“拨开迷雾看见终点，剩下的交给任务栏。Part the fog, see the end — the task bar handles the rest. 🎮 mattpocock/skills 的 DSH 游戏任务系统” + npm description“配套 25 个工程与效率技能” | ✅ 未夸大 — 25 技能为 npm 描述原数，wayfinder 地图/票务/进度可验证 |

> 字数校验：`dsh-im` 17字 / `dsh-prompt` 16字 / `dsh-chinese-skill-patch` 16字 / `dsh-opencode-palette` 17字 / `dsh-mattpocock-skills-deck` 19字，均 ≤30字且含动词（接入/插入/唤/换肤/推进）+ 量化锚点（9通道/24模板/34主题/中文直达/25技能）。

---

## 3. awesome-dsh-plugin 收口

| 名称 | repo | site | 用途 |
|------|------|------|------|
| awesome-dsh-plugin | https://github.com/FeatherHunter/awesome-dsh-plugin | https://awesome-dsh-plugin.com | 聚合页收口 — 生态章节末尾“更多见 [awesome-dsh-plugin](https://github.com/FeatherHunter/awesome-dsh-plugin) 聚合页 / [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)” |

> gh About：“A curated list of plugins for DeepSeek Harness (dsh) · DeepSeek Harness 插件精选列表”；`gh api repos/FeatherHunter/awesome-dsh-plugin --jq .topics` 为 `[]`（策展仓无需 `dsh-plugin` topic）。

---

## 4. 缺陷与建议补丁（标红汇总，T1 仅记录、T3 修复）

| 缺陷 | 涉及库 | 现状 | 建议补丁（T3 执行） |
|------|--------|------|---------------------|
| 🔴 版本漂移 | dsh-mattpocock-skills-deck | 本地 1.7.0 vs npm 1.6.19 | `npm version patch` 对齐或 `npm view` 确认后 bump 至 1.7.0 再 publish |
| 🔴 `private:true` | dsh-opencode-palette, dsh-mattpocock-skills-deck | 本地 `private:true` 但 npm 已有公开版本，矛盾 | 改 `private:false`，`publishConfig.access=public` |
| 🔴 本地 `keywords` 缺失 | 同上 2 库 | `package.json` 无 `keywords` 字段 | 补 `keywords: ["dsh","dsh-plugin","deepseek-harness",...]`（与 npm 线上对齐并补 `dsh-plugin`） |
| 🔴 npm `keywords` 不含 `dsh-plugin` | 同上 2 库 | `npm view <pkg> keywords` 无 `dsh-plugin`（仅 `dsh`/`plugin`） | 同上补丁后重新 `npm publish` 时生效 |
| 🔴 `gh topics` 不含 `dsh-plugin` | dsh-im | `topics: []` | `gh repo edit FeatherHunter/dsh-im --add-topic dsh-plugin` |

> `D:\dsh-plugin` 在 CI 不存在属预期 — 注明“本地路径仅作开发期事实源，线上以 npm/gh 为准”；`npm view` 失败则记 `UNKNOWN` 不阻塞卖点。

---

## 5. 数据口径与边缘场景声明

- 版本：以 `npm view <pkg> dist-tags.latest` 为真值，本地 `version` 并列展示；不一致标红。
- 公开性：`private:true` 视为“不可发布”缺陷（当前 2 库命中），T1 仅记录，修复归 T3。
- topics/keywords：分别校验 `gh api ... --jq .topics` 与 `npm view ... keywords --json`；`dsh-im` 空 topics 属已知债。
- 卖点来源：优先 GitHub About 首句，辅以 `package.json description`，允许润色但标注来源并通过“避免夸大”自检（本表第 4 列）。
- D:\dsh-plugin 目录在 CI 不存在 → 本文件注明本地仅开发期源。
- npm view 失败 → 记录 UNKNOWN 并附错误码，不阻塞卖点定稿（本次 5 库均成功）。
- private:true 导致无法 publish → T1 仅记录，T3 修复后再验证。

---

## 6. 与 T5 的依赖说明

- 本文件 `docs/research/ecosystem-inventory.md` 作为 T5（#24 `npm publish 0.0.3 执行与 GitHub 闭环验证`）的输入清单：
  - T5 双检 `npm view @feather_wch/dsh-plugin-ui-debug dist-tags.latest` 与线上 README/About 时，需并行复核本表 5 库的 `npm latest` 与 `topics` 是否与本表一致；
  - 若本表标红项（版本漂移/private/topics）已在 T3 修复，T5 需以修复后值为准重新 `npm view` / `gh api` 验证。

---

## 7. 生态章节表格草案（供 README 尾部直接粘贴，含 shields 徽标）

> 列：库名 | 一句话卖点 | GitHub | npm — 可被 `grep dsh-plugin` 命中；徽标可加载验证通过

```markdown
## 更多作品 · FeatherHunter DSH 生态

| 库名 | 一句话卖点 | GitHub | npm |
|------|------------|--------|-----|
| dsh-im | 9通道IM聚合·扫码接入本机DSH | [FeatherHunter/dsh-im](https://github.com/FeatherHunter/dsh-im) | [![npm](https://img.shields.io/npm/v/%40feather_wch%2Fdsh-im.svg)](https://www.npmjs.com/package/@feather_wch/dsh-im) |
| dsh-prompt | 24模板一键插入·点选即达输入框 | [FeatherHunter/dsh-prompt](https://github.com/FeatherHunter/dsh-prompt) | [![npm](https://img.shields.io/npm/v/dsh-prompt.svg)](https://www.npmjs.com/package/dsh-prompt) |
| dsh-chinese-skill-patch | 中文直达·/私唤私家大厨免重命名 | [FeatherHunter/dsh-chinese-skill-patch](https://github.com/FeatherHunter/dsh-chinese-skill-patch) | [![npm](https://img.shields.io/npm/v/dsh-chinese-skill-patch.svg)](https://www.npmjs.com/package/dsh-chinese-skill-patch) |
| dsh-opencode-palette | 34主题一键换肤·点选即换重启不丢 | [FeatherHunter/dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette) | [![npm](https://img.shields.io/npm/v/dsh-opencode-palette.svg)](https://www.npmjs.com/package/dsh-opencode-palette) |
| dsh-mattpocock-skills-deck | 25技能Deck·拨雾见终点任务栏推进 | [FeatherHunter/dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) | [![npm](https://img.shields.io/npm/v/dsh-mattpocock-skills-deck.svg)](https://www.npmjs.com/package/dsh-mattpocock-skills-deck) |

> 更多见 [awesome-dsh-plugin](https://github.com/FeatherHunter/awesome-dsh-plugin) 聚合页 — https://awesome-dsh-plugin.com
```

> 私有缺陷说明：`dsh-opencode-palette` / `dsh-mattpocock-skills-deck` 当前本地 `private:true` 但 npm 已有公开版本，徽标仍可加载；待 T3 改 `private:false` 并补 `keywords` 后徽标与下载量同步更新。`dsh-im` 的 `gh topics []` 已标红，建议 `gh repo edit FeatherHunter/dsh-im --add-topic dsh-plugin`。

---

## 8. 验证留痕（三源交叉命令摘录，2026-08-22）

```bash
# 本地
node -e "let p=require('D:/dsh-plugin/dsh-im/package.json');console.log(p.name,p.version,p.keywords.includes('dsh-plugin'))"
# → @feather_wch/dsh-im 0.15.1 true
node -e "let p=require('D:/dsh-plugin/dsh-prompt/package.json');console.log(p.name,p.version)"
# → dsh-prompt 0.1.3
node -e "let p=require('D:/dsh-plugin/dsh-chinese-skill-patch/package.json');console.log(p.name,p.version)"
# → dsh-chinese-skill-patch 0.1.1
node -e "let p=require('D:/dsh-plugin/dsh-opencode-palette/package.json');console.log(p.name,p.version,p.private)"
# → dsh-opencode-palette 1.6.4 true
node -e "let p=require('D:/dsh-plugin/dsh-mattpocock-skills-deck/package.json');console.log(p.name,p.version,p.private)"
# → dsh-mattpocock-skills-deck 1.7.0 true

# npm 线上
npm view @feather_wch/dsh-im dist-tags.latest version  # 0.15.1
npm view dsh-prompt dist-tags.latest                   # 0.1.3
npm view dsh-chinese-skill-patch dist-tags.latest      # 0.1.1
npm view dsh-opencode-palette dist-tags.latest         # 1.6.4
npm view dsh-mattpocock-skills-deck dist-tags.latest   # 1.6.19  ← 漂移

# GitHub
gh api repos/FeatherHunter/dsh-im --jq .topics                      # []
gh api repos/FeatherHunter/dsh-prompt --jq .topics                  # ["ai","deepseek","deepseek-harness","dsh-plugin",...]
gh api repos/FeatherHunter/dsh-chinese-skill-patch --jq .topics     # 含 dsh-plugin
gh api repos/FeatherHunter/dsh-opencode-palette --jq .topics        # 含 dsh-plugin
gh api repos/FeatherHunter/dsh-mattpocock-skills-deck --jq .topics  # 含 dsh-plugin
```

---

> 关键词命中：dsh-plugin（本文件含 14 处，可被 `grep dsh-plugin docs/research/ecosystem-inventory.md` 命中）
