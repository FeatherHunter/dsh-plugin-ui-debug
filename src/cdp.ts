/**
 * cdp.ts — dependency-free Chrome DevTools Protocol client.
 *
 * Launches a headless Chrome/Edge with a remote-debugging port, then drives it
 * through CDP over WebSocket (Node 22 provides the global WebSocket). Zero npm
 * dependencies — this is what lets `ui_shot` / `ui_drive` work out of the box.
 *
 * Safety: the child process is always killed in dispose(); pending commands are
 * rejected when the connection dies so a tool call never hangs forever.
 *
 * 第一性原理矫正（fix 小窗口偶现）：
 *  - `--window-size` ≠ `viewport`（`window.innerWidth`），无头下还会被默认 800×600 覆盖；
 *  - 唯一可靠视口是 `Emulation.setDeviceMetricsOverride {width,height,deviceScaleFactor:1}`；
 *  - 有头最大化需 `Browser.setWindowBounds {windowState:'maximized'}` + `--start-maximized`，等价 SKILL 的 `viewport:null`；
 *  - 锁 `deviceScaleFactor=1` + `--force-device-scale-factor=1` 消除 Windows 缩放抖动。
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

/** Minimal structural view of the global WebSocket (Node 22 undici). */
interface WsLike {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onerror: ((e: unknown) => void) | null
  onmessage: ((e: { data: string }) => void) | null
  onclose: (() => void) | null
}

function wsCtor(): new (url: string) => WsLike {
  const ctor = (globalThis as Record<string, unknown>).WebSocket
  if (typeof ctor !== 'function') {
    throw new Error('全局 WebSocket 不可用（需要 Node 22+）')
  }
  return ctor as new (url: string) => WsLike
}

/** Resolve a usable browser binary; prefer Chrome over Edge. */
export function findChrome(): string | undefined {
  const candidates: string[] = []
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH)
  const pf = process.env.PROGRAMFILES ?? ''
  const pf86 = process.env['PROGRAMFILES(X86)'] ?? ''
  const la = process.env.LOCALAPPDATA ?? ''
  // Chrome
  candidates.push(join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  candidates.push(join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  candidates.push(join(la, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  // Edge
  candidates.push(join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  candidates.push(join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  candidates.push(join(la, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  for (const c of candidates) {
    if (c && existsSync(c)) return c
  }
  return undefined
}

/** Grab a free TCP port for the debugging endpoint. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface LaunchOptions {
  width?: number
  height?: number
  chromePath?: string
  userDataDir?: string
  /** 默认 true：保持无头以兼容 CI；设 false 切有头物理最大化（SKILL 正解）。 */
  headless?: boolean
  /** 默认 true：缺省视口拉至 1920×1080 并锁 DPR=1；显式 width/height 优先；设 false 尊重小视口。 */
  maximized?: boolean
}

export interface EvaluateOutcome {
  ok: boolean
  value?: unknown
  exception?: string
}

export class CdpSession {
  private port = 0
  private child?: ChildProcess
  private ws?: WsLike
  private seq = 0
  private closed = false
  private tabId?: string
  private profile = ''
  /** attach 模式（连接已运行的浏览器/Electron）：close 时不杀进程。 */
  private attached = false
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >()

  private constructor() { /* use CdpSession.open() / attach() */ }

  /**
   * Attach to an ALREADY RUNNING Chromium/Electron instance through its
   * remote-debugging port (launched with --remote-debugging-port=<port>).
   * Picks the first `page` target whose URL matches `match` (default: any
   * 127.0.0.1 / localhost page). This is the "real machine" mode: the page
   * the user is actually looking at.
   */
  static async attach(port = 9222, match?: string | RegExp): Promise<CdpSession> {
    const session = new CdpSession()
    session.port = port
    session.attached = true
    const res = await fetch(`http://127.0.0.1:${port}/json/list`)
    if (!res.ok) throw new Error(`调试端口 HTTP ${res.status}（浏览器/Electron 是否以 --remote-debugging-port=${port} 启动？）`)
    const tabs = (await res.json()) as Array<{ id?: string; type?: string; url?: string; webSocketDebuggerUrl?: string }>
    const re = typeof match === 'string' ? new RegExp(match) : (match ?? /(127\.0\.0\.1|localhost)/i)
    const tab = tabs.find((t) => t.type === 'page' && typeof t.url === 'string' && re.test(t.url))
    if (!tab || !tab.webSocketDebuggerUrl) {
      const urls = tabs.filter((t) => t.type === 'page').map((t) => t.url).slice(0, 10)
      throw new Error(`未找到匹配的页面标签（端口 ${port} 上的页面: ${urls.join(' | ') || '无'}）`)
    }
    session.tabId = tab.id
    await session.connect(tab.webSocketDebuggerUrl)
    await session.send('Page.enable')
    await session.send('Runtime.enable')
    return session
  }

  /** Launch Chrome (headless by default), open a tab at `url`, and attach CDP. 默认即最大化矫正。 */
  static async open(url: string, opts: LaunchOptions = {}): Promise<CdpSession> {
    const chrome = opts.chromePath ?? process.env.CHROME_PATH ?? findChrome()
    if (!chrome) {
      throw new Error('未找到 Chrome/Edge。请安装 Chrome（或设置 CHROME_PATH 指向浏览器可执行文件）。')
    }
    const session = new CdpSession()
    session.port = await getFreePort()
    session.profile = opts.userDataDir ?? join(tmpdir(), 'dsh-ui-inspect-' + process.pid + '-' + session.port)
    // 第一性：显式宽高优先；缺省且 maximized=true 时拉至 FullHD（尽可能大），否则回退小值兼容。
    const wantMax = opts.maximized !== false // default true
    const isHeadless = opts.headless !== false // default true（保持无头兼容）
    const width = opts.width ?? (wantMax ? 1920 : 1440)
    const height = opts.height ?? (wantMax ? 1080 : 900)
    const args = [
      '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
      '--disable-dev-shm-usage', '--force-device-scale-factor=1', '--window-position=0,0',
      `--user-data-dir=${session.profile}`, `--window-size=${width},${height}`,
      `--remote-debugging-port=${session.port}`, 'about:blank',
    ]
    if (isHeadless) {
      // 无头：虚拟大视口，靠 Emulation 保证 innerWidth
      args.unshift('--headless=new')
    } else {
      // 有头：物理最大化，等价 SKILL viewport:null
      args.push('--start-maximized')
    }
    const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'ignore'] })
    session.child = child
    child.on('exit', () => {
      session.closed = true
      session.rejectAll(new Error('浏览器进程已退出'))
    })
    try {
      await session.pollVersion()
      const tab = await session.createTab(url)
      await session.connect(tab.webSocketDebuggerUrl)
      await session.send('Page.enable')
      await session.send('Runtime.enable')
      // 第一性矫正：窗口外框 ≠ 视口，统一用 CDP 覆盖视口并锁 DPR=1（无头/有头都生效）
      try {
        await session.send('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
          screenWidth: width,
          screenHeight: height,
        })
      } catch { /* ignore — 旧版 Chrome 无 Emulation 亦可降级为 --window-size */ }
      // 有头且要求最大化：OS 窗口同步最大化（与 Emulation 视口互补）
      if (!isHeadless && wantMax) {
        try {
          // Browser 域无需显式 enable，优先用 targetId 取窗口
          const win = await session.send('Browser.getWindowForTarget', tab.id ? { targetId: tab.id } as Record<string, unknown> : {})
          const windowId = (win as { windowId?: number })?.windowId
          if (typeof windowId === 'number') {
            await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } })
          } else {
            // 回退：无参调用（部分 Edge/Chrome 接受）
            const win2 = await session.send('Browser.getWindowForTarget', {})
            const wid2 = (win2 as { windowId?: number })?.windowId
            if (typeof wid2 === 'number') await session.send('Browser.setWindowBounds', { windowId: wid2, bounds: { windowState: 'maximized' } })
          }
        } catch { /* ignore — 无头或权限不足时无需 OS 最大化 */ }
      }
      await session.waitReady(15000)
      return session
    } catch (e) {
      await session.close()
      throw e
    }
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err)
    this.pending.clear()
  }

  private async pollVersion(): Promise<void> {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/version`)
        if (res.ok) return
      } catch { /* not up yet */ }
      await sleep(150)
    }
    throw new Error('Chrome 调试端口未能就绪')
  }

  private async createTab(url: string): Promise<{ id: string; webSocketDebuggerUrl: string }> {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
    if (!res.ok) throw new Error(`创建标签页失败: HTTP ${res.status}`)
    const tab = (await res.json()) as { id: string; webSocketDebuggerUrl: string }
    this.tabId = tab.id
    return tab
  }

  private connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const Ws = wsCtor()
      let ws: WsLike
      try {
        ws = new Ws(wsUrl)
      } catch (e) {
        reject(e)
        return
      }
      this.ws = ws
      ws.onopen = () => resolve()
      ws.onerror = (e) => reject(e instanceof Error ? e : new Error(String(e)))
      ws.onclose = () => {
        this.closed = true
        this.rejectAll(new Error('CDP 连接已关闭'))
      }
      ws.onmessage = (ev) => {
        let msg: { id?: number; method?: string; params?: unknown; error?: { message?: string }; result?: unknown }
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }
        if (typeof msg.id === 'number') {
          const p = this.pending.get(msg.id)
          if (!p) return
          this.pending.delete(msg.id)
          if (msg.error) p.reject(new Error(msg.error.message ?? 'CDP error'))
          else p.resolve(msg.result)
        }
      }
    })
  }

  /** Send one CDP command and await its result. */
  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (this.closed) return Promise.reject(new Error('CDP 会话已关闭'))
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      this.pending.set(id, { resolve, reject })
      try {
        this.ws?.send(JSON.stringify({ id, method, params }))
      } catch (e) {
        this.pending.delete(id)
        reject(e)
      }
    })
  }

  /** Wait until document.readyState === 'complete' (capped). */
  async waitReady(timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const r = await this.evaluate('document.readyState')
      if (r.ok && r.value === 'complete') return
      await sleep(250)
    }
    // Not an error — SPA with long-lived connections may never fire load; caller
    // adds settle time via waitMs.
  }

  /** Evaluate JS in the page and return a safe outcome. */
  async evaluate(expression: string): Promise<EvaluateOutcome> {
    try {
      const res = await this.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      })
      if (res.exceptionDetails) {
        const ex = res.exceptionDetails.exception
        return { ok: false, exception: ex && ex.description ? String(ex.description) : 'evaluate threw' }
      }
      return { ok: true, value: res.result?.value }
    } catch (e) {
      return { ok: false, exception: e instanceof Error ? e.message : String(e) }
    }
  }

  async navigate(url: string): Promise<void> {
    if (!/^https?:\/\//i.test(url)) throw new Error(`无效 URL（仅 http/https）: ${url}`)
    await this.send('Page.navigate', { url })
    await this.waitReady(20000)
  }

  async waitMs(ms: number): Promise<void> {
    if (Number.isFinite(ms) && ms > 0) await sleep(Math.min(ms, 120000))
  }

  /** Capture a PNG of the current viewport (or full page) and write it to disk. */
  async screenshot(outPath: string, fullPage = false): Promise<number> {
    const shot = await this.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: fullPage, fromSurface: true,
    })
    if (!shot || typeof shot.data !== 'string') throw new Error('截图未返回数据')
    const buf = Buffer.from(shot.data, 'base64')
    mkdirSync(outPath.substring(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))), { recursive: true })
    writeFileSync(outPath, buf)
    return buf.length
  }

  /** Resolve an element's viewport center via a CSS selector (top document). */
  async elementCenter(selector: string): Promise<{ x: number; y: number } | undefined> {
    const expr = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
    const out = await this.evaluate(expr)
    if (!out.ok || typeof out.value !== 'object' || out.value === null) return undefined
    const v = out.value as { x: number; y: number }
    return { x: v.x, y: v.y }
  }

  /** Dispatch a mouse press at viewport coordinates. */
  async mousePress(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
    })
  }

  async mouseMove(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y, buttons: 1,
    })
  }

  async mouseRelease(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
    })
  }

  /** Click at viewport coordinates (press + release). */
  async clickAt(x: number, y: number): Promise<void> {
    await this.mousePress(x, y)
    await sleep(40)
    await this.mouseRelease(x, y)
  }

  /** Click the center of an element matched by selector. */
  async clickSelector(selector: string): Promise<boolean> {
    const c = await this.elementCenter(selector)
    if (!c) return false
    await this.clickAt(Math.round(c.x), Math.round(c.y))
    return true
  }

  /**
   * Pointer drag: press at `from`, move in `steps` increments to `to`, then
   * release. Optional per-step callback (e.g. to screenshot intermediate
   * states).
   */
  async drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 5,
    settleMs = 80,
    onStep?: (step: number, x: number, y: number) => Promise<void>,
  ): Promise<void> {
    await this.mousePress(from.x, from.y)
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(from.x + ((to.x - from.x) * i) / steps)
      const y = Math.round(from.y + ((to.y - from.y) * i) / steps)
      await this.mouseMove(x, y)
      await sleep(settleMs)
      if (onStep) await onStep(i, x, y)
    }
    await this.mouseRelease(to.x, to.y)
  }

  /** Send a raw key press (Enter/Tab/Escape/arrows are forwarded to the page). */
  async keyPress(key: string): Promise<void> {
    const lower = key.toLowerCase()
    const map: Record<string, { code: string; vk: number }> = {
      enter: { code: 'Enter', vk: 13 },
      tab: { code: 'Tab', vk: 9 },
      escape: { code: 'Escape', vk: 27 },
      backspace: { code: 'Backspace', vk: 8 },
      arrowup: { code: 'ArrowUp', vk: 38 },
      arrowdown: { code: 'ArrowDown', vk: 40 },
      arrowleft: { code: 'ArrowLeft', vk: 37 },
      arrowright: { code: 'ArrowRight', vk: 39 },
    }
    const m = map[lower]
    if (!m) throw new Error(`不支持的按键: ${key}（支持: ${Object.keys(map).join(', ')}）`)
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: m.code, code: m.code, windowsVirtualKeyCode: m.vk, nativeVirtualKeyCode: m.vk,
    })
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: m.code, code: m.code, windowsVirtualKeyCode: m.vk, nativeVirtualKeyCode: m.vk,
    })
  }

  /** Scroll the top document. */
  async scroll(opts: { x?: number; y?: number; to?: 'top' | 'bottom' }): Promise<void> {
    const expr = opts.to === 'top'
      ? 'window.scrollTo(0, 0)'
      : opts.to === 'bottom'
        ? 'window.scrollTo(0, document.documentElement.scrollHeight)'
        : `window.scrollBy(${opts.x ?? 0}, ${opts.y ?? 0})`
    await this.evaluate(expr)
  }

  /** Dispose: close WS; kill the browser ONLY if we launched it (open mode). */
  async close(): Promise<void> {
    this.closed = true
    try { this.ws?.close() } catch { /* ignore */ }
    if (!this.attached) {
      try {
        if (this.tabId) {
          await fetch(`http://127.0.0.1:${this.port}/json/close/${this.tabId}`).catch(() => undefined)
        }
      } catch { /* ignore */ }
      try { this.child?.kill() } catch { /* ignore */ }
      // Give the OS a moment, then force-kill if needed.
      await sleep(80)
      try { if (this.child?.exitCode === null) this.child.kill('SIGKILL') } catch { /* ignore */ }
    }
    this.rejectAll(new Error('CDP 会话已关闭'))
  }
}
