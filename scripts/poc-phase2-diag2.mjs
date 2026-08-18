// poc-phase2-diag2.mjs — 校正版：三种入口全测「很宽时按钮文字消失」问题
// 1) 打开面板初始态（不拖）  2) 真实拖窄<400 → 触发折叠 → 拖宽 → 看文字是否回来
// 3) 拖到最宽（~最大 avail）
// 方向校正：分隔条向右拖 = 面板变窄（拖动坐标系已核实：divider 在面板左缘，右移→窄）。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const KEEP = process.env.KEEP === '1'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
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
      const st = getComputedStyle(s)
      return st.position !== 'absolute' || s.offsetParent !== null
    })
    const textVisible = labels.some((s) => s.offsetWidth > 0)
    return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), w: Math.round(br.width), textVisible }
  })
  return { avail: Math.round(tr.width), need: t.scrollWidth, rowH: Math.round(tr.height), lv, ovf: tr.width < t.scrollWidth, cls: t.className, anyText: btns.filter((b) => b.textVisible).length, btns }
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

// 拖拽：delta>0 = 分隔条向右移 = 面板变窄；delta<0 = 面板变宽
const dragBy = async (page, total, label) => {
  const seg = 30
  let done = 0
  const dir = total > 0 ? 1 : -1
  while (Math.abs(done) < Math.abs(total)) {
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone — abort`); break }
    const st0 = await tabsDetail(page)
    if (!st0) { log(`${label}: panel lost — abort`); break }
    const step = Math.min(seg, Math.abs(total) - Math.abs(done)) * dir
    if (Date.now() > deadline) break
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(100)
    await page.mouse.down(); await page.waitForTimeout(150)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 })
    await page.waitForTimeout(250)
    await page.mouse.up()
    await page.waitForTimeout(250)
    done += step
    const st = await tabsDetail(page)
    log(`${label} ${done} :: avail=${st.avail} lv=${st.lv} anyText=${st.anyText}/6 ${st.btns.map((b) => (b.text ? b.text + (b.textVisible ? 'T' : '-') : '?')).join(' ')}`)
  }
}

let browser
try {
  log('[1] 启动 Chrome')
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
    if (healthy) break
  }
  if (!healthy) throw new Error('页面多次加载失败')

  log('[3] 激活会话')
  const sess = await page.evaluate(() => {
    const k = '用better-sidebar加载DSH'
    const all = Array.from(document.querySelectorAll('*')).filter((el) => { const t = (el.textContent || '').trim(); return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40 })
    const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
    if (!leaf) return null
    const r = leaf.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!sess) throw new Error('未找到会话')
  await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(2500)

  log('[4] 点「可接」')
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (!seg) throw new Error('未找到「可接」')
  await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500)

  log('=== 入口 1：初始态 ===')
  const init = await tabsDetail(page)
  log('  INITIAL: ' + JSON.stringify(init))
  await page.screenshot({ path: OUT + '/d2-init.png' })
  const dv = await locateDivider(page)
  log('  divider: ' + JSON.stringify(dv))
  if (!dv) { log('  ⚠️ 未找到分隔条，可能面板未打开或模式不对'); throw new Error('no-divider') }

  log('=== 入口 2：拖窄到 <400（触发折叠）===')
  await dragBy(page, 250, 'shrink')
  const narrow = await tabsDetail(page)
  log('  最窄: ' + JSON.stringify(narrow))
  await page.screenshot({ path: OUT + '/d2-narrow.png' })

  log('=== 入口 3：拖宽回归（重点看文字是否回来）===')
  await dragBy(page, -300, 'expand')
  const wide = await tabsDetail(page)
  log('  最宽: ' + JSON.stringify(wide))
  await page.screenshot({ path: OUT + '/d2-wide-regress.png' })

  const n0 = narrow ? narrow.anyText : -1
  const w0 = wide ? wide.anyText : -1
  log(n0 > 0 && w0 === 0
    ? '❌ 确认 BUG：窄→宽后文字没恢复（初始文字' + n0 + ' → 宽向' + w0 + '）'
    : w0 === 0
      ? '❌ 确认 BUG（宽向全折叠）：anyText=' + w0
      : '本次未复现「宽向文字消失」——初始=' + (init ? init.anyText : '?') + ' 窄=' + n0 + ' 宽回=' + w0)
  log('POC-PHASE2-DIAG2-DONE')
} catch (e) {
  console.error('POC-PHASE2-DIAG2-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser && !KEEP) { try { await browser.close() } catch (e) {} }
}
if (KEEP) { console.log('窗口保留（KEEP=1），观察完请手动关闭'); await new Promise(() => {}) }
