// t4-probe-p3.mjs — probe capsule/banner fold levels + tabs button text visibility (P3 before/after design)
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:3080'

const detail = async (page) => page.evaluate(() => {
  const out = {}
  const capsule = document.querySelector('.dsws-capsule')
  const banner = document.querySelector('.dsws-banner')
  for (const [name, el] of [['capsule', capsule], ['banner', banner]]) {
    if (!el) { out[name] = null; continue }
    const r = el.getBoundingClientRect()
    out[name] = {
      cls: (el.className || '').toString().slice(0, 60),
      fold: el.dataset.fold ?? null,
      sw: el.scrollWidth, cw: el.clientWidth,
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    }
  }
  // tabs row detail
  const t = Array.from(document.querySelectorAll('.dsws-tabs')).filter((x) => x.getBoundingClientRect().width > 200).pop()
  if (t) {
    const btns = Array.from(t.querySelectorAll('button, [role=tab]')).map((b) => {
      const br = b.getBoundingClientRect()
      const labels = Array.from(b.querySelectorAll('span, [class*=label], [class*=text]')).filter((s) => s.offsetWidth > 0 && s.offsetHeight > 0)
      const r = b.getBoundingClientRect()
      return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10), w: Math.round(r.width), vis: labels.length > 0 }
    })
    out.tabs = { lv: t.classList.contains('dsws-tabs-l2') ? 2 : t.classList.contains('dsws-tabs-l1') ? 1 : 0, btns, sw: t.scrollWidth, cw: t.clientWidth }
  }
  return out
})

const setFold = async (page, sel, v) => page.evaluate(({ sel, v }) => {
  const el = document.querySelector(sel)
  if (!el) return false
  el.dataset.fold = String(v)
  return true
}, { sel, v })

let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
  const context = await browser.newContext({ viewport: null })
  const page = await context.newPage()
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')

  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  await page.mouse.click(seg.x, seg.y)
  await page.waitForTimeout(2500)

  console.log('DEFAULT:', JSON.stringify(await detail(page), null, 0).slice(0, 1600))

  // exercise capsule folds
  for (const v of [0, 1, 2]) {
    const touched = await setFold(page, '.dsws-capsule', v)
    await page.waitForTimeout(400)
    const d = await detail(page)
    console.log(`CAPSULE-fold${v} (touched=${touched}):`, JSON.stringify(d.capsule, null, 0).slice(0, 400))
  }
  const d0 = await detail(page)
  console.log('TABS@default:', JSON.stringify(d0.tabs, null, 0).slice(0, 800))

  // narrow the dock to ~300 and check tabs text visibility
  const locateDivider = async () => page.evaluate(() => {
    const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
    if (!pane) return null
    const pr = pane.getBoundingClientRect()
    const cx = Math.round(pr.x - 6)
    for (let y = Math.ceil(pr.top) + 40; y < Math.floor(pr.bottom) - 40; y += 8) {
      for (let x = cx - 10; x <= cx + 8; x += 2) {
        const el = document.elementFromPoint(x, y)
        if (!el) continue
        if (getComputedStyle(el).cursor === 'col-resize' || getComputedStyle(el).cursor === 'ew-resize') return { x, y }
      }
    }
    return null
  })
  const dragBy = async (delta) => {
    const seg = 24
    let moved = 0
    let guard = 0
    while (guard++ < 30 && Math.abs(moved) < Math.abs(delta)) {
      const cur = await locateDivider()
      if (!cur) break
      const step = Math.sign(delta) * Math.min(seg, Math.abs(delta) - Math.abs(moved))
      await page.mouse.move(cur.x, cur.y); await new Promise((r) => setTimeout(r, 100))
      await page.mouse.down(); await new Promise((r) => setTimeout(r, 150))
      await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await new Promise((r) => setTimeout(r, 250))
      await page.mouse.up(); await new Promise((r) => setTimeout(r, 250))
      moved += step
    }
    return moved
  }

  // widen first then come down to a small width
  await dragBy(-150)
  await dragBy(480)
  await page.waitForTimeout(600)
  console.log('NARROWED:', JSON.stringify(await detail(page), null, 0).slice(0, 1600))
  console.log('PROBE3-DONE')
} catch (e) {
  console.error('PROBE3-ERR:', e)
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}