// t4-probe-drag.mjs — probe: segmented drag against DSH dock resizer (A-form)
// Pattern from tabs-regression.mjs (verified on real machine): hover → down → move(steps:3) → up, re-locate per ≤30px segment.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:3080'
const OUT = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/probe'
mkdirSync(OUT, { recursive: true })

const dockDetail = async (page) => page.evaluate(() => {
  const panes = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100)
  const p = panes[panes.length - 1]
  const tabs = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 200 })
  const t = tabs[tabs.length - 1]
  return {
    pane: p ? { x: Math.round(p.getBoundingClientRect().x), w: Math.round(p.getBoundingClientRect().width) } : null,
    tabs: t ? { w: Math.round(t.getBoundingClientRect().width), scrollW: t.scrollWidth, clientW: t.clientWidth } : null,
    win: { iw: innerWidth, ih: innerHeight }
  }
})

const locateDivider = async (page) => page.evaluate(() => {
  // scan left edge of the open dock for a col-resize handle
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

const dragBy = async (page, delta, label) => {
  // delta > 0 = drag right (narrow dock); delta < 0 = drag left (widen)
  const seg = 24
  let moved = 0
  let guard = 0
  while (guard++ < 20 && Math.abs(moved) < Math.abs(delta)) {
    const cur = await locateDivider(page)
    if (!cur) { console.log(`${label}: no divider`); break }
    const step = Math.sign(delta) * Math.min(seg, Math.abs(delta) - Math.abs(moved))
    await page.mouse.move(cur.x, cur.y); await new Promise((r) => setTimeout(r, 100))
    await page.mouse.down(); await new Promise((r) => setTimeout(r, 150))
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await new Promise((r) => setTimeout(r, 250))
    await page.mouse.up(); await new Promise((r) => setTimeout(r, 250))
    moved += step
    console.log(`${label}: segment ${moved}/${delta}px handle@(${cur.x},${cur.y}) ${cur.cls}`)
  }
  console.log(`${label}: done moved=${moved}`)
}

let browser
try {
  console.log('[1] launch')
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
  const context = await browser.newContext({ viewport: null })
  const page = await context.newPage()

  console.log('[2] health (retry up to 6)')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')

  console.log('[3] click 可接 seg')
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('no 可接 seg')
  await page.mouse.click(seg.x, seg.y)
  await page.waitForTimeout(2500)

  const before = await dockDetail(page)
  console.log('INIT:', JSON.stringify(before))
  const div = await locateDivider(page)
  console.log('DIVIDER:', JSON.stringify(div))

  console.log('[4] drag left -150 (widen)')
  await dragBy(page, -150, 'widen-150')
  const after1 = await dockDetail(page)
  console.log('AFTER-150:', JSON.stringify(after1))
  await page.screenshot({ path: OUT + '/probe-widen150.png' })

  console.log('[5] drag right +180 (narrow back)')
  await dragBy(page, 180, 'narrow-180')
  const after2 = await dockDetail(page)
  console.log('AFTER-NARROW:', JSON.stringify(after2))
  await page.screenshot({ path: OUT + '/probe-narrow180.png' })

  const ok = after1.pane && after1.pane.w > before.pane.w && after2.pane && after2.pane.w < after1.pane.w
  console.log(ok ? 'PROBE-PASS' : 'PROBE-FAIL')
} catch (e) {
  console.error('PROBE-ERR:', e)
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}