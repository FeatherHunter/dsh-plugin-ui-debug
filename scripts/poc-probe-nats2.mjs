// poc-probe-nats2.mjs — 探针 v2：确定性拖到 L2 → 拖回宽，抓死锁态的 nats 证据
// 目的：证明"折叠后拖回宽，nats[cur-1] 被钳成容器宽 → avail >= nats+4 永不成立 → 死锁"
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })
const HARD_MS = 240000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())
const log = (...a) => console.log(...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const measure = async (page) => page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 50 && r.x > 600 })
  const t = list[list.length - 1]
  if (!t) return null
  const setLv = (lv) => { for (let k = 1; k < 3; k++) t.classList.remove('dsws-tabs-l' + k); if (lv > 0) t.classList.add('dsws-tabs-l' + lv) }
  const curLv = () => { for (let k = 2; k >= 1; k--) if (t.classList.contains('dsws-tabs-l' + k)) return k; return 0 }
  const lv0 = curLv()
  const avail = t.clientWidth
  const nats = []
  for (let k = 0; k < 3; k++) { setLv(k); nats[k] = t.scrollWidth }
  const cs = getComputedStyle(t)
  const gap = parseFloat(cs.gap) || 0
  const contentReal = []
  for (let k = 0; k < 3; k++) {
    setLv(k)
    const kids = Array.from(t.children)
    if (!kids.length) { contentReal[k] = 0; continue }
    let minX = Infinity, maxX = -Infinity
    for (const c of kids) { const r = c.getBoundingClientRect(); if (r.width > 0) { minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.width) } }
    const tr = t.getBoundingClientRect()
    contentReal[k] = minX === Infinity ? 0 : Math.round(maxX - tr.x)
  }
  setLv(lv0)
  return { avail, nats, contentReal, lv0 }
})

const locateDivider = async (page) => page.evaluate(() => {
  const dc = document.querySelector('[class*=detailsCol]')
  if (!dc) return null
  const dr = dc.getBoundingClientRect()
  const cx = Math.round(dr.x)
  for (let y = Math.ceil(dr.top) + 30; y < Math.floor(dr.bottom) - 30; y += 10) {
    for (let x = cx - 10; x <= cx + 10; x += 2) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      const cs = getComputedStyle(el)
      if (cs.cursor === 'col-resize' || cs.cursor === 'ew-resize') return { x, y }
    }
  }
  return null
})

// 拖到目标窄度（向右拖 = 变窄）
const dragToNarrow = async (page, targetAvail, label) => {
  const seg = 30; let guard = 0
  while (guard++ < 60) {
    const st = await measure(page)
    if (!st) { log(`${label}: panel lost`); return }
    if (st.avail <= targetAvail) { log(`${label}: reached avail=${st.avail}`); return }
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone`); await sleep(200); continue }
    const step = Math.min(seg, st.avail - targetAvail)
    if (Date.now() > deadline) return
    await page.mouse.move(cur.x, cur.y); await sleep(80)
    await page.mouse.down(); await sleep(120)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await sleep(200)
    await page.mouse.up(); await sleep(200)
  }
}
const dragToWide = async (page, targetAvail, label) => {
  const seg = 30; let guard = 0
  while (guard++ < 70) {
    const st = await measure(page)
    if (!st) { log(`${label}: panel lost`); return }
    if (st.avail >= targetAvail) { log(`${label}: reached avail=${st.avail}`); return }
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone`); await sleep(200); continue }
    const step = Math.min(seg, targetAvail - st.avail)
    if (Date.now() > deadline) return
    await page.mouse.move(cur.x, cur.y); await sleep(80)
    await page.mouse.down(); await sleep(120)
    await page.mouse.move(cur.x - step, cur.y, { steps: 3 }); await sleep(200)
    await page.mouse.up(); await sleep(200)
  }
}

let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: remaining() })
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => { try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {} })
  const page = await context.newPage()

  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: remaining() })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')

  const sess = await page.evaluate(() => {
    const k = '用better-sidebar加载DSH'
    const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!sess) throw new Error('no session')
  await page.mouse.click(sess.x, sess.y); await sleep(2500)
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('no 可接')
  await page.mouse.click(seg.x, seg.y); await sleep(2500)

  log('=== A 初始宽态 ===')
  console.log('  A-init: ' + JSON.stringify(await measure(page)))
  await dragToNarrow(page, 280, 'toL2')
  log('=== B 极窄（L2 全折叠）===')
  console.log('  B-narrow: ' + JSON.stringify(await measure(page)))
  await dragToWide(page, 650, 'backWide')
  log('=== C 拖回宽（死锁态）===')
  const c = await measure(page)
  console.log('  C-widen: ' + JSON.stringify(c))
  // 判定：死锁时应为 avail(约650+) 但 lv0 仍 2，且 nats 全 = avail
  log(c && c.lv0 === 2 && c.avail >= 600
    ? '=== 死锁坐实 ==='
    : '=== 未复现死锁（意外）===' )
  log('PROBE2-DONE')
} catch (e) {
  console.error('PROBE2-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
