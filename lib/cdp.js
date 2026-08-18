/**
 * cdp.ts — dependency-free Chrome DevTools Protocol client.
 *
 * Launches a headless Chrome/Edge with a remote-debugging port, then drives it
 * through CDP over WebSocket (Node 22 provides the global WebSocket). Zero npm
 * dependencies — this is what lets `ui_shot` / `ui_drive` work out of the box.
 *
 * Safety: the child process is always killed in dispose(); pending commands are
 * rejected when the connection dies so a tool call never hangs forever.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
function wsCtor() {
    const ctor = globalThis.WebSocket;
    if (typeof ctor !== 'function') {
        throw new Error('全局 WebSocket 不可用（需要 Node 22+）');
    }
    return ctor;
}
/** Resolve a usable browser binary; prefer Chrome over Edge. */
export function findChrome() {
    const candidates = [];
    if (process.env.CHROME_PATH)
        candidates.push(process.env.CHROME_PATH);
    const pf = process.env.PROGRAMFILES ?? '';
    const pf86 = process.env['PROGRAMFILES(X86)'] ?? '';
    const la = process.env.LOCALAPPDATA ?? '';
    // Chrome
    candidates.push(join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    candidates.push(join(la, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    // Edge
    candidates.push(join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    candidates.push(join(la, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    for (const c of candidates) {
        if (c && existsSync(c))
            return c;
    }
    return undefined;
}
/** Grab a free TCP port for the debugging endpoint. */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.once('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
            srv.close(() => resolve(port));
        });
    });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class CdpSession {
    port = 0;
    child;
    ws;
    seq = 0;
    closed = false;
    tabId;
    profile = '';
    /** attach 模式（连接已运行的浏览器/Electron）：close 时不杀进程。 */
    attached = false;
    pending = new Map();
    constructor() { }
    /**
     * Attach to an ALREADY RUNNING Chromium/Electron instance through its
     * remote-debugging port (launched with --remote-debugging-port=<port>).
     * Picks the first `page` target whose URL matches `match` (default: any
     * 127.0.0.1 / localhost page). This is the "real machine" mode: the page
     * the user is actually looking at.
     */
    static async attach(port = 9222, match) {
        const session = new CdpSession();
        session.port = port;
        session.attached = true;
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (!res.ok)
            throw new Error(`调试端口 HTTP ${res.status}（浏览器/Electron 是否以 --remote-debugging-port=${port} 启动？）`);
        const tabs = (await res.json());
        const re = typeof match === 'string' ? new RegExp(match) : (match ?? /(127\.0\.0\.1|localhost)/i);
        const tab = tabs.find((t) => t.type === 'page' && typeof t.url === 'string' && re.test(t.url));
        if (!tab || !tab.webSocketDebuggerUrl) {
            const urls = tabs.filter((t) => t.type === 'page').map((t) => t.url).slice(0, 10);
            throw new Error(`未找到匹配的页面标签（端口 ${port} 上的页面: ${urls.join(' | ') || '无'}）`);
        }
        session.tabId = tab.id;
        await session.connect(tab.webSocketDebuggerUrl);
        await session.send('Page.enable');
        await session.send('Runtime.enable');
        return session;
    }
    /** Launch headless Chrome, open a tab at `url`, and attach CDP. */
    static async open(url, opts = {}) {
        const chrome = opts.chromePath ?? process.env.CHROME_PATH ?? findChrome();
        if (!chrome) {
            throw new Error('未找到 Chrome/Edge。请安装 Chrome（或设置 CHROME_PATH 指向浏览器可执行文件）。');
        }
        const session = new CdpSession();
        session.port = await getFreePort();
        session.profile = opts.userDataDir ?? join(tmpdir(), 'dsh-ui-inspect-' + process.pid + '-' + session.port);
        const width = opts.width ?? 1440;
        const height = opts.height ?? 900;
        const args = [
            '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
            '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
            `--user-data-dir=${session.profile}`, `--window-size=${width},${height}`,
            `--remote-debugging-port=${session.port}`, 'about:blank',
        ];
        const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'ignore'] });
        session.child = child;
        child.on('exit', () => {
            session.closed = true;
            session.rejectAll(new Error('浏览器进程已退出'));
        });
        try {
            await session.pollVersion();
            const tab = await session.createTab(url);
            await session.connect(tab.webSocketDebuggerUrl);
            await session.send('Page.enable');
            await session.send('Runtime.enable');
            await session.waitReady(15000);
            return session;
        }
        catch (e) {
            await session.close();
            throw e;
        }
    }
    rejectAll(err) {
        for (const [, p] of this.pending)
            p.reject(err);
        this.pending.clear();
    }
    async pollVersion() {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`http://127.0.0.1:${this.port}/json/version`);
                if (res.ok)
                    return;
            }
            catch { /* not up yet */ }
            await sleep(150);
        }
        throw new Error('Chrome 调试端口未能就绪');
    }
    async createTab(url) {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
        if (!res.ok)
            throw new Error(`创建标签页失败: HTTP ${res.status}`);
        const tab = (await res.json());
        this.tabId = tab.id;
        return tab;
    }
    connect(wsUrl) {
        return new Promise((resolve, reject) => {
            const Ws = wsCtor();
            let ws;
            try {
                ws = new Ws(wsUrl);
            }
            catch (e) {
                reject(e);
                return;
            }
            this.ws = ws;
            ws.onopen = () => resolve();
            ws.onerror = (e) => reject(e instanceof Error ? e : new Error(String(e)));
            ws.onclose = () => {
                this.closed = true;
                this.rejectAll(new Error('CDP 连接已关闭'));
            };
            ws.onmessage = (ev) => {
                let msg;
                try {
                    msg = JSON.parse(ev.data);
                }
                catch {
                    return;
                }
                if (typeof msg.id === 'number') {
                    const p = this.pending.get(msg.id);
                    if (!p)
                        return;
                    this.pending.delete(msg.id);
                    if (msg.error)
                        p.reject(new Error(msg.error.message ?? 'CDP error'));
                    else
                        p.resolve(msg.result);
                }
            };
        });
    }
    /** Send one CDP command and await its result. */
    send(method, params = {}) {
        if (this.closed)
            return Promise.reject(new Error('CDP 会话已关闭'));
        return new Promise((resolve, reject) => {
            const id = ++this.seq;
            this.pending.set(id, { resolve, reject });
            try {
                this.ws?.send(JSON.stringify({ id, method, params }));
            }
            catch (e) {
                this.pending.delete(id);
                reject(e);
            }
        });
    }
    /** Wait until document.readyState === 'complete' (capped). */
    async waitReady(timeoutMs = 15000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const r = await this.evaluate('document.readyState');
            if (r.ok && r.value === 'complete')
                return;
            await sleep(250);
        }
        // Not an error — SPA with long-lived connections may never fire load; caller
        // adds settle time via waitMs.
    }
    /** Evaluate JS in the page and return a safe outcome. */
    async evaluate(expression) {
        try {
            const res = await this.send('Runtime.evaluate', {
                expression, returnByValue: true, awaitPromise: true,
            });
            if (res.exceptionDetails) {
                const ex = res.exceptionDetails.exception;
                return { ok: false, exception: ex && ex.description ? String(ex.description) : 'evaluate threw' };
            }
            return { ok: true, value: res.result?.value };
        }
        catch (e) {
            return { ok: false, exception: e instanceof Error ? e.message : String(e) };
        }
    }
    async navigate(url) {
        if (!/^https?:\/\//i.test(url))
            throw new Error(`无效 URL（仅 http/https）: ${url}`);
        await this.send('Page.navigate', { url });
        await this.waitReady(20000);
    }
    async waitMs(ms) {
        if (Number.isFinite(ms) && ms > 0)
            await sleep(Math.min(ms, 120000));
    }
    /** Capture a PNG of the current viewport (or full page) and write it to disk. */
    async screenshot(outPath, fullPage = false) {
        const shot = await this.send('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: fullPage, fromSurface: true,
        });
        if (!shot || typeof shot.data !== 'string')
            throw new Error('截图未返回数据');
        const buf = Buffer.from(shot.data, 'base64');
        mkdirSync(outPath.substring(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))), { recursive: true });
        writeFileSync(outPath, buf);
        return buf.length;
    }
    /** Resolve an element's viewport center via a CSS selector (top document). */
    async elementCenter(selector) {
        const expr = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`;
        const out = await this.evaluate(expr);
        if (!out.ok || typeof out.value !== 'object' || out.value === null)
            return undefined;
        const v = out.value;
        return { x: v.x, y: v.y };
    }
    /** Dispatch a mouse press at viewport coordinates. */
    async mousePress(x, y) {
        await this.send('Input.dispatchMouseEvent', {
            type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
        });
    }
    async mouseMove(x, y) {
        await this.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved', x, y, buttons: 1,
        });
    }
    async mouseRelease(x, y) {
        await this.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
        });
    }
    /** Click at viewport coordinates (press + release). */
    async clickAt(x, y) {
        await this.mousePress(x, y);
        await sleep(40);
        await this.mouseRelease(x, y);
    }
    /** Click the center of an element matched by selector. */
    async clickSelector(selector) {
        const c = await this.elementCenter(selector);
        if (!c)
            return false;
        await this.clickAt(Math.round(c.x), Math.round(c.y));
        return true;
    }
    /**
     * Pointer drag: press at `from`, move in `steps` increments to `to`, then
     * release. Optional per-step callback (e.g. to screenshot intermediate
     * states).
     */
    async drag(from, to, steps = 5, settleMs = 80, onStep) {
        await this.mousePress(from.x, from.y);
        for (let i = 1; i <= steps; i++) {
            const x = Math.round(from.x + ((to.x - from.x) * i) / steps);
            const y = Math.round(from.y + ((to.y - from.y) * i) / steps);
            await this.mouseMove(x, y);
            await sleep(settleMs);
            if (onStep)
                await onStep(i, x, y);
        }
        await this.mouseRelease(to.x, to.y);
    }
    /** Send a raw key press (Enter/Tab/Escape/arrows are forwarded to the page). */
    async keyPress(key) {
        const lower = key.toLowerCase();
        const map = {
            enter: { code: 'Enter', vk: 13 },
            tab: { code: 'Tab', vk: 9 },
            escape: { code: 'Escape', vk: 27 },
            backspace: { code: 'Backspace', vk: 8 },
            arrowup: { code: 'ArrowUp', vk: 38 },
            arrowdown: { code: 'ArrowDown', vk: 40 },
            arrowleft: { code: 'ArrowLeft', vk: 37 },
            arrowright: { code: 'ArrowRight', vk: 39 },
        };
        const m = map[lower];
        if (!m)
            throw new Error(`不支持的按键: ${key}（支持: ${Object.keys(map).join(', ')}）`);
        await this.send('Input.dispatchKeyEvent', {
            type: 'keyDown', key: m.code, code: m.code, windowsVirtualKeyCode: m.vk, nativeVirtualKeyCode: m.vk,
        });
        await this.send('Input.dispatchKeyEvent', {
            type: 'keyUp', key: m.code, code: m.code, windowsVirtualKeyCode: m.vk, nativeVirtualKeyCode: m.vk,
        });
    }
    /** Scroll the top document. */
    async scroll(opts) {
        const expr = opts.to === 'top'
            ? 'window.scrollTo(0, 0)'
            : opts.to === 'bottom'
                ? 'window.scrollTo(0, document.documentElement.scrollHeight)'
                : `window.scrollBy(${opts.x ?? 0}, ${opts.y ?? 0})`;
        await this.evaluate(expr);
    }
    /** Dispose: close WS; kill the browser ONLY if we launched it (open mode). */
    async close() {
        this.closed = true;
        try {
            this.ws?.close();
        }
        catch { /* ignore */ }
        if (!this.attached) {
            try {
                if (this.tabId) {
                    await fetch(`http://127.0.0.1:${this.port}/json/close/${this.tabId}`).catch(() => undefined);
                }
            }
            catch { /* ignore */ }
            try {
                this.child?.kill();
            }
            catch { /* ignore */ }
            // Give the OS a moment, then force-kill if needed.
            await sleep(80);
            try {
                if (this.child?.exitCode === null)
                    this.child.kill('SIGKILL');
            }
            catch { /* ignore */ }
        }
        this.rejectAll(new Error('CDP 会话已关闭'));
    }
}
//# sourceMappingURL=cdp.js.map