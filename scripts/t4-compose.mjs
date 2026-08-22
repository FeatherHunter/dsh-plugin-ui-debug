// t4-compose.mjs — T4 合成管线：P1/P2/P3 拼图（Chrome 渲染 HTML）+ GIF 80 帧（sharp 裁切 + 节拍浮层）+ poster
// 产物: docs/screenshot-p1-minimized.png / p2-drag-steps.png / p3-before-after.png / docs/frames/p2-frame-0*.png / docs/demo-closed-loop.gif / docs/demo-closed-loop-poster.png
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const R = 'D:/dsh-plugin/dsh-plugin-ui-debug'
const SRC = R + '/_shots/t4'
const OUT = R + '/docs'
const FRAMES = R + '/_shots/gif-frames'
const OV = R + '/_shots/gif-overlays'
for (const d of [FRAMES, OV, OUT + '/frames']) mkdirSync(d, { recursive: true })

const fileUrl = (p) => 'file:///' + p.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/')

// ---------- HTML 渲染助手 ----------
const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 60000 })
const renderHtml = async (html, out, w, h) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: out, omitBackground: true })
  await page.close()
}
const wrap = (inner, w, h, bg = '#ffffff') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box }
  html,body { width:${w}px; height:${h}px; overflow:hidden; background:${bg}; font-family:'Segoe UI','Microsoft YaHei',system-ui,sans-serif }
</style></head><body>${inner}</body></html>`

// ---------- 通用小件 ----------
const chip = (text, color, bg, big = false) => `<span style="display:inline-block;padding:${big ? '8px 14px' : '4px 10px'};border-radius:10px;background:${bg};color:${color};font-weight:700;font-size:${big ? '17px' : '12.5px'};border:1.5px solid ${color};line-height:1.2">${text}</span>`
const captionBar = (text, color) => `<div style="position:absolute;left:20px;right:20px;bottom:16px;background:rgba(17,17,17,0.82);color:#fff;padding:10px 14px;border-radius:10px;font-size:14.5px;line-height:1.45;border-left:4px solid ${color}">${text}</div>`

// ================= P1 =================
const P1F = SRC + '/p1_foreground_false.png'     // ui_shot 产物 1258×622（A 轨）
const P1T = SRC + '/p1_foreground_true.png'      // 1280×720（B 轨）
// 预裁 + 缩放两路面板到 620×349
const panelA = SRC + '/p1_panelA.png'
await sharp(P1F).extract({ left: Math.round((1258 - 1106) / 2), top: 0, width: 1106, height: 622 }).resize(620, 349).png({ compressionLevel: 9 }).toFile(panelA)
const panelB = SRC + '/p1_panelB.png'
await sharp(P1T).resize(620, 349).png({ compressionLevel: 9 }).toFile(panelB)

const p1Html = wrap(`
<div style="position:absolute;inset:0;background:#f6f8fa;padding:18px 20px">
  <div style="font-size:21px;font-weight:800;color:#1a2233">P1 · 有头最小化不抢焦点</div>
  <div style="font-size:14px;color:#57606a;margin-top:4px">foreground:false 时 IDE 仍前台，截图仍 1280×720 清晰（ui_shot 实机，DPR=1）</div>
  <div style="display:flex;gap:10px;margin-top:14px">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0">${chip('A 轨默认 · foreground:false', '#1a7f37', '#dafbe1', true)}<span style="font-size:12px;color:#57606a">有头最小化到任务栏 · 不抢 IDE 焦点</span></div>
      <img src="${fileUrl(panelA)}" width="620" height="349" style="border-radius:12px;border:1.5px solid #d0d7de;display:block"/>
    </div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0">${chip('B 轨围观 · foreground:true', '#9a6700', '#fff8c5', true)}<span style="font-size:12px;color:#57606a">前台最大化 · 抢占屏幕焦点</span></div>
      <img src="${fileUrl(panelB)}" width="620" height="349" style="border-radius:12px;border:1.5px solid #d0d7de;display:block"/>
    </div>
  </div>
  <div style="margin-top:16px;background:#fff;border:1.5px solid #d0d7de;border-radius:12px;padding:12px 14px">
    <div style="font-size:13.5px;color:#24292f;line-height:1.6">
      <b>三轨模型</b> headless / maximized / foreground 正交 —— AI 默认静默后台验证（A），不打断你的主工作流；需要围观/录屏时显式切 B 轨（foreground:true）。
    </div>
    <div style="font-size:12px;color:#57606a;margin-top:6px">实机：DSH GUI @127.0.0.1:3080 · Emulation 1280×720 DPR=1 · 2026-08-22</div>
  </div>
</div>`, OUT + '/screenshot-p1-minimized.png', 1280, 720)
await renderHtml(p1Html, OUT + '/screenshot-p1-minimized.png', 1280, 720)

// ================= P2 =================
// 三帧: d1_pre(448, handle 828) / d1_mid_2(拖中, handle≈806) / d1_post(514, handle 766)
const cols = [
  { f: 'd1_pre.png', tag: '帧1 · 起点', note: '命中 cursor:col-resize 手柄 · dock 448px', ring: { x: Math.round(828 * 400 / 1280), y: Math.round(115 * 225 / 720) } },
  { f: 'd1_mid_2.png', tag: '帧2 · 拖拽中', note: 'steps 2/5 · 手柄随动 · dock ≈492px', ring: { x: Math.round(806 * 400 / 1280), y: Math.round(115 * 225 / 720) } },
  { f: 'd1_post.png', tag: '帧3 · 终点', note: 'dock 514px · 向左拖宽 66px', ring: null }
]
const p2colHtml = cols.map((c, i) => {
  const ring = c.ring
    ? `<div style="position:absolute;left:${c.ring.x - 13}px;top:${c.ring.y + 44 - 13}px;width:26px;height:26px;border:3px solid #d1242f;border-radius:50%;box-shadow:0 0 0 2px rgba(209,36,47,.25)"></div>
       <div style="position:absolute;left:${c.ring.x - 52}px;top:${c.ring.y + 44 - 34}px;background:#d1242f;color:#fff;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">cursor:col-resize</div>`
    : ''
  return `<div style="flex:1">
    <div style="display:flex;align-items:center;gap:6px;padding:6px 0">${chip(c.tag, '#0969da', '#ddf4ff')}</div>
    <div style="position:relative;width:400px;height:225px">
      <img src="${fileUrl(SRC + '/' + c.f)}" width="400" height="225" style="border-radius:10px;border:1.5px solid #d0d7de;display:block"/>
      ${ring}
    </div>
    <div style="font-size:11.5px;color:#57606a;margin-top:6px;line-height:1.4">${c.note}</div>
  </div>`
}).join('')
const p2Html = wrap(`
<div style="position:absolute;inset:0;background:#f6f8fa;padding:18px 20px">
  <div style="font-size:21px;font-weight:800;color:#1a2233">P2 · 分段拖拽三帧拼图</div>
  <div style="font-size:14px;color:#57606a;margin-top:4px">每段 ≤30px 重建输入上下文，破解折叠死锁直观可验</div>
  <div style="display:flex;gap:16px;margin-top:12px">${p2colHtml}</div>
  <div style="margin-top:16px;background:#fff;border:1.5px solid #d0d7de;border-radius:12px;padding:12px 14px">
    <div style="font-size:13.5px;color:#24292f;line-height:1.6"><b>ui_drive drag steps:5 shots:3</b>（等效脚本分帧驱动：press → move(steps:3) → up，每段重定位手柄，≤24px/段）<br/>单次长拖 pointermove 只生效前 1-2 档 —— 每段重新建立输入上下文是拖拽闭环的护城河。</div>
    <div style="font-size:12px;color:#57606a;margin-top:6px">实机：MattSkills 技能面板 dock 分隔条 nArs4W_panelResize（cursor:col-resize）· 2026-08-22</div>
  </div>
</div>`, OUT + '/screenshot-p2-drag-steps.png', 1280, 720)
await renderHtml(p2Html, OUT + '/screenshot-p2-drag-steps.png', 1280, 720)

// ================= P3 =================
const p3Html = wrap(`
<div style="position:absolute;inset:0;background:#f6f8fa;padding:18px 20px">
  <div style="font-size:21px;font-weight:800;color:#1a2233">P3 · 改前 / 改后对比</div>
  <div style="font-size:14px;color:#57606a;margin-top:4px">scrollWidth vs clientWidth 数值对比，data-fold 逐级折叠至不溢出</div>
  <div style="display:flex;gap:10px;margin-top:14px">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0">${chip('改前 · dock 300px', '#d1242f', '#ffebe9', true)}<span style="font-size:12px;color:#57606a">按钮文字折叠 4/6（列表·技能·环境检查·+需求 → 图标）</span></div>
      <img src="${fileUrl(SRC + '/s_p3_before_1.png')}" width="620" height="349" style="border-radius:12px;border:1.5px solid #d0d7de;display:block"/>
      <div style="margin-top:8px;background:#ffebe9;border:1.5px solid #d1242f;border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.5;color:#7d1218"><b>scrollWidth=300 clientWidth=300</b> · 文字可见 2/6 · data-fold=1</div>
    </div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0">${chip('改后 · dock 580px', '#1a7f37', '#dafbe1', true)}<span style="font-size:12px;color:#57606a">分段拖拽回宽后 6/6 全部恢复</span></div>
      <img src="${fileUrl(SRC + '/s_wide_1.png')}" width="620" height="349" style="border-radius:12px;border:1.5px solid #d0d7de;display:block"/>
      <div style="margin-top:8px;background:#dafbe1;border:1.5px solid #1a7f37;border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.5;color:#113a1f"><b>scrollWidth=580 clientWidth=580</b> · 文字可见 6/6 · data-fold=6</div>
    </div>
  </div>
  <div style="margin-top:16px;background:#fff;border:1.5px solid #d0d7de;border-radius:12px;padding:12px 14px">
    <div style="font-size:13.5px;color:#24292f;line-height:1.6"><b>改一行再验一次</b> —— 内容自适应折叠：全展开 → 按 data-priority 逐个加折叠档，每加一档 reflow 重测，直到 scrollWidth ≤ clientWidth + 1；验收锚点 dataset.fold 真机逐档断言。</div>
    <div style="font-size:12px;color:#57606a;margin-top:6px">实机：dock 拖窄至 300px 触发折叠（2/6 文字可见）→ 拖宽至 580px 恢复（6/6）· 2026-08-22</div>
  </div>
</div>`, OUT + '/screenshot-p3-before-after.png', 1280, 720)
await renderHtml(p3Html, OUT + '/screenshot-p3-before-after.png', 1280, 720)

// ================= P2 三帧独立序列（留证） =================
await sharp(SRC + '/d1_pre.png').toFile(OUT + '/frames/p2-frame-01.png')
await sharp(SRC + '/d1_mid_2.png').toFile(OUT + '/frames/p2-frame-02.png')
await sharp(SRC + '/d1_post.png').toFile(OUT + '/frames/p2-frame-03.png')

// ================= GIF 节拍浮层（800×450 透明） =================
const ovHtmls = {
  b1: `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(9,20,35,.82);color:#fff;font-size:15px;font-weight:700"><span style="color:#58a6ff">① 0-1s · ui_shot 首帧</span> 真实 Chrome 静默后台 · 最小化不抢焦点</div>`,
  b2: `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(9,20,35,.82);color:#fff;font-size:15px;font-weight:700"><span style="color:#bc8cff">② 1-3s · 点击 seg「可接」</span> 右侧 dock 打开</div>`,
  b3: `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(9,20,35,.82);color:#fff;font-size:15px;font-weight:700"><span style="color:#f0a35e">③ 3-5s · 分段拖拽 ×2</span> 每段 ≤24px press→move→up 重建输入上下文</div>`,
  b4: `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(9,20,35,.82);color:#fff;font-size:15px;font-weight:700"><span style="color:#ff7b72">④ 5-6s · 代码 diff 浮层</span> 内容自适应折叠 · data-fold 逐档断言</div>
  <div style="position:absolute;left:50%;top:118px;transform:translateX(-50%);width:640px;background:rgba(13,17,23,.92);border:1.5px solid #30363d;border-radius:10px;padding:12px 14px;font-family:Consolas,monospace;font-size:12.5px;line-height:1.9">
    <div style="color:#8b949e;font-size:11px;margin-bottom:6px;font-family:'Segoe UI',sans-serif">dsh-plugin-ui-debug · tabs 折叠修复（diff）</div>
    <div style="color:#ff7b72">- if (viewport < 640) fold(2) <span style="color:#8b949e">// 阈值硬编码 → 宽屏漂移</span></div>
    <div style="color:#7ee787">+ while (scrollWidth &gt; clientWidth + 1) foldNext() <span style="color:#8b949e">// 内容自适应</span></div>
    <div style="color:#7ee787">+ dataset.fold = 折叠数 <span style="color:#8b949e">// 真机逐档断言</span></div>
  </div>`,
  b5: `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(9,20,35,.82);color:#fff;font-size:15px;font-weight:700"><span style="color:#3fb950">⑤ 6-8s · 二次 ui_shot + 绿勾 PASS</span> scrollW=580 clientW=580 · 文字 6/6 恢复</div>
  <div style="position:absolute;right:20px;top:18px;display:flex;align-items:center;gap:8px;background:rgba(26,127,55,.94);color:#fff;padding:8px 14px;border-radius:22px;font-size:15px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.35)">✓ PASS · 6/6 文字可见 · data-fold=6</div>`
}
for (const [k, inner] of Object.entries(ovHtmls)) {
  await renderHtml(wrap(inner, 800, 450, 'transparent'), OV + '/' + k + '.png', 800, 450)
}

// ================= 节拍帧清单（→ 80 帧） =================
const beats = [
  { name: 'b1', src: ['g1_01', 'g1_02', 'g1_03', 'g1_04'], count: 10 },
  { name: 'b2', src: ['g2_01', 'g2_02', 'g2_03', 'g2_04', 'g2_05', 'g2_06'], count: 20 },
  { name: 'b3', src: ['d1_mid_1', 'd1_mid_2', 'd1_mid_3', 'd1_post', 'd2_mid_1', 'd2_mid_2', 'd2_mid_3', 's_wide_1', 's_wide_2'], count: 20 },
  { name: 'b4', src: ['s_wide_2'], count: 10 },
  { name: 'b5', src: ['v2_01', 'v2_02', 'v2_03', 'v2_04'], count: 20 }
]
const pick = (list, i, n) => list[Math.round(i * (list.length - 1) / Math.max(1, n - 1))]
let idx = 0
for (const beat of beats) {
  const overlay = OV + '/' + beat.name + '.png'
  for (let i = 0; i < beat.count; i++) {
    const s = pick(beat.src, i, beat.count)
    const out = join(FRAMES, 'frame_' + String(idx).padStart(3, '0') + '.png')
    await sharp(SRC + '/' + s + '.png')
      .extract({ left: 480, top: 135, width: 800, height: 450 })
      .composite([{ input: overlay, left: 0, top: 0 }])
      .png({ compressionLevel: 9 })
      .toFile(out)
    idx++
  }
}
console.log('frames written:', idx)

// poster = GIF 首帧
await sharp(join(FRAMES, 'frame_000.png')).toFile(OUT + '/demo-closed-loop-poster.png')

await browser.close()
console.log('COMPOSE-DONE')