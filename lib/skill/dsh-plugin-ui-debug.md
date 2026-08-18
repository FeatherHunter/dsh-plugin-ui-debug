---
name: dsh-plugin-ui-debug
version: 0.1.0
description: '[DSH 插件开发] 用真实 Chrome (Playwright) 对 DSH 插件 UI 做闭环调试：UI查看→UI测试→UI验证→问题解决。当你在调试/验证 DSH 插件的界面（面板、dock、tabs、弹窗、布局、交互）时使用。'
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

## 核心方法论（按序执行，缺一不可）

### 0. 启动真实浏览器（铁律）
```js
chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
const context = await browser.newContext({ viewport: null })
```
- **必须最大化 + `viewport: null`**：窗口小会引发 DSH 布局问题（面板被 dock 挤没、按钮被截）。
- **绝不用无头**：无头点击不触发 React，交互链路不激活（历史教训）。
- 跑完自动 `browser.close()`，绝不 `await new Promise(()=>{})` 挂起后台 job；
  `KEEP=1` 才保留窗口给人围观。

### 1. 注入初始化配置（绕开插件的"初始化竞态"）
很多 DSH 插件根据配置决定渲染形态（如 deck 的 `openIn: sidebar|dock`），且配置计算早于
其他插件服务注册 → 新 profile 会掉进非预期分支。**在 `addInitScript` 里写 localStorage**：
```js
await context.addInitScript(() => {
  try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {}
})
```
**通用动作**：先弄清目标插件的关键配置键 → 在页面加载前注入期望值。

### 2. 健康检查 + 装配竞态重试
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

### 3. 激活有内容的会话（关键前置）
**新会话点按钮无效**（历史已知 bug：面板打开依赖激活会话的 sessionId）。必须：
先点击左侧历史会话列表里的**有内容会话**，把会话激活，再谈驱动。用 textContent 定位该会话项。

### 4. 点击状态栏 seg / 打开面板
用元素中心坐标点击（`page.mouse.click(centerX, centerY)`）：
```js
const seg = await page.evaluate(() => {
  const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
  if (!s) return null; const r = s.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500) }
```

### 5. 定位分隔条 / 可拖拽手柄 —— 命中测试（hit-test）
裸坐标常被 NAV 层遮挡。用 `elementFromPoint` 扫描命中点，根据 `cursor: col-resize|ew-resize` 判定：
```js
for (y...) for (x...) {
  const el = document.elementFromPoint(x, y)
  if (getComputedStyle(el).cursor === 'col-resize' || ... === 'ew-resize') return { x, y }
}
```

### 6. 拖拽 —— 必须分段（action-sharding）
**单次长拖 pointermove 只生效前 1-2 档**（active pointer/capture 中途失效）。每段 ≤30px，
**每段都重新 press→move→up**（重新建立输入上下文），再重新定位分隔条继续。
```js
while (剩余) { locateDivider(); mouse.down(); mouse.move(+seg, steps:3); wait; mouse.up(); wait }
```
移动方向要先验证（曾踩坑：方向搞反把面板拖宽了，以为在测折叠）。

### 7. 读 DOM 状态（不靠肉眼）—— 每次断言用数值
DOM 精确读数 ≈ 几十 token，比截图强：
- 布局：`getBoundingClientRect()`（宽/高/x/y）、`clientWidth`、`scrollWidth`
- 折叠/溢出：`classList`（l1/l2）、`scrollWidth vs clientWidth`、按钮文字 span 的 `offsetWidth>0`
- 被隐藏的文字：`display:none` 的 span 其 `offsetWidth === 0`
- 每个按钮：`textContent` + 文字 span 是否可见
**一档一行文本，截图只在关键状态给人看。**

### 8. 犹豫留证（铁律）
**当 DOM 读数与视觉截图冲突，或你对 UI 状态分辨不清时——禁止自行拍板。** 必须：
1. 保存现场证据：按钮行**特写截图**（`page.locator('.dsws-tabs').screenshot()`）+ 关键 DOM 数据；
2. 交给用户审核/定夺，说明冲突点，再继续。

### 9. sizing-probe（测量"容器是否真的放得下"的通用探针）
疑点：`scrollWidth` 测的是 `max(内容宽, 容器宽)` —— **容器比内容宽时被钳制成容器宽**，
导致"自然宽"测量失真。这是折叠/溢出类 bug 的常见根（issue#15 死锁实锤）。
探针要同时测三组量对照：
```
avail（容器 clientWidth）  vs  nats[]（各折叠档 scrollWidth）  vs  contentReal[]（各档真实内容宽）
```
若 `nats[]` 全部等于 avail 而 `contentReal[]` 明显小于 avail → 判定钳制发生。

## 原子脚本（固化命令，按需 `node scripts/<x>.mjs` 调用；全部参数化可覆盖）

| 脚本 | 作用 | 状态 |
|---|---|---|
| `browser-boot.mjs` | 起真实 Chrome → 注入 cfg → 健康重试 → 激活会话 → 点可接 → 面板就绪 | ✅ 已验证 |
| `tabs-regression.mjs` | 端到端回归：拖窄→折叠→拖宽→断言文字恢复（PASS/FAIL） | ✅ 真机验证 |
| `probe-nats.mjs` | sizing-probe：avail/nats/contentReal 三组对照 + 钳制检测 | ✅ 真机验证 |
| `tabs-state.mjs` | 读 tabs 行 DOM（lv/rowH/溢出/每按钮文字可见性） | ⏳ 规划中 |
| `drag-step.mjs` | 命中分隔条 + 分段拖拽 30px（方向可参） | ⏳ 规划中 |
| `shot.mjs` | 关键帧截图（含元素特写） | ⏳ 规划中 |

> **参数约定**（全部可覆盖，勿照抄默认值）：`--url <DSH地址>` `--session <会话标题>` `--cfg <JSON>` `--seg <按钮文字>` `--out <截图目录>` `--tabs <选择器>`
> 默认值仅作示例（指向 deck 场景）；目标插件不同时必须传参覆盖。

## 已排除死路（勿重走）
- ❌ 无头 Chrome：点击不触发 React，交互链路不激活。
- ❌ Electron 9222 attach 拖拽：CDP pointermove 不路由（capture 不持久）；el.click 可点按键但不能拖。
- ❌ 未激活会话就点按钮：面板不打开。
- ❌ `scrollWidth` 当自然宽：被容器钳制，折叠展开判定会死锁。

## 验收（做完自检）
- [ ] UI 打开到目标状态（面板/tabs 可见）
- [ ] 关键交互有 DOM 数值证据（不是"看起来对"）
- [ ] 修改后同场景重跑，数值变化符合预期
- [ ] 关键帧截图保存，供人工复核
- [ ] 疑难处留证交用户，未自行拍板
