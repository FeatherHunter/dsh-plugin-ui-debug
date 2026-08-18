// browser-boot.mjs — 通用「起真实浏览器 → 健康重试 → 激活会话 → 点可接 → 面板就绪」骨架
// 用法: node browser-boot.mjs [--url http://127.0.0.1:59519] [--session "会话标题"] [--seg 可接] [--cfg '{"openIn":"sidebar"}']
// 输出: 面板就绪后的一行状态（tabs avail/lv/anyText）—— 后续命令（tabs-state/drag-step/probe-nats）基于此复用
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const DSH = arg('url', 'http://127.0.0.1:59519')
const SESSION = arg('session', '用better-sidebar加载DSH')
const SEG_TEXT = arg('seg', '可接')
const CFG_JSON = arg('cfg', '{"withWayfinder":true,"openIn":"sidebar"}')
const HARD_MS = 120000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())
const log = (...a) => console.log(...a)

let browser
try {
  log('[1] 启动真实 Chrome（有头、最大化）')
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: remaining() })
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript((cfg) => {
    try { localStorage.setItem('dsws.cfg', cfg) } catch (e) {}
  }, CFG_JSON)
  const page = await context.newPage()

  log('[2] 健康检查（最多 6 次 reload，抗插件装配竞态）')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: remaining() })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    if (healthy) break
  }
  if (!healthy) throw new Error('load failed')

  log('[3] 激活会话「' + SESSION + '」')
  const sess = await page.evaluate((k) => {
    const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }, SESSION)
  if (!sess) { log('  ⚠️ 未找到会话「' + SESSION + '」（可换 --session）'); } else { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500); log('  已激活 @(' + sess.x + ',' + sess.y + ')') }

  log('[4] 点击 seg「' + SEG_TEXT + '」')
  const seg = await page.evaluate((k) => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf(k) === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }, SEG_TEXT)
  if (!seg) { log('  ⚠️ 未找到 seg「' + SEG_TEXT + '」'); } else { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500); log('  已点击 @(' + seg.x + ',' + seg.y + ')') }

  const st = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 50 && r.x > 600 })
    const t = list[list.length - 1]
    if (!t) return null
    const tr = t.getBoundingClientRect()
    let lv = 0; if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1
    return { avail: Math.round(tr.width), lv }
  })
  log('[5] 面板状态: ' + JSON.stringify(st))
  log('BOOT-READY')
  // 保持窗口到手动关闭（KEEP=1 或本命令的调用方接管）
  if (process.env.KEEP === '1') { console.log('窗口保留（KEEP=1）'); await new Promise(() => {}) }
} catch (e) {
  console.error('BOOT-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser && process.env.KEEP !== '1') { try { await browser.close() } catch (e) {} }
}
