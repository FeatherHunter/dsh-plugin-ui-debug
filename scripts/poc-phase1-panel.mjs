// poc-phase1-panel.mjs — Phase 1：激活会话 → 点可接 → 打开右侧面板 → 读 tabs 状态 → 截图
// 全自动。跑完自动关窗（KEEP=1 保留）。带硬超时防挂起。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const KEEP = process.env.KEEP === '1'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })
const HARD_MS = 120000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())

const log = (...a) => console.log(...a)

let browser
try {
  log('[1] 启动真实 Chrome（有头、最大化）')
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'], timeout: remaining() })
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => { try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {} })
  const page = await context.newPage()

  log('[2] 导航 + 健康检查')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: remaining() })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    log(`  attempt#${attempt} → ok=${healthy}`)
    if (healthy) break
  }
  if (!healthy) throw new Error('页面多次加载失败')

  log('[3] 激活历史会话「用better-sidebar加载DSH」')
  const sess = await page.evaluate(() => {
    const k = '用better-sidebar加载DSH'
    const all = Array.from(document.querySelectorAll('*')).filter((el) => {
      const t = (el.textContent || '').trim()
      return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40
    })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!sess) throw new Error('未找到目标会话「用better-sidebar加载DSH」')
  await page.mouse.click(sess.x, sess.y)
  await page.waitForTimeout(2500)
  const activeTitle = await page.evaluate(() => { const s = document.querySelector('.dsws-seg'); return s ? document.title : '' }).catch(() => null)
  log(`  已点击会话 @(${sess.x},${sess.y})，当前标题：${activeTitle}`)

  log('[4] 点击「可接」seg')
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) { log('  ⚠️ 未找到「可接」seg，但仍继续看面板状态'); } else { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500); log(`  已点击「可接」@(${seg.x},${seg.y})`) }

  log('[5] 读取面板/tabs 状态')
  const panel = await page.evaluate(() => {
    const info = { hasSidebarPane: false, hasTabs: false, tabsWidth: null, tabsInfo: null, dc: null }
    // better-sidebar 面板容器
    const pane = document.querySelector('.nArs4W_paneTab') || document.querySelector('[class*=paneTab]')
    if (pane) { info.hasSidebarPane = true; info.paneRect = (() => { const r = pane.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) } })() }
    // tabs
    const tabs = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 100 && r.x > 600 })
    const t = tabs[tabs.length - 1]
    if (t) {
      info.hasTabs = true
      const tr = t.getBoundingClientRect()
      let lv = 0; if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1
      info.tabsWidth = Math.round(tr.width)
      info.tabsInfo = { avail: Math.round(tr.width), need: t.scrollWidth, rowH: Math.round(tr.height), lv, ovf: tr.width < t.scrollWidth }
    }
    const dc = document.querySelector('[class*=detailsCol]')
    if (dc) { const r = dc.getBoundingClientRect(); info.dc = { x: Math.round(r.x), w: Math.round(r.width) } }
    return info
  })
  log('  panel 状态: ' + JSON.stringify(panel))

  log('[6] 截图（面板打开态）')
  const fp = OUT + '/phase1-panel.png'
  await page.screenshot({ path: fp })
  log(`  已保存: ${fp}`)

  log('POC-PHASE1-DONE')
} catch (e) {
  console.error('POC-PHASE1-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser && !KEEP) { try { await browser.close() } catch (e) {} }
}
if (KEEP) { console.log('窗口保留（KEEP=1），观察完请手动关闭'); await new Promise(() => {}) }
