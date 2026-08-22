// t4-check-frames.mjs — 逐帧 sanity：尺寸 + 像素统计（均值/方差），检测黑屏/空白/异常
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const dir = 'D:/dsh-plugin/dsh-plugin-ui-debug/_shots/t4'
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
for (const f of files) {
  const p = join(dir, f)
  try {
    const img = sharp(p)
    const meta = await img.metadata()
    const { channels } = await img.stats()
    const mean = channels.slice(0, 3).map((c) => c.mean.toFixed(0)).join('/')
    const stdev = channels.slice(0, 3).map((c) => c.stdev.toFixed(0)).join('/')
    const { size } = await import('node:fs').then((m) => m.statSync(p))
    const flag = channels.slice(0, 3).every((c) => c.stdev < 1.5) ? ' <-- BLANK?' : ''
    console.log(`${f.padEnd(24)} ${meta.width}x${meta.height} ${String(size).padStart(7)}B mean[${mean}] stdev[${stdev}]${flag}`)
  } catch (e) {
    console.log(f, 'ERR', e.message)
  }
}