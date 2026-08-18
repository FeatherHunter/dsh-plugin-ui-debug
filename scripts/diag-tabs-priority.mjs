// diag-tabs-priority.mjs — 诊断：所有 .dsws-tabs 容器内按钮的 data-priority 是否真实渲染
// 目的：查"列表/技能/环境检查"为何不折叠——data-priority 属性是否丢失
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:59519'

let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'] })
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => { try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {} })
  const page = await context.newPage()

  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded' })
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

  // 检查所有 .dsws-tabs 容器
  const diag = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.dsws-tabs')).map((t, ci) => {
      const tr = t.getBoundingClientRect()
      const btns = Array.from(t.querySelectorAll('button')).map((b) => {
        const br = b.getBoundingClientRect()
        return {
          cls: b.className,
          priority: b.getAttribute('data-priority'),  // null = 没渲染！
          collapsed: b.classList.contains('collapsed'),
          text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8),
          w: Math.round(br.width),
          x: Math.round(br.x),
        }
      })
      return { container: ci, x: Math.round(tr.x), w: Math.round(tr.width), btns }
    })
    return containers
  })
  console.log('=== 所有 .dsws-tabs 容器按钮诊断 ===')
  for (const c of diag) {
    console.log(`容器#${c.container} @x=${c.x} w=${c.w}`)
    for (const b of c.btns) {
      console.log(`  [${b.cls}] priority=${b.priority ?? '❌NULL'} collapsed=${b.collapsed} "${b.text}" w=${b.w} @x=${b.x}`)
    }
  }
  console.log('DIAG-DONE')
} catch (e) {
  console.error('DIAG-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
