// pw-click-diag.mjs — 有头 Chrome 里点击「可接」后的完整布局诊断
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:59519'
const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 950 } })
  await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForSelector('.dsws-seg', { timeout: 40000 })
  await page.waitForTimeout(3000)

  const dump = async (tag) => {
    const d = await page.evaluate(() => ({
      tabs: Array.from(document.querySelectorAll('.dsws-tabs')).map((t) => { const r = t.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } }),
      hosts: Array.from(document.querySelectorAll('[data-dsws-host]')).map((h) => { const r = h.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x), cls: String(h.className || '').slice(0, 20) } }),
      dc: (() => { const el = document.querySelector('[class*=detailsCol]'); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } })(),
      paneTabs: Array.from(document.querySelectorAll('[class*=paneTab]')).map((t) => { const r = t.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } }),
      segs: Array.from(document.querySelectorAll('.dsws-seg')).map((s) => ({ t: (s.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), on: s.classList.contains('on') })),
    }))
    console.log(tag, '::', JSON.stringify(d))
  }

  await dump('BEFORE')
  // JS click
  await page.evaluate(() => { const seg = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (seg) seg.click() })
  await page.waitForTimeout(2500)
  await dump('AFTER-JS-CLICK')
  // 真鼠标点击
  const box = await page.evaluate(() => { const seg = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!seg) return null; const r = seg.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(2500) }
  await dump('AFTER-MOUSE-CLICK')
} finally { await browser.close() }
console.log('PW-CLICK-DIAG-DONE')
