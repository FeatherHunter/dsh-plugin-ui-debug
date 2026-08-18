// tabs-regression.mjs — 通用「tabs 折叠/展开回归验证」原子命令（plugin 的 sizing 验证核心）
// 用法: node tabs-regression.mjs [--url http://127.0.0.1:59519] [--session "会话标题"] [--narrow 250] [--wide 300]
// 流程: 起真实Chrome → 健康重试 → 激活会话 → 点可接 → 拖窄(触发折叠) → 拖宽(验证展开) → 每档采样 lv/文字可见性
// 输出: PASS/FAIL（展开后 anyText 应恢复）—— 可直接作为回归断言。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const DSH = arg('url', 'http://127.0.0.1:59519')
const SESSION = arg('session', '用better-sidebar加载DSH')
const NARROW = Number(arg('narrow', '250'))
const WIDE = Number(arg('wide', '300'))
const OUT = arg('out', 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/regress')
mkdirSync(OUT, { recursive: true })
const HARD_MS = 180000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())
const log = (...a) => console.log(...a)

const tabsDetail = async (page) => page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 50 && r.x > 600 })
  const t = list[list.length - 1]
  if (!t) return null
  const tr = t.getBoundingClientRect()
  let lv = 0
  if (t.classList.contains('dsws-tabs-l2')) lv = 2
  else if (t.classList.contains('dsws-tabs-l1')) lv = 1
  const btns = Array.from(t.querySelectorAll('button')).map((b) => {
    const br = b.getBoundingClientRect()
    const labels = Array.from(b.querySelectorAll('span')).filter((s) => {
      if (s.classList.contains('dsws-rficon')) return false
      return s.offsetWidth > 0 && s.offsetHeight > 0
    })
    return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), textVisible: labels.length > 0 }
  })
  return { avail: Math.round(tr.width), lv, anyText: btns.filter((b) => b.textVisible).length, btns }
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

// 拖到目标宽（delta>0=右移=变窄）
const dragTo = async (page, target, label, dir) => {
  const seg = 30; let guard = 0
  while (guard++ < 70) {
    const st = await tabsDetail(page)
    if (!st) { log(`${label}: panel lost`); return }
    const done = dir > 0 ? st.avail <= target : st.avail >= target
    if (done) { log(`${label}: reached avail=${st.avail}`); return }
    const cur = await locateDivider(page)
    if (!cur) { await new Promise((r) => setTimeout(r, 200)); continue }
    const step = Math.min(seg, Math.abs(st.avail - target))
    if (Date.now() > deadline) return
    await page.mouse.move(cur.x, cur.y); await new Promise((r) => setTimeout(r, 80))
    await page.mouse.down(); await new Promise((r) => setTimeout(r, 120))
    await page.mouse.move(cur.x + dir * step, cur.y, { steps: 3 }); await new Promise((r) => setTimeout(r, 200))
    await page.mouse.up(); await new Promise((r) => setTimeout(r, 200))
  }
}

let browser
try {
  log(`[1] 启动真实 Chrome → ${DSH}`)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: remaining() })
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => { try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {} })
  const page = await context.newPage()

  log('[2] 健康检查（最多 6 次 reload）')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: remaining() })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')

  log(`[3] 激活会话「${SESSION}」`)
  const sess = await page.evaluate((k) => {
    const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }, SESSION)
  if (!sess) throw new Error('no session: ' + SESSION)
  await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500)

  log('[4] 点「可接」')
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('no 可接')
  await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500)

  log('[5] 初始态')
  const init = await tabsDetail(page)
  log('  INIT: ' + JSON.stringify(init))

  log(`[6] 拖窄 ${NARROW}px（触发折叠）`)
  await dragTo(page, init.avail - NARROW, 'narrow', 1)
  const narrow = await tabsDetail(page)
  log('  NARROW: ' + JSON.stringify(narrow))

  log(`[7] 拖宽 ${WIDE}px（验证展开恢复——修复点）`)
  await dragTo(page, init.avail - NARROW + WIDE, 'widen', -1)
  const wide = await tabsDetail(page)
  log('  WIDEN: ' + JSON.stringify(wide))
  await page.screenshot({ path: OUT + '/regress-widen.png' })

  const pass = wide && wide.anyText > narrow.anyText
  log(pass
    ? '✅ PASS: 拖宽后文字恢复（anyText ' + narrow.anyText + ' → ' + wide.anyText + '）'
    : '❌ FAIL: 拖宽后文字未恢复（anyText ' + narrow.anyText + ' → ' + wide.anyText + '）—— 死锁仍在')
  log('REGRESSION-' + (pass ? 'PASS' : 'FAIL'))
  process.exitCode = pass ? 0 : 1
} catch (e) {
  console.error('REGRESSION-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
