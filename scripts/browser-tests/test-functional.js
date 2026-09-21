// Functional tests on the production build: 404 route, redirects (incl. www), calculator, quote forms (stopped before
// WhatsApp opens), tel/WhatsApp links. Nothing is sent anywhere: window.open is stubbed, Google requests blocked.
const fs = require("fs"), path = require("path");
const http = require("http");
const { start } = require("../preview-edge.js");
const { launch, newPage, sleep, setHostMap } = require("./cdp.js");
// The WhatsApp enquiry works only on the production hostnames (assets/js/main.js), so the form tests run on https://sfrmotors.co.uk/,
// which the browser answers from the local server (cdp.js setHostMap). Nothing reaches the real domain, and window.open is stubbed.
const PORT = 4240, H = `http://sfr-test.localhost:${PORT}`, PROD = "https://sfrmotors.co.uk", PREVIEW = "https://sfr-motors-preview.vercel.app";
setHostMap({ "sfrmotors.co.uk": PORT, "sfr-motors-preview.vercel.app": PORT });
let fails = 0, total = 0; const t = (ok, m, d) => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + m + (!ok && d !== undefined ? "  -> " + JSON.stringify(d).slice(0, 300) : "")); };
const req = (p, host) => new Promise((res) => http.get({ host: "127.0.0.1", port: PORT, path: p, headers: host ? { host } : {} }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ status: r.statusCode, loc: r.headers.location, headers: r.headers, body: b })); }));

(async () => {
  await start({ port: PORT, quiet: true });
  // ---- redirects & rewrites at the edge model (real function code from template.yaml) ----
  for (const [from, to] of [["/about.html", "/about-us/"], ["/emergency-tyre-change.html", "/24-7-mobile-tyre-replacement/"], ["/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill.html", "/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/"], ["/puncture-repairs-whats-actually-being-done-to-your-tyre.html", "/puncture-repairs-whats-actually-being-done-to-your-tyre/"], ["/the-best-tyres-for-your-ford-on-edinburghs-roads.html", "/the-best-tyres-for-your-ford-on-edinburghs-roads/"], ["/the-best-tyres-for-edinburgh-west-lothian-roads.html", "/the-best-tyres-for-edinburgh-west-lothian-roads/"], ["/best-mobile-tyre-fitter-west-lothian/", "/mobile-tyre-fitting-west-lothian/"], ["/tyres-bathgate-guide", "/van-tyre-replacement-services/"]]) {
    const r = await req(from); t(r.status === 301 && r.loc === to, `301 ${from} -> ${to}`, [r.status, r.loc]);
  }
  // audit-kept WordPress URLs are served at their exact URL (200, with and without the slash); the old .html URL 301s to it in one hop
  for (const [url, file] of [["/mobile-tyre-fitting-whitburn/", "/mobile-tyre-fitting-whitburn.html"], ["/mobile-tyre-fitting-in-addiewell/", "/mobile-tyre-fitting-addiewell.html"], ["/privacy-policy/", "/privacy-policy.html"], ["/trade-fleet-tyre-services/", "/trade-fleet-tyre-services.html"]]) {
    for (const u of [url, url.slice(0, -1)]) { const r = await req(u); t(r.status === 200 && r.body.includes(`<link rel="canonical" href="https://sfrmotors.co.uk${url}">`), `exact URL ${u} serves 200 with canonical ${url}`, [r.status]); }
    const r = await req(file); t(r.status === 301 && r.loc === url, `historical ${file} -> 301 -> ${url}`, [r.status, r.loc]);
  }
  for (const u of ["/about-us/", "/about-us", "/contact-us/", "/blog", "/tyre-size-calculator/"]) { const r = await req(u); t(r.status === 200 && /<title>/.test(r.body), `pretty path ${u} serves 200 (rewrite, URL unchanged)`, r.status); }
  { const r = await req("/x/", "www.sfrmotors.co.uk"); t(r.status === 301 && r.loc === "https://sfrmotors.co.uk/x/", "www.sfrmotors.co.uk/x/ -> 301 -> https://sfrmotors.co.uk/x/", [r.status, r.loc]); }
  { const r = await req("/about.html", "www.sfrmotors.co.uk"); t(r.status === 301 && r.loc === "https://sfrmotors.co.uk/about-us/", "www + legacy .html URL -> single 301 to the final pretty URL", [r.status, r.loc]); }
  { const r = await req("/", "sfrmotors.co.uk"); t(r.status === 200, "apex host is served normally (no redirect loop)", r.status); }
  { const r = await req("/index.html"); t(r.status === 301 && r.loc === "/", "/index.html -> 301 -> / (Home has one URL)", [r.status, r.loc]); }
  for (const [u, must] of [["/robots.txt", /OAI-SearchBot|Allow: \//], ["/sitemap.xml", /<urlset/], ["/favicon.ico", null]]) { const r = await req(u); t(r.status === 200, `${u} -> 200`, r.status); }
  { const r = await req("/robots.txt"); t(/User-agent: \*\s+Allow: \/\s/.test(r.body) && /User-agent: OAI-SearchBot\s+Allow: \/\s/.test(r.body) && /User-agent: GPTBot\s+Disallow: \/\s/.test(r.body) && /^Sitemap: https:\/\/sfrmotors\.co\.uk\/sitemap\.xml\s*$/m.test(r.body), "robots.txt (owner-approved): everything allowed for normal crawlers, OAI-SearchBot explicitly allowed, GPTBot explicitly disallowed, Sitemap line kept", r.body.slice(0, 200)); }

  const browser = await launch(9380);
  const mk = async (w, h, mobile, origin = H) => { const p = await newPage(browser, { width: w, height: h, mobile, onIntercept: async (r) => { const x = new URL(r.url); return x.hostname.endsWith("localhost") || x.hostname.endsWith("googleapis.com") || x.hostname.endsWith("gstatic.com") ? {} : { fail: true }; } }); await p.S("Network.setCookie", { name: "sfr_consent", value: "v1:analytics=denied", url: origin + "/" }); return p; };

  // ---- 404 route ----
  for (const [w, h, mob] of [[375, 812, true], [1280, 720, false], [1920, 1080, false]]) {
    for (const u of ["/does-not-exist/", "/a/b/c/nope.html", "/does-not-exist"]) {
      const r = await req(u); const p = await mk(w, h, mob); await p.goto(H + u);
      const i = await p.eval(`({title:document.title,h1:(document.querySelector("h1")||{}).textContent,bg:getComputedStyle(document.body).backgroundColor,sticky:getComputedStyle(document.querySelector(".sfr-header")).position,robots:(document.querySelector('meta[name=robots]')||{}).content,canon:!!document.querySelector('link[rel=canonical]'),broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,links:[...document.querySelectorAll("main a[href]")].map(a=>a.getAttribute("href")),overflow:document.documentElement.scrollWidth>innerWidth,footerBtn:!!document.querySelector(".sfr-footer [data-sfr-cookie-settings]")})`);
      t(r.status === 404 && i.title === "Page Not Found | SFR Motors Ltd" && i.h1 === "Page not found" && i.bg === "rgb(7, 7, 7)" && i.sticky === "sticky" && /noindex/.test(i.robots) && !i.canon && !i.broken && !i.overflow && i.footerBtn, `404 ${u} @${w}: HTTP 404, styled 404 page (not the homepage), noindex, no canonical, no overflow`, { status: r.status, ...i });
      if (u === "/a/b/c/nope.html") await p.shot(path.join(process.env.SFR_SHOTS || require("os").tmpdir(), `404-after-${w}.png`));
      await p.close();
    }
  }
  { const p = await mk(1280, 720, false); await p.goto(H + "/no/such/place/"); const links = await p.eval(`[...document.querySelectorAll("main a[href]")].map(a=>a.getAttribute("href"))`);
    const codes = []; for (const l of links) { if (l.startsWith("tel:")) continue; const r = await req(l.split("#")[0]); codes.push(r.status); }
    t(codes.every((c) => c === 200 || c === 301), "404 page links (home, services, areas, contact, blog) all resolve", { links, codes }); await p.close(); }

  // ---- tyre size calculator ----
  {
    const p = await mk(375, 812, true); await p.goto(H + "/tyre-size-calculator/");
    const fill = async (o) => { for (const [id, v] of Object.entries(o)) await p.eval(`(()=>{const i=document.getElementById(${JSON.stringify(id)});i.value=${JSON.stringify(v)};i.dispatchEvent(new Event("input",{bubbles:true}))})()`); };
    const submit = async () => { await p.click('#tyre-calc-form button[type="submit"]'); await sleep(300); };
    await submit();
    let s = await p.eval(`({invalid:document.querySelectorAll('#tyre-calc-form [aria-invalid="true"]').length,errs:[...document.querySelectorAll(".sfr-calc__error")].filter(e=>e.textContent.trim()).length,focus:document.activeElement.id})`);
    t(s.invalid === 6 && s.errs === 6, "calculator: empty submit flags all 6 fields (aria-invalid + role=alert messages)", s);
    await fill({ "cur-width": "999", "cur-profile": "abc", "cur-rim": "0", "new-width": "-5", "new-profile": "50", "new-rim": "17" }); await submit();
    s = await p.eval(`({errs:[...document.querySelectorAll(".sfr-calc__error")].map(e=>e.textContent.trim()).filter(Boolean),results:!!document.querySelector(".sfr-calc__results:not([hidden])")})`);
    t(s.errs.length === 4 && !s.results, "calculator: out-of-range / non-numeric / zero / negative input is rejected with messages, no result shown", s);
    await fill({ "cur-width": "205", "cur-profile": "55", "cur-rim": "16", "new-width": "225", "new-profile": "45", "new-rim": "17" }); await submit();
    s = await p.eval(`({invalid:document.querySelectorAll('#tyre-calc-form [aria-invalid="true"]').length,text:(document.querySelector(".sfr-calc__results")||document.body).innerText.slice(0,700)})`);
    // independent maths: overall diameter mm = 2*width*profile/100 + rim*25.4
    const d1 = (2 * 205 * 55) / 100 + 16 * 25.4, d2 = (2 * 225 * 45) / 100 + 17 * 25.4;
    const nums = (s.text.match(/[\d.]+/g) || []).map(Number);
    t(s.invalid === 0 && nums.some((n) => Math.abs(n - d1) < 1) && nums.some((n) => Math.abs(n - d2) < 1), `calculator: valid input clears errors and shows correct diameters (${d1.toFixed(1)} mm and ${d2.toFixed(1)} mm)`, s.text.slice(0, 300));
    t(!/\b(safe|legal|approved|compatible)\b/i.test(s.text.replace(/not (a )?(safe|legal|approved|compatible)/gi, "")), "calculator: result text makes no safety/legal/compatibility claim", s.text.slice(0, 200));
    t(!p.state.requests.some((r) => !r.url.includes("sfr-test.localhost") && !/googleapis|gstatic/.test(r.url)) && !p.state.console.some((l) => /^error/.test(l) && !/BLOCKED/.test(l)), "calculator: no third-party request, no console error");
    await p.close();
  }

  // ---- quote forms (Home + Contact) up to, not including, WhatsApp ----
  for (const u of ["/", "/contact-us/"]) {
    const p = await mk(375, 812, true, PROD); await p.goto(PROD + u); await sleep(1700);
    await p.eval(`window.__opens=[];window.open=function(){window.__opens.push([].slice.call(arguments));return null};window.__ev=0;document.addEventListener("sfr:quote-submitted",()=>window.__ev++);0`);
    const setv = (n, v) => p.eval(`(()=>{const e=document.querySelector('#quote-form-el [name=${n}]');e.value=${JSON.stringify(v)};e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))})()`);
    // (a) empty -> blocked
    await p.click('#quote-form-el button[type="submit"]'); await sleep(300);
    let s = await p.eval(`({opens:window.__opens.length,ev:window.__ev,state:document.getElementById("quote-form-status").dataset.state})`);
    t(s.opens === 0 && s.ev === 0, `${u}: empty quote form is blocked (no WhatsApp, no event)`, s);
    // (b) genuine submission
    await setv("name", "Test Person"); await setv("phone", "07000000000"); await setv("service", await p.eval(`document.querySelector('#quote-form-el [name=service] option:not([value=""])').value`)); await setv("location", "Bathgate"); await setv("vehicleReg", "TE57 ABC");
    await p.click('#quote-form-el button[type="submit"]'); await sleep(400);
    s = await p.eval(`({opens:window.__opens,ev:window.__ev,status:document.getElementById("quote-form-status").textContent,state:document.getElementById("quote-form-status").dataset.state,reset:document.querySelector('#quote-form-el [name=name]').value===""})`);
    const o = s.opens[0] || [];
    const msg = (() => { try { return decodeURIComponent((o[0] || "").split("?text=")[1] || ""); } catch { return ""; } })();
    t(s.opens.length === 1 && /^https:\/\/wa\.me\/447448427154\?text=/.test(o[0]) && o[1] === "_blank" && /noopener/.test(o[2] || "") && /Test Person/.test(msg) && s.state === "success" && s.reset && s.ev === 1, `${u}: valid submission opens WhatsApp deep link to the approved number only (stubbed), _blank+noopener, form reset, one quote-submitted event`, { o: o[0] && o[0].slice(0, 60), s: s.state, ev: s.ev });
    // (c) too-fast / honeypot never opens WhatsApp or fires the event
    await p.goto(PROD + u); await p.eval(`window.__opens=[];window.open=function(){window.__opens.push(1);return null};window.__ev=0;document.addEventListener("sfr:quote-submitted",()=>window.__ev++);0`);
    await setv("name", "Bot"); await setv("phone", "1"); await setv("service", await p.eval(`document.querySelector('#quote-form-el [name=service] option:not([value=""])').value`)); await setv("location", "x");
    await p.click('#quote-form-el button[type="submit"]'); await sleep(300);
    s = await p.eval(`({opens:window.__opens.length,ev:window.__ev,status:document.getElementById("quote-form-status").dataset.state})`);
    t(s.opens === 0 && s.ev === 0, `${u}: submission faster than a human (bot timing) neither opens WhatsApp nor fires the conversion event`, s);
    t(!p.state.requests.some((r) => r.method === "POST"), `${u}: no POST request is ever made by the form`);
    await p.close();
  }

  // ---- quote form on review copies (Vercel Preview URL, *.localhost): must never open WhatsApp or announce a submission ----
  for (const [origin, label] of [[PREVIEW, "a *.vercel.app Preview URL"], [H, "a *.localhost host"]]) {
    for (const u of ["/", "/contact-us/"]) {
      const p = await mk(375, 812, true, origin); await p.goto(origin + u); await sleep(1700);
      await p.eval(`window.__opens=[];window.open=function(){window.__opens.push([].slice.call(arguments));return null};window.__ev=0;document.addEventListener("sfr:quote-submitted",()=>window.__ev++);0`);
      const setv = (n, v) => p.eval(`(()=>{const e=document.querySelector('#quote-form-el [name=${n}]');e.value=${JSON.stringify(v)};e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))})()`);
      await p.click('#quote-form-el button[type="submit"]'); await sleep(300);
      let s = await p.eval(`({opens:window.__opens.length,ev:window.__ev})`);
      t(s.opens === 0 && s.ev === 0, `${label} ${u}: an empty form is still blocked by validation`, s);
      await setv("name", "Test Reviewer"); await setv("phone", "07000000000"); await setv("service", await p.eval(`document.querySelector('#quote-form-el [name=service] option:not([value=""])').value`)); await setv("location", "Bathgate");
      await p.click('#quote-form-el button[type="submit"]'); await sleep(400);
      s = await p.eval(`({opens:window.__opens.length,ev:window.__ev,status:document.getElementById("quote-form-status").textContent,state:document.getElementById("quote-form-status").dataset.state,kept:document.querySelector('#quote-form-el [name=name]').value})`);
      t(s.opens === 0 && s.ev === 0 && s.state === "error" && /Preview copy: nothing was sent and WhatsApp was not opened/.test(s.status) && s.kept === "Test Reviewer", `${label} ${u}: a valid submission does NOT open WhatsApp, fires no submission event, explains that nothing was sent, and keeps the entries`, s);
      t(!p.state.requests.some((r) => r.method === "POST" || /wa\.me|whatsapp/.test(r.url)), `${label} ${u}: no POST and no WhatsApp request is made`);
      await p.close();
    }
  }

  // ---- tel / WhatsApp links on every page ----
  {
    const dist = path.join(__dirname, "..", "..", "site"); let tel = 0, wa = 0, badTel = [], badWa = [], badTarget = [];
    for (const f of fs.readdirSync(dist).filter((x) => x.endsWith(".html"))) {
      const h = fs.readFileSync(path.join(dist, f), "utf8");
      for (const m of h.matchAll(/href="tel:([^"]*)"/g)) { tel++; if (m[1] !== "+441312020289") badTel.push(f + " " + m[1]); }
      for (const m of h.matchAll(/<a\b[^>]*href="(https:\/\/wa\.me\/[^"]*)"[^>]*>/g)) { wa++; if (!/^https:\/\/wa\.me\/447448427154(\?|$)/.test(m[1])) badWa.push(f + " " + m[1]); if (!/target="_blank"/.test(m[0]) || !/rel="[^"]*noopener/.test(m[0])) badTarget.push(f); }
      if (/href="whatsapp:|api\.whatsapp\.com/.test(h)) badWa.push(f + " other whatsapp scheme");
    }
    t(badTel.length === 0 && badWa.length === 0 && badTarget.length === 0, `all ${tel} tel: links use +441312020289 and all ${wa} WhatsApp links use wa.me/447448427154 with target=_blank rel=noopener`, { badTel, badWa, badTarget });
  }
  await browser.close();
  console.log(`\n${total - fails}/${total} functional checks passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
