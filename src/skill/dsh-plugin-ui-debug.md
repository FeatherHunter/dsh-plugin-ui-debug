---
name: dsh-plugin-ui-debug
version: 0.2.0
description: '[DSH 插件开发] 用真实 Chrome (Playwright) 对 DSH 插件 UI 做闭环调试：UI查看→UI测试→UI验证→问题解决。覆盖三种 UI 形态：better-sidebar 侧栏(dock)、底部面板、主页面按钮/内容。当你在调试/验证 DSH 插件的界面（面板、dock、tabs、弹窗、布局、交互）时使用。'
---

# dsh-plugin-ui-debug — DSH 插件 UI 调试闭环

> 目标：让 AI 在**任意 DSH 插件**的 UI 调试中，用 Playwright 驱动**真实 Chrome** 完成
> 「UI查看 → UI测试 → UI修改 → UI验证 → 问题解决」全套闭环。
> 由真实踩坑沉淀（issue#15 面板 tabs 折叠死锁、装配竞态、pointer-capture 拖拽等）。

## 何时用

- 用户汇报某 DSH 插件的 UI bug（面板/dock/tabs/弹窗/布局/折叠/换行/交互）
- 你改了插件 UI 代码，需要验证"显示对不对、交互灵不灵、修改是否生效"
- 初次接触某 DSH 插件的界面，需要探究它真实长什么样、怎么打开

## 必要条件

- 主机上装有 Chrome 或 Edge（`playwright-core` 复用系统浏览器，`channel:'chrome'`）
- DSH web GUI 在运行（通常是 `http://127.0.0.1:59519`）

---

## 第0步：先对齐再动手（必做）

当用户用自然语言描述 DSH 页面上的问题时，AI 在动手前，必须先去真实页面上把用户提到的每个按钮/文字/面板逐一核对一遍：用该元素的独立截图告诉用户“你说的 X，我理解是这个”，找不到的列出来“你说的 Y，我翻遍全页没找到”。

核对结果发出后：若全部清晰唯一，AI 带着这份核对结果直接继续处理（用户可随时打断纠正）；仅当有“未找到”或“多解”时，才停下来等用户补充。

---

## 第一步：判定目标 UI 的「形态」（最重要！决定到达路径）

DSH 插件的 UI 几乎只出现在**三个位置**，到达路径完全不同。**先判定形态，再选路径**，不要盲目套"激活会话→点可接"：

| 形态 | 典型特征 | 到达路径 | 常见问题 |
|---|---|---|---|
| **A. better-sidebar 侧栏（dock）** | 右侧可拖宽面板（`[class*=paneTab]`），如 MattSkills 面板 | 激活会话 → 点状态栏 seg → dock 打开 → 拖分隔条调宽 | 折叠/换行/拖拽失效 |
| **B. 底部面板** | 底部横向面板，占主区下方 | 通常点状态栏 seg 或底部按钮 → 底部面板展开 | 高度/遮挡/窄屏挤压 |
| **C. 主页面按钮/内容** | 直接渲染在主对话区（输入框上方按钮、消息区组件、设置项） | **不需要激活会话**——刷新后直接可见，直接点击/断言 | 按钮被 NAV 层挡、点击不触发 |

**判定方法**：刷新页面后截图 / 扫 DOM，看目标 UI 是"常驻主区"（C）、"点 seg 才出右侧"（A）、还是"点按钮才出底部"（B）。

> ⚠️ **better-sidebar 是特例而非默认**：只有 A 形态才需要"激活会话→点可接→拖分隔条"这串动作。
> 如果目标 UI 是 C（主页面按钮），**跳过第 4/5/6 节**，直接刷新后点它。

---

## 核心方法论（通用原语，所有形态都适用）

### 0. 启动真实浏览器（铁律）— 三轨模型（headless / maximized / foreground 正交）

> **三者正交，缺一不可**：`headless` 管有无 OS 窗口，`maximized` 管视口是否拉满，`foreground` 管是否抢焦点前台。默认即“有头但不抢焦点”。

| 轨道 | 参数组合 | OS 窗口 | 视口（`Emulation`） | 焦点 | 何时用 |
|------|----------|---------|---------------------|------|--------|
| **A 默认·静默后台验证** | `headless:false` + `foreground:false` + `maximized:true`（默认） | 有头但 **最小化到任务栏**（`windowState:'minimized'`），不抢 IDE 焦点 | 1920×1080 锁 `DPR=1`（与前台一致） | 自动 `Emulation.setFocusEmulationEnabled:true` 伪造 `hasFocus` | **日常默认**：AI 截图/点击/拖拽/键入与前台等价，但不打断你主工作流 |
| **B 显式·前台围观** | `headless:false` + `foreground:true` + `maximized:true` | 有头 **最大化到前台**（`windowState:'maximized'` + `bringToFront`） | 同 1920×1080 | 真焦点 | 人想围观 / 录屏演示 / `KEEP=1` 调试时显式开启 |
| **C 无头·纯截图** | `headless:true`（`foreground` 静默忽略） | 无 OS 窗口 | 虚拟 1920×1080 | HeadlessFocusClient 已处理 | 仅静态截图 / CI 无显示器环境；**拖拽/:hover/React DnD 会降级，勿用于交互** |

**插件侧映射**（`ui_shot` / `ui_drive` 已透出三参）：

```js
// A 默认（推荐）：静默后台验证，不抢焦点
await ui_shot({ url: DSH, headless: false, foreground: false, maximized: true })
// B 围观：显式前台
await ui_shot({ url: DSH, headless: false, foreground: true, maximized: true })
// C 纯截图：无头（仅查收视图，无拖拽）
await ui_shot({ url: DSH, headless: true, maximized: true }) // foreground 忽略
```

**Playwright 侧映射**（裸 Playwright 时等价本插件的 CdpSession）：

```js
chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
const context = await browser.newContext({ viewport: null })
```
- **必须最大化 + `viewport: null`**：窗口小会引发 DSH 布局问题（面板被 dock 挤没、按钮被截）。
- **拖拽/hover 场景绝不用 `headless:true`**：无头点击不触发 React，交互链路不激活（历史教训）；仅静态截图才可用 `headless:true`。
- **默认不抢焦点**：本插件 `foreground:false` 时已最小化并伪造焦点，等价 Playwright 手动 `Browser.setWindowBounds:minimized` + `Emulation.setFocusEmulationEnabled`；`foreground:true` 才前台。
- 跑完自动 `browser.close()`，绝不 `await new Promise(()=>{})` 挂起后台 job；`KEEP=1` 才保留窗口给人围观。

### 1. 注入初始化配置（绕开插件的"初始化竞态"）
很多 DSH 插件根据配置决定渲染形态（如 deck 的 `openIn: sidebar|dock`），且配置计算早于
其他插件服务注册 → 新 profile 会掉进非预期分支。**在 `addInitScript` 里写 localStorage**：
```js
await context.addInitScript(() => {
  try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {}
})
```
**通用动作**：先弄清目标插件的关键配置键 → 在页面加载前注入期望值。
（C 形态主页面按钮通常无需此步，除非按钮渲染依赖配置。）

### 2. 健康检查 + 装配竞态重试（所有形态都要）
DSH web 偶发插件装配竞态（`Failed to load plugins … slot not declared`），新页面可能加载失败：
```js
for (let attempt = 1; attempt <= 6; attempt++) {
  if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
  else await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  healthy = await page.evaluate(() => {
    if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false
    return document.querySelectorAll('.dsws-seg').length > 0  // ← 换成目标 UI 的关键锚点
  })
  if (healthy) break
}
```
健康锚点 = 目标 UI 特有的稳定元素；反过来，body 含 "Failed to load plugins" 即视为加载失败。

### 3. 定位并点击目标元素（所有形态）—— 命中测试（hit-test）
裸坐标常被 NAV 层遮挡。**统一用"元素中心坐标"点击**（`getBoundingClientRect` 取中心）：
```js
const el = await page.evaluate((sel) => {
  const e = document.querySelector(sel)
  if (!e) return null
  const r = e.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
}, selector)
if (el) { await page.mouse.click(el.x, el.y); await page.waitForTimeout(1500) }
```
若裸坐标被挡，用 `elementFromPoint` 扫描命中点，根据 `cursor: col-resize|ew-resize|pointer` 判定真实手柄。

### 4. 拖拽 —— 必须分段（action-sharding）（仅 A/B 形态需要）
**单次长拖 pointermove 只生效前 1-2 档**（active pointer/capture 中途失效）。每段 ≤30px，
**每段都重新 press→move→up**（重新建立输入上下文），再重新定位手柄继续。
```js
while (剩余) { locateHandle(); mouse.down(); mouse.move(+seg, steps:3); wait; mouse.up(); wait }
```
移动方向要先验证（曾踩坑：方向搞反把面板拖宽了，以为在测折叠）。

### 5. 读 DOM 状态（不靠肉眼）—— 每次断言用数值
DOM 精确读数 ≈ 几十 token，比截图强：
- 布局：`getBoundingClientRect()`（宽/高/x/y）、`clientWidth`、`scrollWidth`
- 折叠/溢出：`classList`（l1/l2）、`scrollWidth vs clientWidth`、按钮文字 span 的 `offsetWidth>0`
- 被隐藏的文字：`display:none` 的 span 其 `offsetWidth === 0`
- 每个按钮：`textContent` + 文字 span 是否可见
**一档一行文本，截图只在关键状态给人看。**

### 6. 犹豫留证（铁律）
**当 DOM 读数与视觉截图冲突，或你对 UI 状态分辨不清时——禁止自行拍板。** 必须：
1. 保存现场证据：按钮行**特写截图**（`page.locator(...).screenshot()`）+ 关键 DOM 数据；
2. 交给用户审核/定夺，说明冲突点，再继续。

### 7. sizing-probe（测量"容器是否真的放得下"的通用探针）
疑点：`scrollWidth` 测的是 `max(内容宽, 容器宽)` —— **容器比内容宽时被钳制成容器宽**，
导致"自然宽"测量失真。这是折叠/溢出类 bug 的常见根（issue#15 死锁实锤）。
探针要同时测三组量对照：
```
avail（容器 clientWidth）  vs  nats[]（各折叠档 scrollWidth）  vs  contentReal[]（各档真实内容宽）
```
若 `nats[]` 全部等于 avail 而 `contentReal[]` 明显小于 avail → 判定钳制发生。

### 8. 折叠/收缩类 bug：内容自适应 > 阈值体系（#16 V2 沉淀）
**坑**：用「视口宽 / 容器宽 < 硬编码阈值」驱动"文字→图标"分级收缩，在 DSH shell 布局
变化（sidebar/dock 占位、其他插件挤占、字体/语言宽度差）时必然漂移——实测默认 1280
视口下输入区仅 812px，阈值最低档永不可达，**宽屏默认就缺字**。
**正解**（仿 #15 渐进式折叠，deck 胶囊 V2 已验证）：
```
全展开 → 强制 reflow → 按 data-priority（小=重要=晚收）逐个加折叠 class，
每加一个 reflow 重测，直到 scrollWidth ≤ clientWidth + 1
```
- 触发：ResizeObserver 监听**目标元素自身**宽 + window resize + `document.fonts.ready`
- 测量期间禁动画 class（如 `dsws-no-anim`），防 max-width transition 污染 scrollWidth
- 折叠由 React 外部 DOM class 驱动：className prop 不变时 React 重渲染不会抹掉手动 class
- 每次全展开重算（单帧内完成）→ 天然自愈，无"折叠后展开判定"死锁
- 验收锚点：给容器写 `dataset.fold = 折叠数`，真机逐档断言

**定位子元素的坑**：组件工厂首参是图标名不是 class（如 `seg('note', ...)`），
`querySelector('.dsws-seg.note')` 静默返回 null、CSS `.dsws-seg.note` 永不命中——
用 `:scope > .dsws-seg` 索引定位；CSS 选择器引用不存在的 class 不报错只是永不命中，
先 grep 确认 class 真实存在再断言行为。

---

## 形态专属路径速查

### A. better-sidebar 侧栏（dock）
1. 激活**有内容**的会话（新会话点按钮无效——面板依赖激活会话的 sessionId）
2. 点状态栏 seg（如「可接」）→ dock 在右侧打开
3. 拖分隔条（hit-test 找 `cursor: col-resize`）调宽
4. 折叠/换行 bug 用 sizing-probe（`probe-nats.mjs`）

### B. 底部面板
1. 同 A 需激活会话（若面板依赖 session）
2. 点触发按钮/seg → 底部面板展开
3. 拖顶部手柄调高度；窄屏挤压问题用 DOM 读数断言

### C. 主页面按钮/内容（最简）
1. 健康检查后**直接可见**，无需激活会话
2. 直接点击（hit-test 防遮挡）→ 断言 DOM 变化
3. 若按钮触发打开面板 → 再按 A/B 路径走

---

## 原子脚本（固化命令，按需 `node scripts/<x>.mjs` 调用；全部参数化可覆盖）

| 脚本 | 作用 | 状态 |
|---|---|---|
| `browser-boot.mjs` | 起真实 Chrome → 注入 cfg → 健康重试 → 激活会话 → 点可接 → 面板就绪（A 形态） | ✅ 已验证 |
| `tabs-regression.mjs` | 端到端回归：拖窄→折叠→拖宽→断言文字恢复（PASS/FAIL）（A 形态 tabs） | ✅ 真机验证 |
| `probe-nats.mjs` | sizing-probe：avail/nats/contentReal 三组对照 + 钳制检测（通用） | ✅ 真机验证 |
| `tabs-state.mjs` | 读 tabs 行 DOM（lv/rowH/溢出/每按钮文字可见性） | ⏳ 规划中 |
| `drag-step.mjs` | 命中分隔条 + 分段拖拽 30px（方向可参） | ⏳ 规划中 |
| `shot.mjs` | 关键帧截图（含元素特写） | ⏳ 规划中 |

> **参数约定**（全部可覆盖，勿照抄默认值）：`--url <DSH地址>` `--session <会话标题>` `--cfg <JSON>` `--seg <按钮文字>` `--out <截图目录>` `--tabs <选择器>`
> 默认值仅作示例（指向 deck 的 A 形态场景）；目标插件/形态不同时必须传参覆盖。

## 已排除死路（勿重走）
- ❌ 无头 Chrome：点击不触发 React，交互链路不激活。
- ❌ Electron 9222 attach 拖拽：CDP pointermove 不路由（capture 不持久）；el.click 可点按键但不能拖。
- ❌ 未激活会话就点按钮（仅 A/B 形态）：面板不打开。
- ❌ `scrollWidth` 当自然宽：被容器钳制，折叠展开判定会死锁。
- ❌ 把 A 形态路径（激活会话→点可接）硬套到 C 形态（主页面按钮）：多余的激活动作可能误点别处。
- ❌ 「视口/容器宽 < 阈值」驱动分级收缩（#16 R1-R13）：shell 布局占位使阈值漂移，
  默认宽屏也可能误收缩、最低档永不可达——用内容自适应（scrollWidth ≤ clientWidth 逐级收）。
- ❌ 用 `.dsws-seg.<icon名>` 定位/选中 seg（#16 实测）：工厂首参是图标名不是 class，
  选择器静默落空——用 `:scope > .dsws-seg` 索引。

## 验收（做完自检）
- [ ] 先判定目标 UI 形态（A/B/C），路径与形态匹配
- [ ] UI 打开到目标状态（面板/tabs/按钮可见）
- [ ] 关键交互有 DOM 数值证据（不是"看起来对"）
- [ ] 修改后同场景重跑，数值变化符合预期
- [ ] 关键帧截图保存，供人工复核
- [ ] 疑难处留证交用户，未自行拍板
