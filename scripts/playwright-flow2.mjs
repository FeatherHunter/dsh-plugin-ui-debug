// playwright-flow2.mjs — 抗失败页重试 + 会话包含匹配 + 点可接 + 拖拽双程
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/pwflow2'
mkdirSync(OUT, { recursive: true })

const tabsState = async (page) => page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 100 && r.x > 800 })
  const t = list[list.length - 1]; if (!t) return null
  const tr = t.getBoundingClientRect()
  let lv = 0; if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1
  const btns = Array.from(t.querySelectorAll('button')).map((b) => { const br = b.getBoundingClientRect(); const lab = b.querySelector('span:not(.dsws-rficon):not(svg)'); return { t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6), h: Math.round(br.height), label: !!(lab && lab.offsetWidth > 0) } })
  return { avail: Math.round(tr.width), need: t.scrollWidth, rowH: Math.round(tr.height), lv, ovf: tr.width < t.scrollWidth, btns: btns.map((b) => b.t + ':' + (b.label ? 'L' : 'i') + '@' + b.h).join(' ') }
})
const short = (m) => m ? `avail=${m.avail} need=${m.need} rowH=${m.rowH} lv=${m.lv} ovf=${m.ovf} btns=[${m.btns}]` : '(no panel)'

const pageHealthy = async (page) => page.evaluate(() => {
  const body = (document.body ? document.body.innerText : '')
  if (body.indexOf('Failed to load plugins') >= 0) return { ok: false, why: 'plugin-load-failed' }
  if (document.querySelectorAll('.dsws-seg').length === 0) return { ok: false, why: 'no-statusbar' }
  return { ok: true }
})

const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1707, height: 912 } })
  // 抗失败页：最多 6 次加载/刷新
  let healthy = null
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
    else await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(6000)
    healthy = await pageHealthy(page)
    console.log(`attempt#${attempt} ::`, JSON.stringify(healthy))
    if (healthy && healthy.ok) break
  }
  if (!healthy || !healthy.ok) { console.log('!! 页面多次加载失败（DSH 插件装配竞态）'); await browser.close(); process.exit(1) }
  await page.waitForTimeout(2000)
  console.log('initial ::', short(await tabsState(page)))

  // 1) 点左侧有内容的会话（包含匹配，最小叶子）
  const sess = await page.evaluate(() => {
    const keys = ['用better-sidebar加载DSH', '修复GitHub issue并规划']
    for (const k of keys) {
      const all = Array.from(document.querySelectorAll('*')).filter((el) => {
        const t = (el.textContent || '').trim()
        return t.indexOf(k) === 0 && el.children.length <= 3 && el.getBoundingClientRect().width > 40
      })
      const leaf = all.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]
      if (leaf) { const r = leaf.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (leaf.textContent || '').slice(0, 20), tag: leaf.tagName } }
    }
    return null
  })
  console.log('session-target ::', JSON.stringify(sess))
  if (sess) { await page.mouse.click(sess.x, sess.y); await page.waitForTimeout(3000) }
  console.log('after session ::', short(await tabsState(page)))

  // 2) 点「可接」
  const seg = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  console.log('seg ::', JSON.stringify(seg))
  if (seg) { await page.mouse.click(seg.x, seg.y); await page.waitForTimeout(2500) }
  console.log('after 可接 ::', short(await tabsState(page)))

  // 3) 分隔条命中点
  const hit = await page.evaluate(() => {
    const h = document.querySelector('.nArs4W_panelResize'); if (!h) return null
    const r = h.getBoundingClientRect()
    for (let y = Math.ceil(r.top) + 10; y < Math.floor(r.bottom) - 10; y += 10) {
      for (let x = Math.ceil(r.left) + 2; x <= Math.floor(r.right) - 2; x += 2) {
        const el = document.elementFromPoint(x, y)
        if (el && String(el.className || '').indexOf('panelResize') >= 0) return { x, y }
      }
    }
    return null
  })
  console.log('divider-hit ::', JSON.stringify(hit))

  // 4) 拖拽双程
  if (hit) {
    const shot = async (tag) => { await page.screenshot({ path: OUT + '/' + tag + '.png' }); console.log('shot ' + tag) }
    await shot('s0-before')
    await page.mouse.move(hit.x, hit.y); await page.waitForTimeout(200)
    await page.mouse.down(); await page.waitForTimeout(250)
    for (const dx of [60, 120, 180, 240, 300, 360]) {
      await page.mouse.move(hit.x + dx, hit.y, { steps: 3 })
      await page.waitForTimeout(450)
      console.log(`narrow +${dx} ::`, short(await tabsState(page)))
      if ([120, 240, 360].includes(dx)) await shot(`narrow-dx${dx}`)
    }
    await page.mouse.up(); await page.waitForTimeout(600)
    console.log('released ::', short(await tabsState(page)))
    for (const dx of [-60, -120, -180, -240, -300, -360]) {
      await page.mouse.move(hit.x + 360 + dx, hit.y, { steps: 3 })
      await page.waitForTimeout(450)
      console.log(`widen ${dx} ::`, short(await tabsState(page)))
      if ([-120, -240, -360].includes(dx)) await shot(`widen-dx${dx}`)
    }
    await page.mouse.up(); await page.waitForTimeout(600)
    console.log('final ::', short(await tabsState(page)))
  } else {
    console.log('!! 无分隔条；面板状态：', short(await tabsState(page)))
  }
} finally { /* 保留窗口 */ }
console.log('PW-FLOW2-DONE')
await new Promise(() => {})
