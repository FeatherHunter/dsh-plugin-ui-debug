// probe-nats.mjs — 通用 sizing-probe：测量容器 avail / nats[] / contentReal[] 三组对照
// 用途：判断"容器是否真的放得下"——nats 被容器钳制是折叠/溢出类 bug 的常见根。
// 用法: node probe-nats.mjs [--url http://127.0.0.1:59519] [--tabs '.dsws-tabs'] [--levels 3]
// 输出: { avail, nats[], contentReal[], lv } —— 若 nats 全≈avail 而 contentReal 明显更小 → 钳制发生
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const DSH = arg('url', 'http://127.0.0.1:59519')
const TABS_SEL = arg('tabs', '.dsws-tabs')
const LEVELS = Number(arg('levels', '3'))
const OUT = arg('out', 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/probe')
mkdirSync(OUT, { recursive: true })
const HARD_MS = 120000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())
const log = (...a) => console.log(...a)

// 三组量同测：avail（容器宽） / nats[]（各档 scrollWidth，老算法） / contentReal[]（各档内容真实宽，新算法）
const measure = async (page) => page.evaluate(({ sel, lvMax }) => {
  const list = Array.from(document.querySelectorAll(sel)).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 50 })
  const t = list[list.length - 1]
  if (!t) return null
  const setLv = (lv) => { for (let k = 1; k < lvMax; k++) t.classList.remove('dsws-tabs-l' + k); if (lv > 0) t.classList.add('dsws-tabs-l' + lv) }
  const curLv = () => { for (let k = lvMax - 1; k >= 1; k--) if (t.classList.contains('dsws-tabs-l' + k)) return k; return 0 }
  const lv0 = curLv()
  const avail = t.clientWidth
  const nats = [], contentReal = []
  for (let k = 0; k < lvMax; k++) {
    setLv(k)
    nats[k] = t.scrollWidth
    const kids = Array.from(t.children)
    let minX = Infinity, maxX = -Infinity
    for (const c of kids) { const r = c.getBoundingClientRect(); if (r.width > 0) { if (r.x < minX) minX = r.x; if (r.x + r.width > maxX) maxX = r.x + r.width } }
    const tr = t.getBoundingClientRect()
    contentReal[k] = minX === Infinity ? 0 : Math.round(maxX - tr.x)
  }
  setLv(lv0)
  return { avail, nats, contentReal, lv0 }
}, { sel: TABS_SEL, lvMax: LEVELS })

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

  // 激活会话 + 点可接（让目标面板出现），否则 probe 无元素可测
  const sess = await page.evaluate((k) => {
    const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }, arg('session', '用better-sidebar加载DSH'))
  if (sess) { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500) }
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500) }

  const result = await measure(page)
  log('PROBE :: ' + JSON.stringify(result))
  if (result) {
    // 钳制判定：avail 已经 ≥ contentReal[0]（内容放得下），但 nats 仍全≈avail —— 说明若曾折叠，展开判定会被钳死
    const contentFits = result.avail >= result.contentReal[0] - 2
    const natsClamped = result.nats.every((n) => Math.abs(n - result.avail) <= 2)
    if (contentFits && natsClamped) {
      log('ℹ️ 宽态正常：内容放得下（contentReal=' + result.contentReal[0] + ' ≤ avail=' + result.avail + '），nats 被钳制属正常')
      log('   ⚠️ 但若曾折叠到 L1/L2，展开判定会用钳制后的 nats[cur-1] → 可能死锁（修复后已用 contentReal 测量）')
    } else if (!contentFits && natsClamped) {
      log('❌ 钳制 bug 风险：内容放不下（contentReal=' + result.contentReal[0] + ' > avail=' + result.avail + '）但 nats 被钳成容器宽 → 折叠展开判定会失真')
    }
  }
  log('PROBE-DONE')
} catch (e) {
  console.error('PROBE-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
