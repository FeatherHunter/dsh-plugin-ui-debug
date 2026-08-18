// poc-forensics.mjs — 证据留存：对「折叠后拖宽」卡住态，做按钮行特写截图 + DOM 细查
// 交给人工定夺：DOM 说 textVisible=false，视觉疑似有文字，冲突。
// 分三挡：① 初始宽态 ② L1 折叠态 ③ 拖回后卡住态。每档：按钮行特写截图 + 按钮 DOM 结构 + computed style。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
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
    // 按钮内部所有 span 的详细信息
    const spans = Array.from(b.querySelectorAll('span')).map((s) => {
      const cs = getComputedStyle(s)
      return {
        cls: s.className || '(none)',
        text: (s.textContent || '').trim().slice(0, 10),
        offsetW: Math.round(s.offsetWidth),
        offsetH: Math.round(s.offsetHeight),
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        position: cs.position,
        w: cs.width,
        overflow: cs.overflow,
        whiteSpace: cs.whiteSpace,
      }
    })
    return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), w: Math.round(br.width), spans }
  })
  return { avail: Math.round(tr.width), lv, anyText: btns.map((b) => b.spans.some((s) => s.offsetW > 0 && s.offsetH > 0)).filter(Boolean).length, btns }
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
  const seg = 30; let done = 0; const dir = total > 0 ? 1 : -1
  while (Math.abs(done) < Math.abs(total)) {
    const cur = await locateDivider(page)
    if (!cur || !(await tabsDetail(page))) { log(`${label}: panel lost`); break }
    const step = Math.min(seg, Math.abs(total) - Math.abs(done)) * dir
    if (Date.now() > deadline) break
    await page.mouse.move(cur.x, cur.y); await page.waitForTimeout(100)
    await page.mouse.down(); await page.waitForTimeout(150)
    await page.mouse.move(cur.x + step, cur.y, { steps: 3 }); await page.waitForTimeout(250)
    await page.mouse.up(); await page.waitForTimeout(250)
    done += step
  }
  log(`${label}: done ${done}`)
}

const forensics = async (page, tag) => {
  const st = await tabsDetail(page)
  log(`--- ${tag} --- avail=${st.avail} lv=${st.lv} anyText=${st.anyText}/6`)
  for (const b of st.btns) {
    log(`  btn "${b.text}" w=${b.w}`)
    for (const s of b.spans) {
      log(`    span[${s.cls || 'no-class'}] "${s.text}" offsetW=${s.offsetW} offsetH=${s.offsetH} display=${s.display} visibility=${s.visibility} opacity=${s.opacity} pos=${s.position} w=${s.w} overflow=${s.overflow} ws=${s.whiteSpace}`)
    }
  }
  // 按钮行特写截图（tabs 容器）
  try {
    const loc = page.locator('.dsws-tabs').last()
    const box = await loc.boundingBox()
    if (box) { await loc.screenshot({ path: `${OUT}/${tag}-tabs.png` }); log(`  tabs 特写: ${OUT}/${tag}-tabs.png (${Math.round(box.width)}x${Math.round(box.height)})`) }
  } catch (e) { log('  tabs 特写失败: ' + e.message) }
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

  await forensics(page, 'f1-init')
  await dragBy(page, 250, 'shrink')
  await forensics(page, 'f2-narrow')
  await dragBy(page, -300, 'expand')
  await forensics(page, 'f3-widen')
  log('FORENSICS-DONE')
} catch (e) {
  console.error('FORENSICS-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
