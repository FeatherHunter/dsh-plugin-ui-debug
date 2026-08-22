// t4-capture-final.mjs — beat5 二次验证帧：新会话 → 点 seg 开 dock → 分段拖宽到 ~580 → v2_01..04
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:3080'
const OUT = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/t4'
const TARGET = 580

let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: 60000 })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.addInitScript(() => {
    const st = document.createElement('style')
    st.textContent = '*{transition:none!important;animation:none!important}'
    document.documentElement.appendChild(st)
  })
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')
  await page.waitForTimeout(1200)

  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  await page.mouse.click(seg.x, seg.y)
  await page.waitForTimeout(2200)

  const paneW = () => page.evaluate(() => {
    const pane = Array.from(document.querySelectorAll('[class*=paneTab]')).filter((e) => e.getBoundingClientRect().width > 100).pop()
    return pane ? Math.round(pane.getBoundingClientRect().width) : 0
  })
  const locDiv = () => page.evaluate(() => {
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

  let guard = 0
  while (guard++ < 40) {
    const w = await paneW()
    if (Math.abs(w - TARGET) <= 8) break
    const cur = await locDiv()
    if (!cur) { await new Promise((r) => setTimeout(r, 200)); continue }
    const segPx = Math.min(24, Math.abs(w - TARGET))
    const dir = w > TARGET ? 1 : -1
    await page.mouse.move(cur.x, cur.y); await new Promise((r) => setTimeout(r, 60))
    await page.mouse.down(); await new Promise((r) => setTimeout(r, 100))
    await page.mouse.move(cur.x + dir * segPx, cur.y, { steps: 3 }); await new Promise((r) => setTimeout(r, 150))
    await page.mouse.up(); await new Promise((r) => setTimeout(r, 150))
  }
  await page.waitForTimeout(600)
  const w = await paneW()
  const tabs = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.dsws-tabs')).filter((x) => x.getBoundingClientRect().width > 200).pop()
    if (!t) return null
    const btns = Array.from(t.querySelectorAll('button, [role=tab]')).map((b) => {
      const labels = Array.from(b.querySelectorAll('span, [class*=label], [class*=text]')).filter((s) => s.offsetWidth > 0 && s.offsetHeight > 0)
      return labels.length > 0
    })
    return { scrollW: t.scrollWidth, clientW: t.clientWidth, textVisible: btns.filter(Boolean).length }
  })
  console.log('FINAL-STATE', JSON.stringify({ w, tabs }))
  for (let i = 1; i <= 4; i++) {
    await page.screenshot({ path: OUT + '/v2_0' + i + '.png' })
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log('FINAL-SHOTS-DONE')
} catch (e) {
  console.error('FINAL-ERR:', e)
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}