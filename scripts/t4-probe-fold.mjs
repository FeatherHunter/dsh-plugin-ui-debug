// t4-probe-fold.mjs — probe dock fold/overflow behavior at several widths (P3 design)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:3080'
const OUT = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/probe'
mkdirSync(OUT, { recursive: true })

const dockDetail = async (page) => page.evaluate(() => {
  const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
  const tabs = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 200 })
  const t = tabs[tabs.length - 1]
  const rail = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width <= 40 })[0]
  let lv = 0
  if (t) { if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1 }
  // overflow elements inside the pane (horizontal)
  const over = []
  if (pane) {
    const pr = pane.getBoundingClientRect()
    for (const el of pane.querySelectorAll('*')) {
      if (el.children.length > 3) continue
      const r = el.getBoundingClientRect()
      if (r.width < 10 || r.height < 8) continue
      if (el.scrollWidth > el.clientWidth + 3 && r.x >= pr.x - 2 && r.x + r.width <= pr.x + pr.width + 2) {
        over.push({ cls: (el.className || '').toString().slice(0, 45), overflow: el.scrollWidth - el.clientWidth, sw: el.scrollWidth, cw: el.clientWidth, x: Math.round(r.x), w: Math.round(r.width), fold: el.dataset.fold ?? null })
      }
    }
  }
  const allFold = Array.from(document.querySelectorAll('[data-fold]')).map((e) => ({ cls: (e.className || '').toString().slice(0, 40), fold: e.dataset.fold }))
  return {
    pane: pane ? { x: Math.round(pane.getBoundingClientRect().x), w: Math.round(pane.getBoundingClientRect().width) } : null,
    tabs: t ? { w: Math.round(t.getBoundingClientRect().width), scrollW: t.scrollWidth, clientW: t.clientWidth, lv, btns: Array.from(t.querySelectorAll('button')).length } : null,
    rail: rail ? { w: Math.round(rail.getBoundingClientRect().width), scrollW: rail.scrollWidth, clientW: rail.clientWidth } : null,
    overflow: over.slice(0, 10),
    allFold
  }
})

const locateDivider = async (page) => page.evaluate(() => {
  const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
  if (!pane) return null
  const pr = pane.getBoundingClientRect()
  const cx = Math.round(pr.x - 6)
  for (let y = Math.ceil(pr.top) + 40; y < Math.floor(pr.bottom) - 40; y += 8) {
    for (let x = cx - 10; x <= cx + 8; x += 2) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      const cs = getComputedStyle(el)
      if (cs.cursor === 'col-resize' || cs.cursor === 'ew-resize') return { x, y }
    }
  }
  return null
})

const dragBy = async (page, delta, label) => {
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
  }
  console.log(`${label}: moved=${moved}`)
}

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

  const states = {}
  states['default'] = await dockDetail(page)
  console.log('STATE default:', JSON.stringify(states['default'], null, 0).slice(0, 2000))

  await dragBy(page, -180, 'widen180')
  states['w180'] = await dockDetail(page)
  console.log('STATE w180:', JSON.stringify(states['w180'], null, 0).slice(0, 2000))

  await dragBy(page, 480, 'narrow480')
  states['n300'] = await dockDetail(page)
  console.log('STATE n300(≈):', JSON.stringify(states['n300'], null, 0).slice(0, 2000))
  await page.screenshot({ path: OUT + '/probe-narrow-dock.png' })

  await dragBy(page, -200, 'w200back')
  states['back'] = await dockDetail(page)
  console.log('STATE back:', JSON.stringify(states['back'], null, 0).slice(0, 2000))
  await page.screenshot({ path: OUT + '/probe-widen-back.png' })

  await page.waitForTimeout(500)
  console.log('PROBE2-DONE')
} catch (e) {
  console.error('PROBE2-ERR:', e)
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}