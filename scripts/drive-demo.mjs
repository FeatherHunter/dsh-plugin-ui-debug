// drive-demo.mjs — Playwright + 系统 Chrome（有头）驱动 DSH GUI：
// 点「可接」开面板 → 扫描分隔条命中点 → 真实鼠标拖拽双程采样 + 截图
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/pw'
mkdirSync(OUT, { recursive: true })

const tabsState = async (page) => {
  return page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('.dsws-tabs')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 100 && r.x > 900 })
    const t = list[list.length - 1]; if (!t) return null
    const tr = t.getBoundingClientRect()
    let lv = 0; if (t.classList.contains('dsws-tabs-l2')) lv = 2; else if (t.classList.contains('dsws-tabs-l1')) lv = 1
    const btns = Array.from(t.querySelectorAll('button')).map((b) => { const br = b.getBoundingClientRect(); const lab = b.querySelector('span:not(.dsws-rficon):not(svg)'); return { t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6), h: Math.round(br.height), label: !!(lab && lab.offsetWidth > 0) } })
    let pw = null
    for (const el of Array.from(document.querySelectorAll('[class*=panel]'))) { const pr = el.getBoundingClientRect(); if (pr.width > 300 && pr.width < 1400 && pr.x > 900) { pw = Math.round(pr.width); break } }
    return { pw, avail: Math.round(tr.width), rowH: Math.round(tr.height), lv, btns: btns.map((b) => b.t + ':' + (b.label ? 'L' : 'i') + '@' + b.h).join(' ') }
  })
}
const short = (m) => m ? `panelW=${m.pw} avail=${m.avail} rowH=${m.rowH} lv=${m.lv} btns=[${m.btns}]` : '(no panel)'

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const main = async () => {
  const page = await browser.newPage({ viewport: { width: 1707, height: 912 } })
  await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForSelector('.dsws-seg', { timeout: 40000 })
  await page.waitForTimeout(2500)
  console.log('initial ::', short(await tabsState(page)))

  // 1) 若面板关 → 点「可接」打开（先 JS click，不行再真鼠标）
  let st = await tabsState(page)
  if (!st) {
    await page.evaluate(() => { const seg = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (seg) seg.click() })
    await page.waitForTimeout(2500)
    st = await tabsState(page)
    console.log('after js-click 可接 ::', short(st))
  }
  if (!st) {
    const box = await page.evaluate(() => { const seg = Array.from(document.querySelectorAll('.dsws-seg')).find((x) => (x.textContent || '').indexOf('可接') === 0); if (!seg) return null; const r = seg.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(2500) }
    st = await tabsState(page)
    console.log('after mouse-click 可接 ::', short(st))
  }
  if (!st) { console.log('!! 面板打不开'); return }
  // 2) 扫描分隔条真实命中点
  const scan = await page.evaluate(() => {
    const h = document.querySelector('.nArs4W_panelResize'); if (!h) return null
    const r = h.getBoundingClientRect()
    const hits = []
    for (let y = Math.ceil(r.top) + 10; y < Math.floor(r.bottom) - 10; y += 10) {
      for (let x = Math.ceil(r.left) + 2; x <= Math.floor(r.right) - 2; x += 2) {
        const el = document.elementFromPoint(x, y)
        if (el && String(el.className || '').indexOf('panelResize') >= 0) { hits.push({ x, y }); break }
      }
    }
    return hits[0] || null
  })
  console.log('hit ::', JSON.stringify(scan))
  if (!scan) { console.log('!! 分隔条不可命中'); return }

  // 3) 真实拖拽双程（playwright mouse = CDP，普通 Chrome 输入管线）
  await page.screenshot({ path: OUT + '/s0-before.png' })
  const shot = async (tag) => { await page.screenshot({ path: OUT + '/' + tag + '.png' }); console.log('shot ' + tag) }

  await page.mouse.move(scan.x, scan.y)
  await page.waitForTimeout(200)
  await page.mouse.down()
  await page.waitForTimeout(250)
  for (const dx of [60, 120, 180, 240, 300, 360]) {
    await page.mouse.move(scan.x + dx, scan.y, { steps: 3 })
    await page.waitForTimeout(450)
    console.log(`narrow +${dx} ::`, short(await tabsState(page)))
    if ([120, 240, 360].includes(dx)) await shot(`narrow-dx${dx}`)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
  console.log('released ::', short(await tabsState(page)))
  for (const dx of [-60, -120, -180, -240, -300, -360]) {
    await page.mouse.move(scan.x + 360 + dx, scan.y, { steps: 3 })
    await page.waitForTimeout(450)
    console.log(`widen ${dx} ::`, short(await tabsState(page)))
    if ([-120, -240, -360].includes(dx)) await shot(`widen-dx${dx}`)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
  console.log('final ::', short(await tabsState(page)))
}
try { await main() } finally { /* 保留窗口供观察：不关闭浏览器 */ }
console.log('PW-DEMO-DONE（窗口保持打开，观察完可用 job_kill 关闭）')
// 挂起进程，保持窗口可见
await new Promise(() => {})
