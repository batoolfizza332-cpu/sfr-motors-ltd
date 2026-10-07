// Minimal zero-dependency Chrome DevTools Protocol driver (Node 22+ global WebSocket).
//
// setHostMap({ "sfrmotors.co.uk": port, ... }) makes those hostnames answer from the local preview server on 127.0.0.1:port:
// the browser page really is on https://sfrmotors.co.uk/ (so the production-hostname guards see the production hostname), but
// every request to it is intercepted inside the browser and fulfilled locally. Nothing is sent to the real domain.
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs"), os = require("os"), path = require("path");
const CANDIDATES = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const CHROME = process.env.CHROME || CANDIDATES.find((c) => fs.existsSync(c)) || CANDIDATES[0]; // set CHROME=<path> to use another Chromium browser
let hostMap = {};
const setHostMap = (map) => { hostMap = map; };

function localFetch(port, url, method) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: u.pathname + u.search, method, headers: { host: u.hostname } }, (res) => {
      const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject); req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(port = 9333) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfr-chrome-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--mute-audio", "about:blank"], { stdio: "ignore" });
  let ws;
  for (let i = 0; i < 60; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); ws = j.webSocketDebuggerUrl; break; } catch { await sleep(250); }
  }
  if (!ws) throw new Error("Chrome did not start");
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  sock.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else if (msg.method) listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const on = (fn) => listeners.push(fn);
  const close = async () => { try { await send("Browser.close"); } catch {} try { sock.close(); } catch {} proc.kill(); await sleep(400); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  return { send, on, close };
}

// A page in a fresh browser context (clean cookies) with request interception and event capture.
async function newPage(browser, { width, height, mobile, onIntercept }) {
  const { browserContextId } = await browser.send("Target.createBrowserContext");
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => browser.send(m, p, sessionId);
  const state = { requests: [], console: [] };
  browser.on(async (msg) => {
    if (msg.sessionId !== sessionId) return;
    const { method, params } = msg;
    if (method === "Fetch.requestPaused") {
      const rec = { url: params.request.url, method: params.request.method, type: params.resourceType };
      state.requests.push(rec);
      try {
        const port = hostMap[new URL(rec.url).hostname];
        if (port) { // a fake production/preview hostname: answer from the local server
          const r = await localFetch(port, rec.url, rec.method);
          await S("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: r.status, responseHeaders: Object.entries(r.headers).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => ({ name: k, value: String(x) }))), body: r.body.toString("base64") });
          return;
        }
        const action = (await onIntercept(rec, params)) || {};
        if (action.fulfill) await S("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: action.contentType || "application/javascript" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from(action.fulfill).toString("base64") });
        else if (action.fail) await S("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
        else await S("Fetch.continueRequest", { requestId: params.requestId });
      } catch (e) { /* page navigated away */ }
    } else if (method === "Runtime.consoleAPICalled") state.console.push(params.type + ": " + params.args.map((a) => a.value ?? a.description).join(" "));
    else if (method === "Log.entryAdded") state.console.push(params.entry.level + ": " + params.entry.text + " " + (params.entry.url || ""));
  });
  await S("Page.enable"); await S("Runtime.enable"); await S("Log.enable"); await S("Network.enable");
  await S("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile: !!mobile });
  const page = {
    state, S,
    async goto(url) {
      const loaded = new Promise((r) => browser.on((msg) => { if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") r(); }));
      await S("Page.navigate", { url });
      await Promise.race([loaded, sleep(15000)]);
      await sleep(600);
    },
    async eval(expr) {
      const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || ""));
      return r.result.value;
    },
    async cookies() { const { cookies } = await S("Network.getAllCookies"); return cookies; },
    async key(key, opts = {}) {
      const codes = { Tab: 9, Escape: 27, Enter: 13, " ": 32 };
      const base = { key, code: key, windowsVirtualKeyCode: codes[key], modifiers: opts.shift ? 8 : 0 };
      await S("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: key === "Enter" ? "\r" : key === " " ? " " : undefined });
      await S("Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await sleep(80);
    },
    async click(sel) {
      const box = await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      if (!box) throw new Error("no element " + sel);
      await S("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
      await S("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
      await S("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
      await sleep(300);
    },
    async shot(file) { const r = await S("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    reset() { state.requests.length = 0; state.console.length = 0; },
    async close() { await browser.send("Target.closeTarget", { targetId }); await browser.send("Target.disposeBrowserContext", { browserContextId }); },
  };
  return page;
}
module.exports = { launch, newPage, sleep, setHostMap };
