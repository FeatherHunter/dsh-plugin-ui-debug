// interactive-pw.mjs — Playwright 有头 Chrome 人机协作调试：
// 窗口保留，轮询 dump 状态；请用户手动在窗口里操作（点「可接」/拖分隔条）
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:59519'

const dump = async (page) => {
  return page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.dsws-tabs')).map((t) => { const r = t.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } })
    const dc = (() => { const el = document.querySelector('[class*=detailsCol]'); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } })()
    const paneTabs = Array.from(document.querySelectorAll('[class*=paneTab]')).map((t) => { const r = t.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } })
    const segs = Array.from(document.querySelectorAll('.dsws-seg')).map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8))
    const vw = window.innerWidth
    const bodyW = document.body.scrollWidth
    return { vw, bodyW, tabs, dc, paneTabs, segs }
  })
}

const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1707, height: 912 } })
  await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForSelector('.dsws-seg', { timeout: 40000 })
  await page.waitForTimeout(2000)
  console.log('WINDOW-READY ::', JSON.stringify(await dump(page)))
  console.log('>>> 请你在弹出的 Chrome 窗口里【手动点击状态栏「可接」】，我每 2 秒观察一次 <<<')
  for (let i = 1; i <= 45; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const d = await dump(page)
    console.log(`t+${i * 2}s ::`, JSON.stringify(d))
  }
} finally {
  // 保留窗口观察
}
console.log('OBSERVE-DONE')
await new Promise(() => {})
