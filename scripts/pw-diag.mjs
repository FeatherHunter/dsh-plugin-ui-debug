// pw-diag.mjs — Playwright 有头 Chrome 打开 GUI 后 dump 页面内容
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/pw'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 950 } })
  await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: 40000 })
  await page.waitForTimeout(8000)
  const info = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    ready: document.readyState,
    segCount: document.querySelectorAll('.dsws-seg').length,
    capsuleCount: document.querySelectorAll('.dsws-capsule').length,
    tabsCount: document.querySelectorAll('.dsws-tabs').length,
    btnCount: document.querySelectorAll('button').length,
    bodyText: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 300),
    errs: window.__errs || null,
  }))
  console.log('PAGE ::', JSON.stringify(info, null, 1))
  await page.screenshot({ path: OUT + '/diag.png' })
  console.log('shot ' + OUT + '/diag.png')
  // 等更久再查一次
  await page.waitForTimeout(6000)
  const info2 = await page.evaluate(() => ({ segCount: document.querySelectorAll('.dsws-seg').length, capsule: document.querySelectorAll('.dsws-capsule').length, tabs: document.querySelectorAll('.dsws-tabs').length }))
  console.log('t+14s ::', JSON.stringify(info2))
} finally { await browser.close() }
console.log('PW-DIAG-DONE')
