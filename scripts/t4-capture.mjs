// t4-capture.mjs — T4 主拍摄会话（单浏览器，1280×720 DPR=1）：
// 首帧 → 点 seg 开 dock → 分段拖 2 次（期间逐帧）→ P3 拖窄/拖回 → 全部 PNG 落盘 + 状态 JSONL
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const DSH = 'http://127.0.0.1:3080'
const OUT = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/t4'
mkdirSync(OUT, { recursive: true })
const logf = []
const logState = (tag, obj) => { logf.push({ tag, ...obj }); writeFileSync(OUT + '/state.jsonl', logf.map((x) => JSON.stringify(x)).join('\n')) }

const measure = (page) => page.evaluate(() => {
  const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
  const t = Array.from(document.querySelectorAll('.dsws-tabs')).filter((x) => x.getBoundingClientRect().width > 200).pop()
  const out = {}
  if (pane) {
    const pr = pane.getBoundingClientRect()
    out.pane = { x: Math.round(pr.x), w: Math.round(pr.width), y: Math.round(pr.y), h: Math.round(pr.height) }
  }
  if (t) {
    const btns = Array.from(t.querySelectorAll('button, [role=tab]')).map((b) => {
      const r = b.getBoundingClientRect()
      const labels = Array.from(b.querySelectorAll('span, [class*=label], [class*=text]')).filter((s) => s.offsetWidth > 0 && s.offsetHeight > 0)
      return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), w: Math.round(r.width), vis: labels.length > 0 }
    })
    out.tabs = {
      lv: t.classList.contains('dsws-tabs-l2') ? 2 : t.classList.contains('dsws-tabs-l1') ? 1 : 0,
      scrollW: t.scrollWidth, clientW: t.clientWidth,
      textVisible: btns.filter((b) => b.vis).length, btns
    }
  }
  const capsule = document.querySelector('.dsws-capsule')
  if (capsule) out.capsuleFold = capsule.dataset.fold ?? null
  out.win = { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }
  return out
})

const locateDivider = (page) => page.evaluate(() => {
  const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
  if (!pane) return null
  const pr = pane.getBoundingClientRect()
  const cx = Math.round(pr.x - 6)
  for (let y = Math.ceil(pr.top) + 40; y < Math.floor(pr.bottom) - 40; y += 8) {
    for (let x = cx - 10; x <= cx + 8; x += 2) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      const cs = getComputedStyle(el)
      if (cs.cursor === 'col-resize' || cs.cursor === 'ew-resize') return { x, y, cls: (el.className || '').toString().slice(0, 40) }
    }
  }
  return null
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  // suppress animations & transitions so frames are stable (probe methodology)
  await page.addInitScript(() => {
    const st = document.createElement('style')
    st.textContent = '*{transition:none!important;animation:none!important}'
    document.documentElement.appendChild(st)
  })

  console.log('[2] health check (6 retries)')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')
  console.log('  healthy')
  await page.waitForTimeout(1500)

  const shot = async (name) => { await page.screenshot({ path: OUT + '/' + name + '.png' }); console.log('  shot', name) }

  // ---- beat1: 初始首帧（dock 未开） ----
  const initM = await measure(page)
  logState('init', initM)
  for (let i = 1; i <= 4; i++) { await shot('g1_0' + i); await sleep(300) }

  // ---- beat2: 点 seg 开 dock ----
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('no 可接 seg')
  await page.mouse.click(seg.x, seg.y)
  await sleep(400)
  for (let i = 1; i <= 6; i++) { await shot('g2_0' + i); await sleep(220) }
  const m0 = await measure(page)
  logState('dock-open', m0)
  if (!m0.pane || m0.pane.w < 100) throw new Error('dock did not open')
  console.log('  dock:', JSON.stringify(m0.pane), 'tabs:', JSON.stringify(m0.tabs && { sw: m0.tabs.scrollW, cw: m0.tabs.clientW, tv: m0.tabs.textVisible, lv: m0.tabs.lv }))

  // ---- 分段拖拽（每段 press→move(steps:3)→up，≤24px/段，命中点重定位） ----
  const dragSegments = async (delta, label, inShot) => {
    // delta<0 = 向左拖 = 加宽 dock
    const seg = 22
    let moved = 0
    let guard = 0
    const shotsTaken = []
    while (guard++ < 30 && Math.abs(moved) < Math.abs(delta)) {
      const cur = await locateDivider(page)
      if (!cur) { console.log('  ', label, 'no divider'); break }
      const step = Math.sign(delta) * Math.min(seg, Math.abs(delta) - Math.abs(moved))
      await page.mouse.move(cur.x, cur.y); await sleep(80)
      await page.mouse.down(); await sleep(120)
      await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await sleep(150)
      if (inShot) { for (const s of inShot) { await shot(s + '_' + guard); shotsTaken.push(s + '_' + guard) } }
      await page.mouse.up(); await sleep(180)
      moved += step
      logState(label + '-seg', { seg: guard, moved, handle: cur })
    }
    console.log('  ', label, 'moved', moved)
    return shotsTaken
  }

  // P2 col1（拖前 hover） + beat3 start
  const dv0 = await locateDivider(page)
  logState('d1-pre-divider', dv0)
  await page.mouse.move(dv0.x, dv0.y)
  await sleep(120)
  await shot('d1_pre')

  // 拖 1: -66 (3 段)
  await dragSegments(-66, 'drag1', ['d1_mid'])
  await shot('d1_post')
  logState('d1-post', await measure(page))

  // 拖 2: -66
  await dragSegments(-66, 'drag2', ['d2_mid'])
  await sleep(250)
  const m1 = await measure(page)
  logState('d2-post', m1)
  await shot('s_wide_1'); await sleep(250); await shot('s_wide_2')

  // ---- P3 before: 拖窄到 ≈300 ----
  const dragToWidth = async (target, label) => {
    let guard = 0
    while (guard++ < 60) {
      const m = await measure(page)
      const w = m.pane ? m.pane.w : 0
      if (Math.abs(w - target) <= 6) { console.log('  ', label, 'reached', w); return m }
      const cur = await locateDivider(page)
      if (!cur) { await sleep(200); continue }
      const delta = w - target // >0 → 需变窄 → 向右拖
      const seg = Math.min(24, Math.abs(delta))
      await page.mouse.move(cur.x, cur.y); await sleep(60)
      await page.mouse.down(); await sleep(100)
      await page.mouse.move(cur.x + Math.sign(delta) * seg, cur.y, { steps: 3 }); await sleep(160)
      await page.mouse.up(); await sleep(160)
    }
    throw new Error(label + ' timeout')
  }
  const narrow = await dragToWidth(300, 'p3-narrow')
  logState('p3-before', narrow)
  await sleep(300)
  await shot('s_p3_before_1'); await sleep(250); await shot('s_p3_before_2')

  // ---- P3 after: 拖回默认宽度 ----
  const mAfter = await dragToWidth(m0.pane.w, 'p3-widen')
  logState('p3-after', mAfter)
  await sleep(300)
  await shot('s_p3_after_1'); await sleep(250); await shot('s_p3_after_2')

  // final state
  const mf = await measure(page)
  logState('final', mf)
  console.log('CAPTURE-DONE')
  console.log('FINAL:', JSON.stringify(mf))
} catch (e) {
  console.error('CAPTURE-ERR:', e)
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}