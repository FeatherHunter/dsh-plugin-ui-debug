// poc-phase2-diag.mjs — Phase 2 诊断：打开面板 → 读宽态 → 拖窄→拉回 全程采样 lv/文字显示 → 截图
// 验证用户报告的现象：面板很宽时按钮文字也不显示（全最小折叠）。
// 复用 flow3 分段拖拽 + DOM 采样；自动关窗。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const KEEP = process.env.KEEP === '1'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })
const HARD_MS = 150000
const deadline = Date.now() + HARD_MS
const remaining = () => Math.max(5000, deadline - Date.now())

const log = (...a) => console.log(...a)

// 读取 tabs 行的详细状态：lv + 每个按钮的文字是否显示
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
    // 文字 span（排除图标/装饰)
    const labels = Array.from(b.querySelectorAll('span')).filter((s) => {
      if (s.classList.contains('dsws-rficon')) return false
      const st = getComputedStyle(s)
      return st.position !== 'absolute' || s.offsetParent !== null
    })
    const textVisible = labels.some((s) => s.offsetWidth > 0)
    return {
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8),
      w: Math.round(br.width), h: Math.round(br.height),
      textVisible,
    }
  })
  return {
    avail: Math.round(tr.width), need: t.scrollWidth, rowH: Math.round(tr.height), lv,
    ovf: tr.width < t.scrollWidth,
    cls: t.className,
    btns,
    anyText: btns.filter((b) => b.textVisible).length,
  }
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
    log(`${label} ${done} :: avail=${st.avail} lv=${st.lv} rowH=${st.rowH} anyText=${st.anyText}/6 btns=[${st.btns.map((b) => (b.text ? b.text + (b.textVisible ? 'T' : '-') : '?')).join(' ')}]`)
  }
}

let browser
try {
  log('[1] 启动真实 Chrome')
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

  log('[3] 激活会话「用better-sidebar加载DSH」')
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

  log('[4] 点「可接」打开面板')
  const seg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0)
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500) } else { throw new Error('未找到「可接」') }

  log('[5] 初始（宽）态：')
  const init = await tabsDetail(page)
  log('  ' + JSON.stringify(init))
  const dv = await locateDivider(page)
  log('  divider: ' + JSON.stringify(dv))
  if (!dv) throw new Error('无分隔条')
  await page.screenshot({ path: OUT + '/phase2-init-wide.png' })

  log('[6] 拖窄 250px（分段采样）')
  await dragBy(page, -250, 'narrow')
  const narrow = await tabsDetail(page)
  log('  最窄: ' + JSON.stringify(narrow))
  await page.screenshot({ path: OUT + '/phase2-narrow.png' })

  log('[7] 拉回 +300px（重点：看文字是否恢复显示）')
  await dragBy(page, 300, 'widen')
  const wide = await tabsDetail(page)
  log('  拉回后: ' + JSON.stringify(wide))
  await page.screenshot({ path: OUT + '/phase2-widen-back.png' })

  const anyTextNow = wide && wide.anyText
  log(anyTextNow > 0
    ? '✅ 拉宽后文字恢复显示'
    : '❌ 确认 BUG：拉宽后 still 全折叠（anyText=' + anyTextNow + '），与用户报告一致')

  log('POC-PHASE2-DONE')
} catch (e) {
  console.error('POC-PHASE2-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser && !KEEP) { try { await browser.close() } catch (e) {} }
}
if (KEEP) { console.log('窗口保留（KEEP=1），观察完请手动关闭'); await new Promise(() => {}) }
