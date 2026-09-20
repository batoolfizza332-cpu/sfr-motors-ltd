// Full-site regression sweep of the production build (dist/) behind the CloudFront + CSP model.
//  1. every sitemap URL, Desktop + Mobile, fresh visitor: banner, footer control, overflow, console errors
//  2. internal link / asset resolution against the edge model (redirect + rewrite + S3 lookups)
//  3. Contact page: the Google Map is click-to-load (nothing requested before the click) and the production CSP allows it after
const fs = require("fs"), path = require("path");
const { start } = require("../preview-edge.js");
const { launch, newPage, sleep } = require("./cdp.js");
const ROOT = path.join(__dirname, "..", "..");
const PORT = 4183, HOST = `http://sfr-test.localhost:${PORT}`;

const sitemap = fs.readFileSync(ROOT + "/site/sitemap.xml", "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

(async () => {
  await start({ port: PORT, quiet: true });
  const browser = await launch(9336);
  let failures = 0;
  const fail = (m) => { failures++; console.log("FAIL", m); };

  // ---- 1. page sweep ---------------------------------------------------------
  for (const vp of [{ label: "desktop 1280x720", width: 1280, height: 720 }, { label: "mobile 375x812", width: 375, height: 812, mobile: true }]) {
    let ok = 0;
    for (const u of urls) {
      const page = await newPage(browser, { ...vp, onIntercept: async (rec) => { const h = new URL(rec.url).hostname; return h.endsWith("localhost") || h.endsWith("googleapis.com") || h.endsWith("gstatic.com") ? {} : { fail: true }; } });
      await page.goto(HOST + u); await sleep(250);
      const r = await page.eval(`(()=>{
        const vis=s=>{const e=document.querySelector(s);if(!e)return false;const b=e.getBoundingClientRect();return b.width>0&&b.height>0};
        return { h1:document.querySelectorAll('h1').length, title:document.title, banner:vis('.sfr-consent__card'), accept:vis('[data-sfr-consent="granted"]'), reject:vis('[data-sfr-consent="denied"]'),
          footerBtn:vis('.sfr-footer [data-sfr-cookie-settings]'), overflow:document.documentElement.scrollWidth>innerWidth, first:document.body.firstElementChild.id,
          bannerBox:(()=>{const b=document.querySelector('.sfr-consent__card').getBoundingClientRect();return {b:b.bottom,r:b.right,h:b.height}})(), jsGtag:typeof window.gtag };})()`);
      const errs = page.state.console.filter((l) => /^(error|exception)/i.test(l) && !/BLOCKED_BY_CLIENT/.test(l));
      const bad = [];
      if (r.h1 !== 1) bad.push("h1=" + r.h1);
      if (!r.title) bad.push("no title");
      if (!r.banner || !r.accept || !r.reject) bad.push("banner controls not visible");
      if (!r.footerBtn) bad.push("footer Cookie settings not visible");
      if (r.overflow) bad.push("horizontal overflow");
      if (r.first !== "sfr-consent") bad.push("banner not first in DOM");
      if (r.bannerBox.b > vp.height || r.bannerBox.r > vp.width) bad.push("banner outside viewport");
      if (vp.mobile && r.bannerBox.h > vp.height * 0.3) bad.push("banner > 30% of mobile viewport: " + Math.round(r.bannerBox.h));
      if (r.jsGtag !== "undefined") bad.push("gtag defined before consent");
      if (errs.length) bad.push("console errors: " + errs.join(" | "));
      if (page.state.requests.some((q) => /googletagmanager|google-analytics/.test(q.url))) bad.push("Google Analytics request before consent");
      if (bad.length) fail(`${vp.label} ${u}: ${bad.join("; ")}`); else ok++;
      await page.close();
    }
    console.log(`SWEEP ${vp.label}: ${ok}/${urls.length} pages clean (banner + footer control + no overflow + no console errors + no GA before consent)`);
  }

  // ---- 2. internal links & assets against the edge model ---------------------
  const dist = ROOT + "/dist";
  const pagesByUrl = new Map(urls.map((u) => [u, true]));
  const allFiles = fs.readdirSync(dist).filter((f) => f.endsWith(".html"));
  const seen = new Map(); let checked = 0; const bad = [];
  const attrRe = /\b(?:href|src|srcset)\s*=\s*"([^"]*)"/g;
  const pageUrlFor = (f) => { const rev = urls.find((u) => u !== "/" && u.endsWith("/") && false); return "/" + (f === "index.html" ? "" : f); };
  for (const f of allFiles) {
    const html = fs.readFileSync(dist + "/" + f, "utf8").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
    // Some pages are served at pretty paths; relative links there are root-relative already (verified by verify.js check 13).
    const base = new URL(pageUrlFor(f), "http://x");
    for (const m of html.matchAll(attrRe)) {
      for (const part of (m[0].startsWith("srcset") ? m[1].split(",") : [m[1]])) {
        const raw = part.trim().split(/\s+/)[0];
        if (!raw || /^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(raw)) continue;
        const u = new URL(raw, base); const key = u.pathname;
        if (seen.has(key)) continue;
        const res = await fetch(`http://127.0.0.1:${PORT}${key}`, { redirect: "manual" });
        seen.set(key, res.status); checked++;
        if (res.status >= 400) bad.push(`${res.status} ${key}  (from ${f})`);
      }
    }
  }
  const redirects = [...seen].filter(([, s]) => s === 301 || s === 302).map(([k]) => k);
  console.log(`LINKS: ${checked} unique internal destinations checked; ${bad.length} broken; ${redirects.length} return a redirect:`, redirects);
  bad.forEach((b) => fail("broken destination " + b));

  // ---- 3. Google Map on the Contact page: click-to-load, and allowed by the production CSP ------
  // The map is created only when the visitor presses "Load Google Map" (approved behaviour), so nothing may be requested
  // from Google on load. Google's answers are stubbed here; the CSP check happens in the browser before any request.
  const page = await newPage(browser, { width: 1280, height: 720, onIntercept: async (rec) => { const h = new URL(rec.url).hostname; if (h === "www.google.com" || h === "maps.google.com") return { fulfill: "<!doctype html><title>map stub</title>", contentType: "text/html" }; return h.endsWith("localhost") || h.endsWith("googleapis.com") || h.endsWith("gstatic.com") ? {} : { fail: true }; } });
  await page.goto(HOST + "/contact-us/"); await sleep(2500);
  const googleRequests = () => page.state.requests.filter((r) => /(^|\.)google\.com$/.test(new URL(r.url).hostname));
  const before = { requests: googleRequests().length, iframes: await page.eval('document.querySelectorAll("iframe").length') };
  console.log("MAP before click:", before.requests, "Google requests,", before.iframes, "iframes");
  if (before.requests || before.iframes) fail("Google Map was requested or embedded before the visitor clicked");
  await page.click("[data-sfr-map-load]"); await sleep(1500);
  const frames = page.state.requests.filter((r) => r.type === "Document" && /(^|\.)google\.com$/.test(new URL(r.url).hostname)).map((r) => r.url.slice(0, 90));
  const iframeSrc = await page.eval('(document.querySelector("iframe") || {}).src');
  const cspErrs = page.state.console.filter((l) => /Refused to (frame|connect|load|apply)|Content Security Policy/i.test(l));
  console.log("MAP after click: frame requests:", frames, "| iframe src:", iframeSrc, "| CSP violations:", cspErrs.length ? cspErrs : "none");
  if (!frames.length || !/^https:\/\/maps\.google\.com\/maps\?q=Bathgate/.test(iframeSrc || "") || cspErrs.length) fail("Google Map did not load after the click, or the production CSP blocked it");
  await page.close();

  await browser.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL SWEEP CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
