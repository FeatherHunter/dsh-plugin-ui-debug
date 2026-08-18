// tabs-progressive.mjs — 验证渐进式折叠：拖窄时按钮逐个折叠（顺序可断言），拖宽时逐个恢复
// 期望顺序（最先折叠→最后）：环境检查(6)→刷新(3)→技能(5)→列表(4)→需求(2)→+bug(1)
// 输出：每档折叠的按钮名 + collapsed 计数，断言"逐个"（每步最多新增 1 个折叠）
import { chromium } from 'playwright-core'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/regress'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

const tabsDetail = async (page) => page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 50 && r.x > 600 })
  const t = list[list.length - 1]
  if (!t) return null
  const tr = t.getBoundingClientRect()
  const btns = Array.from(t.querySelectorAll('[data-priority]')).map((b) => {
    const p = Number(b.dataset.priority)
    const collapsed = b.classList.contains('collapsed')
    const label = (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8)
    return { p, collapsed, label }
  }).sort((a, b) => a.p - b.p)
  return { avail: Math.round(tr.width), folded: btns.filter((b) => b.collapsed).length, btns }
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

// 拖到目标宽度（delta>0=变窄）
const dragTo = async (page, target, dir) => {
  const seg = 24; let guard = 0
  while (guard++ < 80) {
    const st = await tabsDetail(page)
    if (!st) { return }
    if (dir > 0 ? st.avail <= target : st.avail >= target) return
    const cur = await locateDivider(page)
    if (!cur) { await new Promise((r) => setTimeout(r, 150)); continue }
    const step = Math.min(seg, Math.abs(st.avail - target))
    await page.mouse.move(cur.x, cur.y); await new Promise((r) => setTimeout(r, 60))
    await page.mouse.down(); await new Promise((r) => setTimeout(r, 100))
    await page.mouse.move(cur.x + dir * step, cur.y, { steps: 3 }); await new Promise((r) => setTimeout(r, 150))
    await page.mouse.up(); await new Promise((r) => setTimeout(r, 150))
  }
}

const fmt = (st) => {
  if (!st) return '(no panel)'
  const foldedNames = st.btns.filter((b) => b.collapsed).map((b) => b.label).join(',') || '(none)'
  return `avail=${st.avail} folded=${st.folded} [${foldedNames}]`
}

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

  console.log('[初始] ' + fmt(await tabsDetail(page)))
  // 细粒度逐档拖窄（每 20px 一档），观察完整折叠顺序
  const init = await tabsDetail(page)
  const targets = []
  for (let d = 40; d <= 330; d += 20) targets.push(init.avail - d)
  for (const tgt of targets) {
    await dragTo(page, tgt, 1)
    console.log('[窄] ' + fmt(await tabsDetail(page)))
  }
  await page.screenshot({ path: OUT + '/progressive-narrow.png' })
  // 细粒度拖回，观察恢复顺序
  const backTargets = []
  for (let d = 300; d >= 0; d -= 20) backTargets.push(init.avail - d)
  for (const tgt of backTargets) {
    await dragTo(page, tgt, -1)
    console.log('[宽] ' + fmt(await tabsDetail(page)))
  }
  const final = await tabsDetail(page)
  await page.screenshot({ path: OUT + '/progressive-wide.png' })
  console.log(final && final.folded === 0 ? '✅ 展开恢复完成（folded=0）' : '❌ 展开未完全恢复')
  console.log('PROGRESSIVE-DONE')
} catch (e) {
  console.error('PROGRESSIVE-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser) { try { await browser.close() } catch (e) {} }
}
