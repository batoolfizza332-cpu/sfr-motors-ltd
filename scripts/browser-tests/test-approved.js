// Targeted regression for the owner-approved corrections, on the PRODUCTION build behind the CloudFront+CSP model.
const fs = require("fs"), path = require("path"), http = require("http");
const { start } = require("../preview-edge.js");
const { launch, newPage, sleep } = require("./cdp.js");
const PORT = 4300, H = `http://sfr-test.localhost:${PORT}`;
const ROOT = path.join(__dirname, "..", "..");
const SHOTS = path.join(process.env.SFR_SHOTS || require("os").tmpdir(), "sfr-browser-shots", "approved"); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, total = 0; const t = (ok, m, d) => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + m + (!ok && d !== undefined ? "  -> " + JSON.stringify(d).slice(0, 400) : "")); };
const req = (p, host) => new Promise((res) => http.get({ host: "127.0.0.1", port: PORT, path: p, headers: host ? { host } : {} }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ status: r.statusCode, loc: r.headers.location, headers: r.headers, body: b })); }));
const isGoogle = (u) => /(^|\.)(google|gstatic|googleapis|googletagmanager|google-analytics|doubleclick)\.com$/.test(new URL(u).hostname);

// minimal robots.txt evaluator (REP: most specific group wins; longest matching rule wins; Allow wins ties)
function robotsAllows(txt, agent, p) {
  const groups = []; let cur = null;
  for (const raw of txt.split(/\r?\n/)) { const l = raw.replace(/#.*/, "").trim(); if (!l) continue; const [k, ...v] = l.split(":"); const key = k.toLowerCase(), val = v.join(":").trim();
    if (key === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(val.toLowerCase()); }
    else if ((key === "allow" || key === "disallow") && cur) cur.rules.push([key, val]); }
  const a = agent.toLowerCase(); let g = groups.find((x) => x.agents.some((n) => n !== "*" && a.includes(n))) || groups.find((x) => x.agents.includes("*"));
  if (!g) return true; let best = null;
  for (const [k, v] of g.rules) { if (v === "" ) continue; if (p.startsWith(v)) { if (!best || v.length > best.v.length || (v.length === best.v.length && k === "allow")) best = { k, v }; } }
  return !best || best.k === "allow";
}

(async () => {
  await start({ port: PORT, quiet: true, compress: true });
  const browser = await launch(9400);
  const mk = async (w, h, mobile, allowGoogle = false, cookie = "denied") => { const p = await newPage(browser, { width: w, height: h, mobile, onIntercept: async (r) => { const u = new URL(r.url); if (u.hostname.endsWith("localhost")) return {}; if (allowGoogle && /^(maps\.google\.com|www\.google\.com|www\.gstatic\.com|maps\.gstatic\.com|fonts\.gstatic\.com)$/.test(u.hostname)) return {}; return { fail: true }; } }); if (cookie) await p.S("Network.setCookie", { name: "sfr_consent", value: "v1:analytics=" + cookie, url: H + "/" }); return p; };

  // ================= robots.txt =================
  const robots = (await req("/robots.txt")).body;
  for (const [ua, path_, want] of [["Googlebot", "/", true], ["Googlebot", "/assets/css/main.12345678.css", true], ["Googlebot", "/assets/img/logo.webp", true], ["Googlebot", "/assets/fonts/roboto-latin-var.woff2", true], ["bingbot", "/about-us/", true], ["OAI-SearchBot", "/", true], ["OAI-SearchBot", "/about-us/", true], ["GPTBot", "/", false], ["GPTBot", "/assets/img/logo.webp", false], ["GPTBot/1.1", "/services.html", false], ["ChatGPT-User", "/", true]]) t(robotsAllows(robots, ua, path_) === want, `robots.txt: ${ua} ${want ? "may" : "may NOT"} fetch ${path_}`);
  t(/^Sitemap: https:\/\/sfrmotors\.co\.uk\/sitemap\.xml$/m.test(robots), "robots.txt keeps its Sitemap line");

  // ================= /index.html redirect + Broxburn + www =================
  { const r = await req("/index.html"); t(r.status === 301 && r.loc === "/", "/index.html -> 301 -> /", [r.status, r.loc]); }
  { const r = await req("/index.html", "www.sfrmotors.co.uk"); t(r.status === 301 && r.loc === "https://sfrmotors.co.uk/", "www /index.html -> single 301 -> https://sfrmotors.co.uk/", [r.status, r.loc]); }
  { const r = await req("/"); t(r.status === 200 && /<link rel="canonical" href="https:\/\/sfrmotors\.co\.uk\/">/.test(r.body), "/ serves 200 with canonical https://sfrmotors.co.uk/"); }
  for (const [from, to] of [["/about.html", "/about-us/"], ["/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill.html", "/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/"], ["/puncture-repairs-whats-actually-being-done-to-your-tyre.html", "/puncture-repairs-whats-actually-being-done-to-your-tyre/"], ["/the-best-tyres-for-your-ford-on-edinburghs-roads.html", "/the-best-tyres-for-your-ford-on-edinburghs-roads/"], ["/the-best-tyres-for-edinburgh-west-lothian-roads.html", "/the-best-tyres-for-edinburgh-west-lothian-roads/"]]) { const r = await req(from); t(r.status === 301 && r.loc === to, `existing redirect intact: ${from} -> ${to}`, [r.status, r.loc]); }
  { const home = (await req("/")).body; const m = home.match(/<a class="sfr-areas__pin" href="broxburn\/"[^>]*>[\s\S]*?<\/a>/); t(!!m && /Broxburn, West Lothian/.test(m[0]), "Home Areas We Cover links to /broxburn/ (existing page, existing wording)"); const b = await req("/broxburn/"); t(b.status === 200 && /<title>Mobile Tyre Fitting In Broxburn \| SFR Motors Ltd<\/title>/.test(b.body) && /rel="canonical" href="https:\/\/sfrmotors\.co\.uk\/broxburn\/"/.test(b.body), "/broxburn/ serves 200 with its own canonical"); t(/href="mobile-tyre-fitting-broxburn\.html"/.test(home), "the other Broxburn page is still linked (neither is orphaned)"); }
  { const sm = (await req("/sitemap.xml")).body; t(/<loc>https:\/\/sfrmotors\.co\.uk\/broxburn\/<\/loc>/.test(sm) && !/index\.html/.test(sm), "sitemap still lists /broxburn/ and never /index.html"); }

  // ================= fonts =================
  for (const [w, h, mob] of [[375, 812, true], [1280, 720, false]]) {
    const p = await mk(w, h, mob); await p.goto(H + "/"); await sleep(800);
    const ext = p.state.requests.filter((r) => !new URL(r.url).hostname.endsWith("localhost"));
    const fontReq = p.state.requests.filter((r) => /\/assets\/fonts\//.test(r.url));
    t(ext.length === 0 && !p.state.requests.some((r) => /fonts\.g(oogleapis|static)\.com/.test(r.url)), `@${w}: no request leaves the site at all on Home (no fonts.googleapis.com / fonts.gstatic.com)`, ext.map((r) => r.url));
    // The local preview sends Cache-Control: no-store, so the browser may fetch the same file twice (preload + @font-face) depending on timing;
    // production caches it. What must hold is that the four weights share ONE self-hosted file.
    t(fontReq.length >= 1 && new Set(fontReq.map((r) => r.url)).size === 1 && /roboto-latin-var\.woff2$/.test(fontReq[0].url), `@${w}: the only font file fetched is the one self-hosted WOFF2 (4 weights share it)`, fontReq.map((r) => r.url));
    const f = await p.eval(`(async()=>{await document.fonts.ready;const faces=[...document.fonts].map(f=>f.family+" "+f.weight+" "+f.status);
      const wd=(wt,fam)=>{const s=document.createElement("span");s.style.cssText="position:absolute;visibility:hidden;white-space:nowrap;font:"+wt+" 40px "+fam;s.textContent="Mobile Tyre Fitting Bathgate 0131 202 0289";document.body.appendChild(s);const w=s.getBoundingClientRect().width;s.remove();return +w.toFixed(1)};
      return {faces,check:document.fonts.check("700 16px Roboto"),w:{400:wd(400,"Roboto,Arial"),500:wd(500,"Roboto,Arial"),600:wd(600,"Roboto,Arial"),700:wd(700,"Roboto,Arial"),800:wd(800,"Roboto,Arial"),900:wd(900,"Roboto,Arial")},arial:wd(400,"Arial"),bodyFont:getComputedStyle(document.body).fontFamily}})()`);
    t(f.faces.length === 4 && f.faces.every((x) => /^"?Roboto"? \d+ (loaded|unloaded)$/.test(x)) && f.faces.some((x) => /loaded$/.test(x) && !/unloaded/.test(x)), `@${w}: four Roboto faces declared, self-hosted file loaded`, f.faces);
    await p.S("DOM.enable"); await p.S("CSS.enable"); const doc = await p.S("DOM.getDocument", {});
    const used = async (sel) => { const n = await p.S("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel }); return (await p.S("CSS.getPlatformFontsForNode", { nodeId: n.nodeId })).fonts; };
    const h1f = await used("h1"), txtf = await used(".sfr-hero__text");
    t(f.w[400] < f.w[500] && f.w[500] < f.w[700] && f.w[700] < f.w[900] && f.w[600] === f.w[700] && f.w[800] === f.w[900], `@${w}: weights render distinctly (400<500<700<900; 600 maps to 700 and 800 to 900, as before)`, f.w);
    t(h1f.length === 1 && h1f[0].isCustomFont && h1f[0].familyName === "Roboto" && /Black/.test(h1f[0].postScriptName) && txtf.every((x) => x.isCustomFont && x.familyName === "Roboto"), `@${w}: text is drawn by the self-hosted Roboto (H1 Roboto-Black, body Roboto), not a system fallback`, { h1f, txtf });
    t(/Segoe UI/.test(f.bodyFont) && /sans-serif/.test(f.bodyFont), `@${w}: system fallbacks remain in the font stack`, f.bodyFont);
    await p.close();
  }
  // layout shift with the self-hosted font (baseline before: desktop Home 0.010, About 0.015, Privacy 0.016; mobile 0.000)
  for (const [w, h, mob] of [[375, 812, true], [1280, 720, false]]) for (const u of ["/", "/about-us/", "/contact-us/", "/privacy-policy.html", "/mobile-tyre-fitting-bathgate.html"]) {
    const p = await mk(w, h, mob); await p.S("Page.addScriptToEvaluateOnNewDocument", { source: `window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:"layout-shift",buffered:true})` });
    await p.goto(H + u); await sleep(1500); const cls = await p.eval("window.__cls"); t(cls < 0.05, `CLS ${cls.toFixed(4)} at ${w}px on ${u} (< 0.05, no regression from self-hosting)`, cls); await p.close();
  }

  // ================= Google Map: click to load =================
  for (const [w, h, mob] of [[1280, 720, false], [375, 812, true]]) {
    const p = await mk(w, h, mob); await p.goto(H + "/contact-us/"); await sleep(2500);
    const g = p.state.requests.filter((r) => isGoogle(r.url));
    const b = await p.eval(`(()=>{const btn=document.querySelector("[data-sfr-map-load]");const r=btn.getBoundingClientRect();const box=document.querySelector("[data-sfr-map]").getBoundingClientRect();return {text:btn.textContent.trim(),role:btn.tagName,iframes:document.querySelectorAll("iframe").length,hasExplain:/connects your browser to Google/.test(document.querySelector(".sfr-map__consent-text").textContent),textualLocation:/Bathgate, West Lothian/.test(document.querySelector(".sfr-map__text").textContent)&&/Service Location/.test(document.body.textContent),fits:box.right<=innerWidth&&r.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,grp:document.querySelector(".sfr-map__consent").getAttribute("role"),labelled:!!document.getElementById(document.querySelector(".sfr-map__consent").getAttribute("aria-labelledby"))}})()`);
    t(g.length === 0 && b.iframes === 0 && (await p.cookies()).filter((c) => c.name !== "sfr_consent").length === 0, `@${w}: before any click - no Google request, no iframe, no cookie on /contact-us/`, { g: g.map((r) => r.url), b });
    t(b.text === "Load Google Map" && b.role === "BUTTON" && b.hasExplain && b.textualLocation && b.fits && !b.overflow && b.grp === "group" && b.labelled, `@${w}: accessible placeholder: named button, explanation of the Google connection, textual service location, fits the layout`, b);
    if (w === 1280) await p.shot(path.join(SHOTS, "contact-map-before-1280.png"));
    if (w === 375) { await p.eval(`document.querySelector(".sfr-map").scrollIntoView({behavior:"instant"})`); await sleep(300); await p.shot(path.join(SHOTS, "contact-map-before-375.png")); }
    const links = await p.eval(`[...document.querySelectorAll("a[href*='google.com/maps']")].map(a=>a.getAttribute("href"))`);
    t(links.every((l) => /query=Bathgate%2C\+West\+Lothian$/.test(l)) && links.length === 1, "the only Google Maps link is the explicit 'View Bathgate area' link (general Bathgate search, no business name)", links);
    await p.close();
  }
  { // keyboard activation with real Google allowed (one real embed request), then verify the result
    const p = await mk(1280, 720, false, true); await p.goto(H + "/contact-us/"); await sleep(800);
    await p.eval(`document.querySelector("[data-sfr-map-load]").focus()`);
    const ring = await p.eval(`(()=>{const c=getComputedStyle(document.activeElement);return {outline:c.outlineStyle+" "+c.outlineWidth,fv:document.activeElement.matches(":focus-visible")}})()`);
    p.reset(); await p.key("Enter"); await sleep(6000);
    const a = await p.eval(`({iframes:[...document.querySelectorAll("iframe")].map(f=>({src:f.src,title:f.title})),active:document.activeElement.tagName,buttons:document.querySelectorAll("[data-sfr-map-load]").length,box:document.querySelector("[data-sfr-map]").getBoundingClientRect().height})`);
    t(/^outline-style|solid|auto/.test(ring.outline) || ring.fv, "the Load button shows a visible keyboard focus indicator", ring);
    t(a.iframes.length === 1 && a.iframes[0].src === "https://maps.google.com/maps?q=Bathgate%2C+West+Lothian&z=12&output=embed" && /service area/.test(a.iframes[0].title) && a.active === "IFRAME" && a.buttons === 0, "Enter loads the approved map exactly once (general Bathgate, West Lothian), focus moves to the titled iframe", a);
    const gr = p.state.requests.filter((r) => isGoogle(r.url)).map((r) => new URL(r.url).hostname + new URL(r.url).pathname.slice(0, 22));
    t(gr.some((x) => /^maps\.google\.com/.test(x)) && !p.state.console.some((l) => /Refused to|Content Security Policy/i.test(l)), "after the click Google is contacted, with no CSP violation (frame-src origins are sufficient)", { gr: [...new Set(gr)].slice(0, 6), csp: p.state.console.filter((l) => /Refused|Content Security/i.test(l)) });
    await p.shot(path.join(SHOTS, "contact-map-after-1280.png")); await p.close();
  }
  { const p = await mk(375, 812, true); await p.goto(H + "/contact-us/"); await p.eval(`document.querySelector("[data-sfr-map-load]").focus()`); await p.key(" "); await sleep(500); t(await p.eval(`document.querySelectorAll("iframe").length`) === 1, "Space key also activates the button (single iframe)"); await p.eval(`document.querySelector("[data-sfr-map]").querySelector("iframe")&&1`); await p.close(); }

  // ================= address / social / legal on the built site =================
  const dist = ROOT + "/dist"; const htmls = fs.readdirSync(dist).filter((f) => f.endsWith(".html"));
  const all = htmls.map((f) => [f, fs.readFileSync(path.join(dist, f), "utf8")]);
  t(all.every(([, h]) => !/loch park|EH48|streetAddress|postalCode/i.test(h)), "build: no street address / postcode / streetAddress anywhere in the built HTML");
  t(all.every(([, h]) => !/href="#"/.test(h) && !/on Facebook|on Instagram/.test(h)), `build: no placeholder href="#" and no Facebook/Instagram controls in ${htmls.length} pages`);
  t(all.every(([, h]) => !/fonts\.googleapis|fonts\.gstatic/.test(h)), "build: no Google Fonts reference in any page");
  t(all.every(([f, h]) => /<p class="sfr-footer__legal">SFR Motors Ltd\. Registered in England and Wales, company number 15819240\. Registered office: 143 Beverley Drive, Edgware, England, HA8 5NH\.<\/p>/.test(h)), `build: company disclosure present on all ${htmls.length} pages`);
  t(all.every(([f, h]) => !/priceRange/.test(h)) && /"ratingValue":\s*"4\.9"[\s\S]{0,40}"reviewCount":\s*"282"/.test(all.find(([f]) => f === "index.html")[1]), "build: priceRange absent; Home aggregateRating still 4.9 / 282");
  t(all.every(([, h]) => !/href="\/?index\.html/.test(h)), "build: no internal link to /index.html");
  const css = fs.readdirSync(dist + "/assets/css").map((f) => fs.readFileSync(dist + "/assets/css/" + f, "utf8")).join("");
  t(/@font-face/.test(css) && !/fonts\.g/.test(css) && !/sfr-footer__social/.test(css), "build: CSS has the @font-face rules, no Google Fonts, no dead social styles");
  const fw = fs.statSync(dist + "/assets/fonts/roboto-latin-var.woff2").size, lic = fs.existsSync(dist + "/assets/fonts/OFL.txt");
  t(fw === 43136 && lic, `build: font file ${fw} bytes + OFL.txt licence shipped`);

  // ================= shared footer / layout on representative pages =================
  for (const [w, h, mob] of [[375, 812, true], [1280, 720, false]]) {
    for (const [name, u] of [["home", "/"], ["contact", "/contact-us/"], ["privacy", "/privacy-policy.html"], ["location", "/mobile-tyre-fitting-bathgate.html"], ["service", "/mobile-tyre-fitting.html"], ["notfound", "/no/such/page/"]]) {
      const p = await mk(w, h, mob); await p.goto(H + u); await sleep(400);
      const r = await p.eval(`(()=>{const f=document.querySelector(".sfr-footer");const l=document.querySelector(".sfr-footer__legal");const lr=l.getBoundingClientRect();const cols=[...document.querySelectorAll(".sfr-footer__top > *")].map(e=>e.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth,legalInside:lr.left>=0&&lr.right<=innerWidth,legalFont:getComputedStyle(l).fontSize,social:document.querySelectorAll(".sfr-footer__social,[aria-label*=Facebook],[aria-label*=Instagram]").length,cookieBtn:!!document.querySelector(".sfr-footer [data-sfr-cookie-settings]:not([hidden])"),wa:!!document.querySelector('.sfr-footer a[href="https://wa.me/447448427154"]'),tel:!!document.querySelector('.sfr-footer a[href="tel:+441312020289"]'),mail:!!document.querySelector('.sfr-footer a[href="mailto:info@sfrmotors.co.uk"]'),loc:document.querySelector(".sfr-footer__contact li:last-child").textContent.trim(),locIsLink:!!document.querySelector(".sfr-footer__contact li:last-child a"),col1:Math.round(cols[0].height)}})()`);
      t(!r.overflow && r.legalInside && r.social === 0 && r.cookieBtn && r.wa && r.tel && r.mail && r.loc === "Bathgate, West Lothian" && !r.locIsLink, `footer @${w} ${name}: no overflow, disclosure fits, no social icons, tel/WhatsApp/email intact, location is plain text`, r);
      if ((name === "home" || name === "contact") ) { await p.eval(`document.querySelector(".sfr-footer").scrollIntoView({block:"end",behavior:"instant"})`); await sleep(300); await p.shot(path.join(SHOTS, `footer-${name}-${w}.png`)); }
      await p.close();
    }
  }
  await browser.close();
  console.log(`\n${total - fails}/${total} approved-corrections checks passed`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
