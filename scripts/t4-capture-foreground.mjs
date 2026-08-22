// t4-capture-foreground.mjs — P1-B: foreground:true 前台围观状态截图（三轨模型 B 轨）
// 与 ui_shot（A 轨 foreground:false）同视口 1280×720 DPR=1 → 供 P1 对比拼图
import { CdpSession } from '../lib/cdp.js'

const out = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/t4/p1_foreground_true.png'
try {
  const session = await CdpSession.open('http://127.0.0.1:3080/', {
    width: 1280, height: 720, headless: false, maximized: true, foreground: true,
    chromePath: process.env.CHROME_PATH || undefined
  })
  // 健康等待
  let healthy = false
  for (let attempt = 1; attempt <= 6; attempt++) {
    await session.waitMs(4000)
    const res = await session.evaluate('document.querySelectorAll(".dsws-seg").length')
    if (res.ok && res.value > 0) { healthy = true; break }
  }
  if (!healthy) throw new Error('gui not healthy')
  await session.waitMs(1000)
  const bytes = await session.screenshot(out, false)
  console.log('P1-B saved', bytes, 'bytes →', out)
  await session.close()
} catch (e) {
  console.error('P1-B FAIL:', e)
  process.exitCode = 1
}