// confirm-probe.mjs — 确认两个问题：①页面高度/左下角设置可见性 ②面板模式（dock vs sidebar）与 openIn 配置
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

  // 问题 1：高度与左下角设置按钮
  const height = await page.evaluate(() => {
    const setBtn = Array.from(document.querySelectorAll('*')).find((el) => { const t = (el.textContent || '').trim(); return t === '设置' && el.children.length === 0 })
    const r = setBtn ? setBtn.getBoundingClientRect() : null
    return {
      innerH: window.innerHeight, innerW: window.innerWidth,
      docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth,
      settingsBtn: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.bottom <= window.innerHeight } : null,
    }
  })
  console.log('Q1-HEIGHT ::', JSON.stringify(height))

  // 问题 2：openIn 配置与面板形态
  const cfg = await page.evaluate(() => {
    let openIn = null, raw = null
    try { raw = localStorage.getItem('dsws.cfg'); if (raw) openIn = JSON.parse(raw).openIn } catch (e) {}
    const bs = { paneTabs: document.querySelectorAll('[class*=nArs4W_paneTab]').length, tabBar: document.querySelectorAll('[class*=nArs4W_tabBar]').length, mattsTab: Array.from(document.querySelectorAll('[class*=nArs4W_tab]')).some((e) => /Matt|Waystation/i.test((e.textContent || '') + (e.getAttribute('title') || ''))) }
    return { openIn, raw: raw ? raw.slice(0, 120) : null, bs }
  })
  console.log('Q2-CFG ::', JSON.stringify(cfg))

  // 点会话 + 可接，看面板形态
  const sess = await page.evaluate(() => { const k = '用better-sidebar加载DSH'; const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 }); const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]; if (!leaf) return null; const r = leaf.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (sess) { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500) }
  const seg = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2000) }
  const panel = await page.evaluate(() => {
    const dc = document.querySelector('[class*=detailsCol]'); const dr = dc ? dc.getBoundingClientRect() : null
    const pt = Array.from(document.querySelectorAll('[class*=nArs4W_paneTab]')).map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x) } })
    return { detailsCol: dr ? { w: Math.round(dr.width), x: Math.round(dr.x) } : null, paneTabs: pt }
  })
  console.log('Q2-PANEL ::', JSON.stringify(panel))
} finally {
  await browser.close()
}
console.log('CONFIRM-DONE')
