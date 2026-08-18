// poc-phase2-l2.mjs — 复现用户描述的 L2 全折叠死锁：
// 拖到极窄 → 6 按钮全变图标 → 大回来 → 文字是否恢复？
// 用 avail 驱动分档，覆盖 L0 / L1 / L2，全程采样 + 特写截图。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })
const HARD_MS = 200000
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
    return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), w: Math.round(br.width), textVisible: labels.length > 0 }
  })
  return { avail: Math.round(tr.width), lv, cls: t.className, anyText: btns.filter((b) => b.textVisible).length, btns }
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

const dragTo = async (page, target, label) => {
  // 持续性拖动直到 avail <= target（窄）或无法再动
  const seg = 30
  let guard = 0
  while (guard++ < 40) {
    const st = await tabsDetail(page)
    if (!st) { log(`${label}: panel lost`); return }
    if (st.avail <= target) { log(`${label}: reached avail=${st.avail}`); return }
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone`); return }
    const step = Math.min(seg, st.avail - target)
    if (Date.now() > deadline) return
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(80)
    await page.mouse.down(); await page.waitForTimeout(120)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await page.waitForTimeout(220)
    await page.mouse.up(); await page.waitForTimeout(220)
    log(`  ${label} → avail≈${(await tabsDetail(page)).avail} lv=${(await tabsDetail(page)).lv} anyText=${(await tabsDetail(page)).anyText}/6`)
  }
}
const dragBack = async (page, target, label) => {
  const seg = 30
  let guard = 0
  while (guard++ < 60) {
    const st = await tabsDetail(page)
    if (!st) { log(`${label}: panel lost`); return }
    if (st.avail >= target) { log(`${label}: reached avail=${st.avail}`); return }
    const cur = await locateDivider(page)
    if (!cur) { log(`${label}: divider gone`); return }
    const step = Math.min(seg, target - st.avail)
    if (Date.now() > deadline) return
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(80)
    await page.mouse.down(); await page.waitForTimeout(120)
    await page.mouse.move(cur.x - step, cur.y, { steps: 3 }); await page.waitForTimeout(220)
    await page.mouse.up(); await page.waitForTimeout(220)
    log(`  ${label} → avail≈${(await tabsDetail(page)).avail} lv=${(await tabsDetail(page)).lv} anyText=${(await tabsDetail(page)).anyText}/6`)
  }
}

const forensics = async (page, tag) => {
  const st = await tabsDetail(page)
  log(`--- ${tag} --- avail=${st.avail} lv=${st.lv} anyText=${st.anyText}/6 btns=[${st.btns.map((b) => b.text + (b.textVisible ? 'T' : '-')).join(' ')}]`)
  try {
    const loc = page.locator('.dsws-tabs').last()
    const box = await loc.boundingBox()
    if (box) { await loc.screenshot({ path: `${OUT}/${tag}-tabs.png` }); log(`  特写: ${OUT}/${tag}-tabs.png (${Math.round(box.width)}x${Math.round(box.height)})`) }
  } catch (e) { log('  特写失败: ' + e.message) }
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

  await forensics(page, 'l2-0-init')
  log('=== 拖窄到极窄（触发 L2 全折叠）===')
  await dragTo(page, 250, 'to-narrow')
  await forensics(page, 'l2-1-narrow')
  log('=== 拖回最宽（重点：文字是否恢复）===')
  await dragBack(page, 700, 'back-wide')
  await forensics(page, 'l2-2-back')
  log('L2-PHASE-DONE')
} catch (e) {
  console.error('L2-PHASE-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
