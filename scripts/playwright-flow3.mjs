// playwright-flow3.mjs — 终版：激活会话 → 点可接 → 面板开（sidebar 模式）
// 分段拖拽双程采样（每段 30px，绕开 CDP pointer-capture 中途失效）
// 默认跑完自动关窗；KEEP=1 时保留窗口供观察（此时 job 会一直 running）
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const KEEP = process.env.KEEP === '1'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/pwflow3'
mkdirSync(OUT, { recursive: true })

const tabsState = async (page) => page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 100 && r.x > 600 })
  const t = list[list.length - 1]; if (!t) return null
  const tr = t.getBoundingClientRect()
  let lv = 0; if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1
  const btns = Array.from(t.querySelectorAll('button')).map((b) => { const br = b.getBoundingClientRect(); const lab = b.querySelector('span:not(.dsws-rficon):not(svg)'); return { t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6), h: Math.round(br.height), label: !!(lab && lab.offsetWidth > 0) } })
  return { avail: Math.round(tr.width), need: t.scrollWidth, rowH: Math.round(tr.height), lv, ovf: tr.width < t.scrollWidth, btns: btns.map((b) => b.t + ':' + (b.label ? 'L' : 'i') + '@' + b.h).join(' ') }
})
const short = (m) => m ? `avail=${m.avail} need=${m.need} rowH=${m.rowH} lv=${m.lv} ovf=${m.ovf} btns=[${m.btns}]` : '(no panel)'
const dcInfo = async (page) => page.evaluate(() => { const dc = document.querySelector('[class*=detailsCol]'); if (!dc) return null; const r = dc.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) } })
const locateDivider = async (page) => page.evaluate(() => {
  const dc = document.querySelector('[class*=detailsCol]'); if (!dc) return null
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

/** 分段拖拽：每段 30px press→move→up，绕开单次长拖中 pointermove 失效 */
const dragBy = async (page, total, label, shotAt) => {
  const seg = 30
  let done = 0
  const dir = total > 0 ? 1 : -1
  const shot = async (tag) => { await page.screenshot({ path: OUT + '/' + tag + '.png' }); console.log('shot ' + tag) }
  while (Math.abs(done) < Math.abs(total)) {
    const cur = await locateDivider(page)
    if (!cur) { console.log(`${label}: divider gone — abort`); break }
    const st0 = await tabsState(page)
    if (!st0) { console.log(`${label}: panel lost — abort`); break }
    const step = Math.min(seg, Math.abs(total) - Math.abs(done)) * dir
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(120)
    await page.mouse.down(); await page.waitForTimeout(150)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 })
    await page.waitForTimeout(300)
    await page.mouse.up()
    await page.waitForTimeout(300)
    done += step
    const st = await tabsState(page)
    const dc = await dcInfo(page)
    console.log(`${label} ${done} :: dcW=${dc ? dc.w : '?'} ${short(st)}`)
    if (shotAt.includes(Math.abs(done))) await shot(`${label}-${Math.abs(done)}`)
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'] })
try {
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => {
    try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) { /* ignore */ }
  })
  const page = await context.newPage()
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => { const b = (document.body ? document.body.innerText : ''); if (b.indexOf('Failed to load plugins') >= 0) return false; return document.querySelectorAll('.dsws-seg').length > 0 })
    console.log(`attempt#${attempt} :: ok=${healthy}`)
    if (healthy) break
  }
  if (!healthy) { console.log('!! 页面多次加载失败'); process.exitCode = 1; throw new Error('load-failed') }

  // 激活会话 → 点可接
  const sess = await page.evaluate(() => { const k = '用better-sidebar加载DSH'; const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 }); const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]; if (!leaf) return null; const r = leaf.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (sess) { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500) }
  const seg = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2000) }
  console.log('panel ::', short(await tabsState(page)))
  const dv = await locateDivider(page)
  console.log('divider ::', JSON.stringify(dv))
  if (!dv) { console.log('!! 无分隔条'); throw new Error('no-divider') }

  await dragBy(page, 200, 'narrow', [100, 200])
  await dragBy(page, -450, 'widen', [200, 350, 450])
  console.log('final ::', short(await tabsState(page)))
} finally {
  if (!KEEP) { try { await browser.close() } catch (e) { /* ignore */ } }
}
console.log('PW-FLOW3-DONE')
if (KEEP) { console.log('窗口保留（KEEP=1），观察完请手动关闭或 kill job'); await new Promise(() => {}) }
