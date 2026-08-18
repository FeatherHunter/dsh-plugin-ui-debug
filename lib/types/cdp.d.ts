/** Resolve a usable browser binary; prefer Chrome over Edge. */
export declare function findChrome(): string | undefined;
export interface LaunchOptions {
    width?: number;
    height?: number;
    chromePath?: string;
    userDataDir?: string;
}
export interface EvaluateOutcome {
    ok: boolean;
    value?: unknown;
    exception?: string;
}
export declare class CdpSession {
    private port;
    private child?;
    private ws?;
    private seq;
    private closed;
    private tabId?;
    private profile;
    /** attach 模式（连接已运行的浏览器/Electron）：close 时不杀进程。 */
    private attached;
    private readonly pending;
    private constructor();
    /**
     * Attach to an ALREADY RUNNING Chromium/Electron instance through its
     * remote-debugging port (launched with --remote-debugging-port=<port>).
     * Picks the first `page` target whose URL matches `match` (default: any
     * 127.0.0.1 / localhost page). This is the "real machine" mode: the page
     * the user is actually looking at.
     */
    static attach(port?: number, match?: string | RegExp): Promise<CdpSession>;
    /** Launch headless Chrome, open a tab at `url`, and attach CDP. */
    static open(url: string, opts?: LaunchOptions): Promise<CdpSession>;
    private rejectAll;
    private pollVersion;
    private createTab;
    private connect;
    /** Send one CDP command and await its result. */
    send(method: string, params?: Record<string, unknown>): Promise<any>;
    /** Wait until document.readyState === 'complete' (capped). */
    waitReady(timeoutMs?: number): Promise<void>;
    /** Evaluate JS in the page and return a safe outcome. */
    evaluate(expression: string): Promise<EvaluateOutcome>;
    navigate(url: string): Promise<void>;
    waitMs(ms: number): Promise<void>;
    /** Capture a PNG of the current viewport (or full page) and write it to disk. */
    screenshot(outPath: string, fullPage?: boolean): Promise<number>;
    /** Resolve an element's viewport center via a CSS selector (top document). */
    elementCenter(selector: string): Promise<{
        x: number;
        y: number;
    } | undefined>;
    /** Dispatch a mouse press at viewport coordinates. */
    mousePress(x: number, y: number): Promise<void>;
    mouseMove(x: number, y: number): Promise<void>;
    mouseRelease(x: number, y: number): Promise<void>;
    /** Click at viewport coordinates (press + release). */
    clickAt(x: number, y: number): Promise<void>;
    /** Click the center of an element matched by selector. */
    clickSelector(selector: string): Promise<boolean>;
    /**
     * Pointer drag: press at `from`, move in `steps` increments to `to`, then
     * release. Optional per-step callback (e.g. to screenshot intermediate
     * states).
     */
    drag(from: {
        x: number;
        y: number;
    }, to: {
        x: number;
        y: number;
    }, steps?: number, settleMs?: number, onStep?: (step: number, x: number, y: number) => Promise<void>): Promise<void>;
    /** Send a raw key press (Enter/Tab/Escape/arrows are forwarded to the page). */
    keyPress(key: string): Promise<void>;
    /** Scroll the top document. */
    scroll(opts: {
        x?: number;
        y?: number;
        to?: 'top' | 'bottom';
    }): Promise<void>;
    /** Dispose: close WS; kill the browser ONLY if we launched it (open mode). */
    close(): Promise<void>;
}
