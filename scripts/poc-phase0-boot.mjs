// poc-phase0-boot.mjs — Phase 0：起真实 Chrome → 打开 DSH → 健康检查 → 截图
// 目的：验证"AI 能否用 Playwright 驱动真实浏览器看到 DSH"这条最底层路径。
// 安全：跑完自动关窗（除非 KEEP=1）；带整体超时防挂起。
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const DSH = 'http://127.0.0.1:59519'
const KEEP = process.env.KEEP === '1'
const OUT = 'D:/dsh-plugin/dsh-mattpocock-skills-deck/.tmp-screenshots/poc'
mkdirSync(OUT, { recursive: true })

const HARD_TIMEOUT_MS = 90000
const deadline = Date.now() + HARD_TIMEOUT_MS
const remaining = () => Math.max(5000, deadline - Date.now())

let browser
try {
  console.log('[1] 启动真实 Chrome（有头、最大化）…')
  browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--start-maximized'],
    timeout: remaining(),
  })
  // 注入 openIn:'sidebar'（绕开 deck 的 openIn 初始化竞态）
  const context = await browser.newContext({ viewport: null })
  await context.addInitScript(() => {
    try { localStorage.setItem('dsws.cfg', JSON.stringify({ withWayfinder: true, openIn: 'sidebar' })) } catch (e) {}
  })
  const page = await context.newPage()

  console.log('[2] 导航到 DSH → 健康检查（最多 6 次 reload，防插件装配竞态）')
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    if (attempt === 1) await page.goto(DSH, { waitUntil: 'domcontentloaded', timeout: remaining() })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining() })
    await page.waitForTimeout(4000)
    healthy = await page.evaluate(() => {
      if (document.body && document.body.innerText.indexOf('Failed to load plugins') >= 0) return false
      return document.querySelectorAll('.dsws-seg').length > 0
    })
    console.log(`  attempt#${attempt} → ok=${healthy}  segs=${await page.evaluate(() => document.querySelectorAll('.dsws-seg').length)}`)
    if (healthy) break
    if (Date.now() > deadline) break
  }
  console.log(`[3] 健康检查结果：${healthy ? '✅ 页面正常' : '❌ 多次加载失败'}`)

  const title = await page.evaluate('document.title').catch(() => ({ ok: false }))
  console.log(`[4] 页面标题：${title && title.value ? title.value : '(获取失败)'}`)

  const fp = OUT + '/phase0-boot.png'
  await page.screenshot({ path: fp })
  console.log(`[5] 截图已保存：${fp}`)

  console.log('POC-PHASE0-DONE')
} catch (e) {
  console.error('POC-PHASE0-FAIL: ' + (e && e.message ? e.message : String(e)))
  process.exitCode = 1
} finally {
  if (browser && !KEEP) { try { await browser.close() } catch (e) {} }
}
if (KEEP) { console.log('窗口保留（KEEP=1），观察完请手动关闭'); await new Promise(() => {}) }
