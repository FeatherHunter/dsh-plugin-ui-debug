// nats-probe.mjs — 测量 tabs 各级自然宽（L0/L1/L2）与 detailsCol 宽度上限的关系
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:59519'
const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1707, height: 912 } })
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)
    healthy = await page.evaluate(() => { const b = (document.body ? document.body.innerText : ''); if (b.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) { console.log('!! 加载失败'); await browser.close(); process.exit(1) }
  // 点会话 + 点可接
  const sess = await page.evaluate(() => { const k = '用better-sidebar加载DSH'; const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 }); const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]; if (!leaf) return null; const r = leaf.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (sess) { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500) }
  const seg = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2000) }

  // 面板打开后：把面板拖到最大（520），测量 nats
  const probe = await page.evaluate(async () => {
    const dc = document.querySelector('[class*=detailsCol]'); if (!dc) return null
    const dr = dc.getBoundingClientRect()
    const cx = Math.round(dr.x)
    // 拖分隔条到最大（左缘左移 → 宽到 520）
    const findDiv = () => {
      for (let y = Math.ceil(dr.top) + 30; y < Math.floor(dr.bottom) - 30; y += 10) {
        for (let x = cx - 8; x <= cx + 8; x += 2) {
          const el = document.elementFromPoint(x, y)
          if (el) { const cs = getComputedStyle(el); if (cs.cursor === 'col-resize') return { x, y } }
        }
      }
      return null
    }
    const dv = findDiv()
    if (dv) {
      // 模拟拖拽：向左拖 200px（用真实事件在页面里模拟也行，这里直接派发 pointer 序列太麻烦，改用 playwright mouse —— 但这里在 evaluate 里无法。返回坐标由外部拖）
      return { needExternalDrag: true, dv, dcW: Math.round(dr.width), dcX: cx }
    }
    return { needExternalDrag: false }
  })
  console.log('PROBE1 ::', JSON.stringify(probe))

  // 外部拖到最宽
  if (probe && probe.needExternalDrag) {
    const dv = probe.dv
    await page.mouse.move(dv.x, dv.y); await page.waitForTimeout(150)
    await page.mouse.down(); await page.waitForTimeout(200)
    await page.mouse.move(dv.x - 220, dv.y, { steps: 5 })
    await page.waitForTimeout(400)
    await page.mouse.up()
    await page.waitForTimeout(500)
  }

  // 测量 nats：逐级设 class 读 scrollWidth
  const nats = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 100 && r.x > 800 })
    const t = list[list.length - 1]; if (!t) return null
    const rect = t.getBoundingClientRect()
    const nats = []
    for (let k = 0; k < 3; k++) {
      for (let q = 1; q < 3; q++) t.classList.remove('dsws-tabs-l' + q)
      if (k > 0) t.classList.add('dsws-tabs-l' + k)
      nats.push(t.scrollWidth)
    }
    for (let q = 1; q < 3; q++) t.classList.remove('dsws-tabs-l' + q)
    let cur = 0; if (t.classList.contains('dsws-tabs-l2')) cur = 2; else if (t.classList.contains('dsws-tabs-l1')) cur = 1
    return { clientW: Math.round(rect.width), nats, lv: cur }
  })
  console.log('NATS ::', JSON.stringify(nats))
} finally {
  await browser.close()
}
console.log('NATS-PROBE-DONE')
