/**
 * @dsh-external/dsh-plugin-ui-debug — DSH 插件 UI 调试器（Host 工具）。
 *
 * 给 AI 与插件开发者一双"眼睛和手"：
 *  - ui_shot    截图任意 http(s) 页面（含运行中的 DSH GUI），PNG 落盘。
 *  - ui_drive   用一组动作脚本驱动页面（导航/点击/输入/按键/滚动/拖拽），
 *               支持分步截图与 JS 求值——正好覆盖"拖拽缩放观察中间态"这类
 *               UI 调试场景。截图交给 view_image（dsh-vision）即可形成
 *               改代码 → 看图 → 验收 的闭环。
 *
 * 零依赖设计：CDP 逻辑（src/cdp.ts）直接用 Node 22 全局 WebSocket 连接
 * 系统 Chrome/Edge，无需 playwright / puppeteer。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { CdpSession, findChrome } from './cdp.js'

export const name = '@dsh-external/dsh-plugin-ui-debug'
export const inject = ['tools', 'skills']

/** 随包携带的 UI 调试 skill 正文（打包后位于 lib/skill/dsh-plugin-ui-debug.md）。 */
const SKILL_DESC =
  '[DSH 插件开发] 用真实 Chrome (Playwright) 对 DSH 插件 UI 做闭环调试：UI查看→UI测试→UI验证→问题解决。' +
  '当你在调试/验证 DSH 插件的界面（面板、dock、tabs、弹窗、布局、交互）时使用。'
const skillContent = (): string => {
  const url = new URL('./skill/dsh-plugin-ui-debug.md', import.meta.url)
  try { return readFileSync(fileURLToPath(url), 'utf8') } catch (e) {
    return `# dsh-plugin-ui-debug\n\n（skill 资源文件缺失: ${url.href}）`
  }
}

/** 文本型输出契约（工具返回字符串，直接渲染给模型）。 */
const TEXT_OUT = {
  schema: { type: 'string' } as const,
  render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
} satisfies { schema: { type: 'string' }; render: (args: never, value: string) => { type: 'text'; text: string }[] }

/** 默认截图/工作目录。 */
function defaultOutDir(): string {
  return join(homedir(), '.dsh', 'super-injector', 'dsh-ui-inspect', 'shots')
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

/** 生成带时间戳的文件名。 */
function stamp(prefix: string, ext: string): string {
  const d = new Date()
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  const ts = `${p(d.getFullYear(), 4)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`
  return `${prefix}-${ts}.${ext}`
}

/** 校验 URL 为 http/https。 */
function assertHttpUrl(url: unknown): string {
  const s = typeof url === 'string' ? url.trim() : ''
  if (!/^https?:\/\//i.test(s)) throw new Error(`无效 URL（仅 http/https）: ${JSON.stringify(url)}`)
  return s
}

function asInt(value: unknown, name: string, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    if (value === undefined) return fallback
    throw new Error(`${name} 必须是正整数，收到: ${JSON.stringify(value)}`)
  }
  return Math.round(n)
}

/** ui_drive 的动作校验与执行。 */
interface DriveAction {
  type: string
  [key: string]: unknown
}

async function runDrive(session: CdpSession, actions: DriveAction[], outDir: string): Promise<string> {
  const lines: string[] = []
  const shots: string[] = []
  const evalResults: string[] = []
  let index = 0

  const coordOf = async (a: Record<string, unknown>, key: string): Promise<{ x: number; y: number } | undefined> => {
    const sel = typeof a[`${key}Selector`] === 'string' ? (a[`${key}Selector`] as string) : undefined
    if (sel) return session.elementCenter(sel)
    const x = a[`${key}X`]
    const y = a[`${key}Y`]
    if (typeof x === 'number' && typeof y === 'number') return { x, y }
    return undefined
  }

  for (const a of actions) {
    index += 1
    const type = typeof a?.type === 'string' ? a.type : ''
    try {
      switch (type) {
        case 'navigate': {
          const url = assertHttpUrl(a.url)
          await session.navigate(url)
          lines.push(`[${index}] navigate → ${url} ok`)
          break
        }
        case 'wait': {
          await session.waitMs(typeof a.ms === 'number' ? a.ms : 500)
          lines.push(`[${index}] wait ${typeof a.ms === 'number' ? a.ms : 500}ms`)
          break
        }
        case 'waitReady': {
          await session.waitReady(15000)
          lines.push(`[${index}] waitReady ok`)
          break
        }
        case 'shot': {
          const name = typeof a.name === 'string' && a.name.trim() !== '' ? a.name.trim() : stamp('shot', 'png')
          const fp = join(outDir, name.endsWith('.png') ? name : `${name}.png`)
          const bytes = await session.screenshot(fp, a.fullPage === true)
          shots.push(fp)
          lines.push(`[${index}] shot ${name} (${bytes} bytes)`)
          break
        }
        case 'eval': {
          const expr = typeof a.expression === 'string' ? a.expression : ''
          if (!expr) throw new Error('eval 需要 expression')
          const out = await session.evaluate(expr)
          if (!out.ok) {
            lines.push(`[${index}] eval ✗ ${out.exception ?? 'error'}`)
            break
          }
          const label = typeof a.label === 'string' && a.label !== '' ? a.label : `eval#${index}`
          let v = 'undefined'
          try { v = JSON.stringify(out.value) } catch { v = String(out.value) }
          evalResults.push(`${label}: ${v}`)
          lines.push(`[${index}] eval ${label} = ${v.slice(0, 200)}`)
          break
        }
        case 'click': {
          const sel = typeof a.selector === 'string' ? (a.selector as string) : undefined
          if (sel) {
            const hit = await session.clickSelector(sel)
            lines.push(`[${index}] click ${sel} ${hit ? 'ok' : '✗ 未找到元素'}`)
          } else {
            const c = await coordOf(a, '')
            if (!c) throw new Error('click 需要 selector 或 x/y 坐标')
            await session.clickAt(Math.round(c.x), Math.round(c.y))
            lines.push(`[${index}] click (${Math.round(c.x)}, ${Math.round(c.y)})`)
          }
          break
        }
        case 'press': {
          const key = typeof a.key === 'string' ? a.key : ''
          if (!key) throw new Error('press 需要 key')
          await session.keyPress(key)
          lines.push(`[${index}] press ${key}`)
          break
        }
        case 'type': {
          const sel = typeof a.selector === 'string' ? (a.selector as string) : undefined
          const text = typeof a.text === 'string' ? a.text : ''
          if (!sel || text === '') throw new Error('type 需要 selector 和 text')
          const inserted = await session.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; if (${a.replace === true}) el.value = ''; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set; if (setter && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) setter.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`)
          lines.push(`[${index}] type ${sel} ${inserted.ok && inserted.value === true ? 'ok' : '✗ 未找到元素'}`)
          break
        }
        case 'scroll': {
          const to = a.to
          await session.scroll(
            to === 'top' || to === 'bottom'
              ? { to }
              : {
                  x: typeof a.x === 'number' ? a.x : 0,
                  y: typeof a.y === 'number' ? a.y : 0,
                },
          )
          lines.push(`[${index}] scroll ${to === 'top' || to === 'bottom' ? String(to) : `${String(a.x ?? 0)},${String(a.y ?? 0)}`}`)
          break
        }
        case 'drag': {
          const from = await coordOf(a, 'from')
          const to = await coordOf(a, 'to')
          if (!from || !to) throw new Error('drag 需要 from(selector 或 fromX/fromY) 与 to(toX/toY)')
          const steps = asInt(a.steps, 'steps', 5)
          const settleMs = asInt(a.settleMs, 'settleMs', 80)
          const shotsN = typeof a.shots === 'number' ? Math.max(0, Math.round(a.shots)) : 0
          let taken = 0
          await session.drag(from, to, steps, settleMs, async (step, x, y) => {
            if (shotsN > 0 && step <= shotsN) {
              const name = typeof a.name === 'string' && a.name !== '' ? `${a.name}-step${step}` : `drag-${index}-step${step}`
              const fp = join(outDir, `${name}.png`)
              const bytes = await session.screenshot(fp)
              shots.push(fp)
              taken += 1
              lines.push(`[${index}] drag step ${step}/${steps} @(${x},${y}) → shot ${name} (${bytes}B)`)
            }
          })
          lines.push(`[${index}] drag ${JSON.stringify(from)} → ${JSON.stringify(to)} (${steps} steps, ${taken} shots)`)
          break
        }
        default:
          lines.push(`[${index}] ✗ 未知动作 ${JSON.stringify(type)}`)
      }
    } catch (e) {
      lines.push(`[${index}] ✗ ${type} 失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const title = await session.evaluate('document.title')
  const url = await session.evaluate('location.href')

  const report = [
    '== ui_drive 报告 ==',
    `页面: ${url.ok ? String(url.value) : '?'} | 标题: ${title.ok ? String(title.value) : '?'}`,
    ...lines,
  ]
  if (evalResults.length > 0) {
    report.push('-- JS 求值结果 --', ...evalResults)
  }
  if (shots.length > 0) {
    report.push('-- 截图文件（可用 view_image 查看）--', ...shots)
  }
  return report.join('\n')
}

export function apply(ctx: Context): void {
  const chromeNote = findChrome() ? '' : '（未找到 Chrome/Edge，请先安装或设置 CHROME_PATH）'

  // 随包注册 UI 调试 skill（DSH 原生 runtime skill 注册：装插件即自动可用，零文件写入/零本机路径硬编码）
  const skills = (ctx as unknown as { skills?: { register(s: unknown): () => void } }).skills
  if (skills) {
    ctx.effect(() => skills.register({
      name: 'dsh-plugin-ui-debug',
      description: SKILL_DESC,
      content: skillContent(),
      invocation: { modelInvocable: true, userInvocable: true },
      provider: '@dsh-external/dsh-plugin-ui-debug',
      source: 'dsh-plugin-ui-debug',
      path: 'src/skill/dsh-plugin-ui-debug.md',
    }), 'dsh-plugin-ui-debug:skill')
  }

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'ui_shot',
    description:
      `截图一个 http/https 页面（默认是运行中的 DSH GUI 自身地址），把 PNG 存到磁盘并返回文件路径。` +
      `用于 AI 查看 UI 效果、定位布局/样式故障、验收成果——拿到路径后再用 view_image 工具看图。` +
      chromeNote,
    parameters: {
      url: { type: 'string', required: true, description: '要截图的页面 URL，如 http://127.0.0.1:59519/ 或任意 http(s) 地址' },
      out: { type: 'string', description: '输出 PNG 文件路径（绝对路径）。缺省自动生成到 ~/.dsh/super-injector/dsh-ui-inspect/shots/' },
      width: { type: 'integer', description: '视口宽度，默认 1440' },
      height: { type: 'integer', description: '视口高度，默认 900' },
      waitMs: { type: 'integer', description: '加载完成后额外等待（渲染稳定）毫秒，默认 3500' },
      fullPage: { type: 'boolean', description: '是否整页截图（captureBeyondViewport），默认 false' },
    },
    output: TEXT_OUT,
    timeoutMs: 120_000,
    isConcurrencySafe: () => false,
    execute: async (args) => {
      const url = assertHttpUrl(args.url)
      const dir = typeof args.out === 'string' && args.out.trim() !== ''
        ? ensureDirForFile(args.out)
        : defaultOutDir()
      const width = asInt(args.width, 'width', 1440)
      const height = asInt(args.height, 'height', 900)
      const session = await CdpSession.open('about:blank', { width, height })
      try {
        await session.navigate(url)
        await session.waitMs(typeof args.waitMs === 'number' ? args.waitMs : 3500)
        const fp = typeof args.out === 'string' && args.out.trim() !== '' ? args.out : join(dir, stamp('shot', 'png'))
        const bytes = await session.screenshot(fp, args.fullPage === true)
        const title = await session.evaluate('document.title')
        return `✔ 截图完成\n路径: ${resolve(fp)}\n大小: ${bytes} 字节\n标题: ${title.ok ? String(title.value) : '?'}\n\n用 view_image 查看该路径即可让 AI 看到页面效果。`
      } finally {
        await session.close()
      }
    },
  })), 'dsh-ui-inspect:tools/ui_shot')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'ui_drive',
    description:
      `在一个无头浏览器会话里按动作脚本驱动页面（导航/点击/输入/按键/滚动/拖拽 + 分步截图 + JS 求值），` +
      `用于 UI 调试：例如对可拖拽缩放的控件做"边拖边分步截图"观察中间态样式，或读取元素几何/样式做断言。` +
      `截图文件路径会列在返回报告里，随后用 view_image 逐张查看。` +
      chromeNote,
    parameters: {
      url: { type: 'string', required: true, description: '初始页面 URL，如 http://127.0.0.1:59519/' },
      actions: {
        type: 'string', required: true,
        description:
          'JSON 数组字符串。支持的动作（type）与字段：\n' +
          '- {"type":"navigate","url":"…"}\n' +
          '- {"type":"wait","ms":500}\n' +
          '- {"type":"waitReady"}\n' +
          '- {"type":"shot","name":"s1","fullPage":false}\n' +
          '- {"type":"eval","expression":"document.title","label":"title"}\n' +
          '- {"type":"click","selector":".cls"} 或 {"type":"click","x":100,"y":200}\n' +
          '- {"type":"press","key":"Enter"}（Enter/Tab/Escape/Backspace/ArrowUp|Down|Left|Right）\n' +
          '- {"type":"type","selector":"input","text":"hi","replace":true}\n' +
          '- {"type":"scroll","y":300} 或 {"to":"top"|"bottom"}\n' +
          '- {"type":"drag","fromSelector":"#handle","fromX":…,"fromY":…,"toX":300,"toY":200,"steps":5,"settleMs":80,"shots":3,"name":"drag"}\n' +
          '  drag 的 from/to 各可用 *Selector 或 X/Y 坐标指定；shots=N 表示对前 N 个中间点各截一张图。',
      },
      outDir: { type: 'string', description: '截图输出目录，默认 ~/.dsh/super-injector/dsh-ui-inspect/shots' },
      width: { type: 'integer', description: '视口宽度，默认 1440' },
      height: { type: 'integer', description: '视口高度，默认 900' },
    },
    output: TEXT_OUT,
    timeoutMs: 120_000,
    isConcurrencySafe: () => false,
    execute: async (args) => {
      const url = assertHttpUrl(args.url)
      const raw = typeof args.actions === 'string' ? args.actions.trim() : ''
      if (raw === '') throw new Error('actions 为空')
      let actions: DriveAction[]
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) throw new Error('不是数组')
        actions = parsed as DriveAction[]
      } catch (e) {
        throw new Error(`actions 不是合法 JSON 数组: ${e instanceof Error ? e.message : String(e)}`)
      }
      const outDir = typeof args.outDir === 'string' && args.outDir.trim() !== '' ? args.outDir : defaultOutDir()
      ensureDir(outDir)
      const width = asInt(args.width, 'width', 1440)
      const height = asInt(args.height, 'height', 900)
      const session = await CdpSession.open(url, { width, height })
      try {
        return await runDrive(session, actions, outDir)
      } finally {
        await session.close()
      }
    },
  })), 'dsh-ui-inspect:tools/ui_drive')
}

/** 提取 out 路径所在目录并确保存在，返回该目录。 */
function ensureDirForFile(out: string): string {
  const idx = Math.max(out.lastIndexOf('/'), out.lastIndexOf('\\'))
  const dir = idx > 0 ? out.slice(0, idx) : defaultOutDir()
  ensureDir(dir)
  return dir
}
