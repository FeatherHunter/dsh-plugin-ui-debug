// poc-probe-nats.mjs — 活页探针：验证根因「t.scrollWidth 被容器宽钳制」
// 在真实面板上，对 初始→窄→宽 三态，同时测：
//   avail         = 容器 clientWidth（展开判定用的空间）
//   nats[k]       = 设档 k 时 t.scrollWidth（源码就是这么测的）
//   contentReal[k]= 各档位下"内容实际自然宽"（按钮宽之和 + gap + padding）— 不被容器钳制
// 证据目标：拉宽后 nats[] 全部 = 容器宽（被钳制），而 contentReal[nats[cur-1]档] 明明 < avail，
//           但 tabsLevelDecide 用钳制后的 nats[cur-1] 判定 → 永不展开 → 死锁。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })
const HARD_MS = 200000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())
const log = (...a) => console.log(...a)

// 在页面注入测 nats 的探针（镜像源码 apply() 的做法，但不改 DOM 最终档位）
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
  // 内容实际自然宽：所有 children 的右边缘 - 容器左边缘（或取 children scrollWidth 和）
  // 更稳：按钮+末尾 children 的 getBoundingClientRect 横跨宽度
  const cs = getComputedStyle(t)
  const gap = parseFloat(cs.gap) || 0
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
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
  return { avail, nats, contentReal, lv0, hy4: 4 }
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

const dragRelative = async (page, delta, label) => {
  const seg = 30; const dir = delta > 0 ? 1 : -1; let done = 0
  while (Math.abs(done) < Math.abs(delta)) {
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone`); break }
    const step = Math.min(seg, Math.abs(delta) - Math.abs(done)) * dir
    if (Date.now() > deadline) break
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(80)
    await page.mouse.down(); await page.waitForTimeout(120)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await page.waitForTimeout(220)
    await page.mouse.up(); await page.waitForTimeout(220)
    done += step
  }
  log(`${label} done`)
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
  await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500)
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('no 可接')
  await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500)

  log('=== 初始宽态 ===')
  console.log('  INIT: ' + JSON.stringify(await measure(page)))
  await dragRelative(page, 320, 'shrink'); await page.waitForTimeout(500)
  log('=== 拖窄（触发 L1/L2）===');
  console.log('  NARROW: ' + JSON.stringify(await measure(page)))
  await dragRelative(page, -400, 'expand'); await page.waitForTimeout(500)
  log('=== 拖回宽（关键：死锁态的量）===')
  console.log('  WIDEN: ' + JSON.stringify(await measure(page)))
  log('PROBE-DONE')
} catch (e) {
  console.error('PROBE-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
