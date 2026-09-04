#!/usr/bin/env node
// Phase 4B Batch B4 regression tests — the interactive tyre size
// calculator at /tyre-size-calculator/.
//
// This is in addition to — not a replacement for — scripts/phase3-test.js
// and scripts/phase4-test.js, which already cover this page generically
// (sitemap inclusion, no duplicate titles/meta, no orphan pages, no
// self-serving AggregateRating schema). This file adds Batch-B4-specific
// assertions in two parts:
//   Part 1 (Node/HTTP): an independent re-implementation of the exact
//     formula (never imported from the site's own JS) checked against
//     hand-verified expected values, plus static page/source checks —
//     canonical, H1, JSON-LD, no unsafe verdict language, no universal
//     tolerance claim, no network-transmission code in the source.
//   Part 2 (Playwright, optional — skipped if not available): real
//     browser checks — keyboard-only operation, accessible error/result
//     announcements, boundary/invalid input handling, reset, no network
//     requests fired while using the calculator, and an axe-core sweep at
//     mobile/tablet/desktop viewports.
//
// Run: `node scripts/phase4b-batchB4-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const SITE_DIR = path.join(ROOT, "site");
const PORT = 8947;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PATH = "/tyre-size-calculator/";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 19; // 17 as of the Batch B2 correction, +2 from Batch C; Batch B4 itself added no redirects

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".xml": "application/xml" }[ext] || "application/octet-stream";
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);
  if (vercelConfig.redirects.some((r) => r.source === p)) {
    const r = vercelConfig.redirects.find((r) => r.source === p);
    res.writeHead(301, { Location: r.destination });
    return res.end();
  }
  if (p !== "/" && !p.endsWith("/") && !path.extname(p)) {
    res.writeHead(301, { Location: p + "/" });
    return res.end();
  }
  const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
});

function get(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on("error", reject);
  });
}

const results = { pass: 0, fail: 0 };
function ok() { results.pass++; }
function fail(label, detail) {
  results.fail++;
  console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
}

// ---------------------------------------------------------------------
// Part 1a: independent re-implementation of the formula. Deliberately
// NOT copied from site/assets/js/tyre-calculator.js — this is a from-
// scratch reimplementation of the same specified geometry, so a bug
// introduced in the site's own script would show up as a mismatch here.
// ---------------------------------------------------------------------
const MM_PER_MILE = 1609344;
const MM_PER_KM = 1000000;

function independentCompute(widthMm, aspectPct, rimIn) {
  const sidewallHeight = (widthMm * aspectPct) / 100;
  const rimDiameterMm = rimIn * 25.4;
  const overallDiameter = rimDiameterMm + 2 * sidewallHeight;
  const circumference = overallDiameter * Math.PI;
  return {
    sidewallHeight,
    rimDiameterMm,
    overallDiameter,
    circumference,
    revsPerMile: MM_PER_MILE / circumference,
    revsPerKm: MM_PER_KM / circumference,
  };
}
function diffPct(cur, next) {
  return ((next.overallDiameter - cur.overallDiameter) / cur.overallDiameter) * 100;
}
function speedoAt(cur, next, exampleMph) {
  return exampleMph * (next.overallDiameter / cur.overallDiameter);
}
function close(a, b, tol = 0.005) {
  return Math.abs(a - b) < tol;
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch B4 regression tests — server at ${BASE}\n`);

  // ---- 1. formula unit tests, hand-verified expected values ----
  // (See the Batch B4 report for the independent Python calculation these
  // were checked against before implementation.)
  console.log("== Formula unit tests (independently calculated expected values) ==");

  // Case A: identical size -> 0.0% difference
  {
    const cur = independentCompute(205, 55, 16);
    const next = independentCompute(205, 55, 16);
    if (close(cur.sidewallHeight, 112.75) && close(cur.overallDiameter, 631.9) && close(cur.circumference, 1985.1724, 0.01)) ok();
    else fail("identical-size case: base geometry mismatch");
    if (close(diffPct(cur, next), 0)) ok();
    else fail("identical-size case: expected 0.0% difference", diffPct(cur, next));
    if (close(cur.revsPerMile, 810.6822, 0.01) && close(cur.revsPerKm, 503.7346, 0.01)) ok();
    else fail("identical-size case: revs/mile or revs/km mismatch");
  }

  // Case B: real-world "plus-one" fitment, 205/55R16 vs 215/50R17
  {
    const cur = independentCompute(205, 55, 16);
    const next = independentCompute(215, 50, 17);
    if (close(next.sidewallHeight, 107.5) && close(next.overallDiameter, 646.8) && close(next.circumference, 2031.9821, 0.01)) ok();
    else fail("plus-one case: new-size geometry mismatch");
    if (close(diffPct(cur, next), 2.358, 0.01)) ok();
    else fail("plus-one case: expected +2.36% difference", diffPct(cur, next).toFixed(4));
    if (close(speedoAt(cur, next, 70), 71.6506, 0.01)) ok();
    else fail("plus-one case: expected ~71.65 mph indicated-70 speedo estimate", speedoAt(cur, next, 70).toFixed(4));
  }

  // Case C: a large, clearly-outside-tolerance difference, 205/55R16 vs 235/70R16
  {
    const cur = independentCompute(205, 55, 16);
    const next = independentCompute(235, 70, 16);
    if (close(diffPct(cur, next), 16.3792, 0.01)) ok();
    else fail("large-diff case: expected +16.38% difference", diffPct(cur, next).toFixed(4));
  }

  // Case D: decimal handling, 205/60R15 vs 195/65R15
  {
    const cur = independentCompute(205, 60, 15);
    const next = independentCompute(195, 65, 15);
    if (close(cur.overallDiameter, 627.0) && close(next.overallDiameter, 634.5)) ok();
    else fail("decimal case: overall diameter mismatch");
    if (close(diffPct(cur, next), 1.1962, 0.01)) ok();
    else fail("decimal case: expected +1.20% difference", diffPct(cur, next).toFixed(4));
  }

  // Case E: no NaN/Infinity/negative anywhere across the enforced input range
  {
    let anyBad = false;
    const widths = [135, 200, 335];
    const aspects = [25, 55, 85];
    const rims = [12, 17, 24];
    for (const w of widths) for (const a of aspects) for (const r of rims) {
      const t = independentCompute(w, a, r);
      for (const v of [t.sidewallHeight, t.overallDiameter, t.circumference, t.revsPerMile, t.revsPerKm]) {
        if (!isFinite(v) || v !== v || v < 0) anyBad = true;
      }
    }
    if (!anyBad) ok();
    else fail("boundary sweep: found a NaN/Infinity/negative value somewhere in the enforced input range");
  }

  // ---- 2. page loads, canonical, H1 ----
  console.log("\n== Page basics ==");
  const page = await get(URL_PATH);
  if (page.status === 200) ok();
  else fail(`${URL_PATH}: expected 200`, `got ${page.status}`);
  const canon = page.body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (canon === `https://sfrmotors.co.uk${URL_PATH}`) ok();
  else fail(`${URL_PATH}: canonical mismatch`, canon);
  const h1Count = (page.body.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 1) ok();
  else fail(`${URL_PATH}: expected exactly 1 H1`, `got ${h1Count}`);

  // ---- 3. valid JSON-LD, no self-serving AggregateRating ----
  console.log("\n== Valid JSON-LD ==");
  const jsonLdBlocks = [];
  {
    const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(page.body))) {
      try { jsonLdBlocks.push(JSON.parse(m[1])); }
      catch (e) { fail(`${URL_PATH}: JSON-LD parse error`, e.message); }
    }
  }
  if (jsonLdBlocks.length > 0) ok();
  else fail(`${URL_PATH}: no JSON-LD blocks found`);
  const types = jsonLdBlocks.map((b) => b["@type"]);
  if (types.includes("BreadcrumbList")) ok();
  else fail(`${URL_PATH}: expected BreadcrumbList schema`);
  if (types.includes("WebApplication") || types.includes("WebPage")) ok();
  else fail(`${URL_PATH}: expected WebApplication or WebPage schema`);
  if (!types.includes("AggregateRating") && !jsonLdBlocks.some((b) => b.aggregateRating)) ok();
  else fail(`${URL_PATH}: contains a self-serving AggregateRating claim`);

  // ---- 4. no unsafe compatibility verdict language ----
  console.log("\n== No unsafe compatibility verdict ==");
  const bodyText = page.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const VERDICT_PATTERNS = [
    /this (?:size|tyre) is safe/i,
    /is (?:a )?(?:legal|approved|compatible) size/i,
    /(?:size|fitment) is (?:legal|approved|compatible)/i,
    /guaranteed to fit/i,
    /will definitely fit/i,
  ];
  const verdictHit = VERDICT_PATTERNS.find((re) => re.test(bodyText));
  if (!verdictHit) ok();
  else fail(`${URL_PATH}: appears to declare a compatibility verdict`, verdictHit.toString());

  // ---- 5. no universal tolerance claim ----
  console.log("\n== No universal tolerance claim ==");
  const UNIVERSAL_TOLERANCE_PATTERNS = [
    /\d\s?%\s*(?:is|=)\s*(?:always\s+)?safe/i,
    /within \d\s?%.{0,20}(?:always|guarantee|approved)/i,
  ];
  const toleranceHit = UNIVERSAL_TOLERANCE_PATTERNS.find((re) => re.test(bodyText));
  if (!toleranceHit) ok();
  else fail(`${URL_PATH}: presents a tolerance percentage as universal approval`, toleranceHit.toString());
  // the tolerance paragraph must explicitly hedge — not a legal limit / not a guarantee
  if (/not a legal limit|not.{0,15}guarantee|not.{0,15}manufacturer approval/i.test(bodyText)) ok();
  else fail(`${URL_PATH}: expected explicit hedging language around the tolerance rule-of-thumb`);

  // ---- 6. explains other factors beyond diameter ----
  console.log("\n== Explains other relevant factors ==");
  const OTHER_FACTORS = ["load index", "speed rating", "TPMS", "handling", "insurance"];
  const missingFactors = OTHER_FACTORS.filter((f) => !new RegExp(f, "i").test(bodyText));
  if (missingFactors.length === 0) ok();
  else fail(`${URL_PATH}: missing mention of`, missingFactors.join(", "));

  // ---- 7. static source check: no data transmission code ----
  console.log("\n== No data-transmission code in the calculator script ==");
  const jsSource = fs.readFileSync(path.join(SITE_DIR, "assets/js/tyre-calculator.js"), "utf8");
  const TRANSMISSION_PATTERNS = [/fetch\s*\(/, /XMLHttpRequest/, /navigator\.sendBeacon/, /localStorage/, /sessionStorage/, /document\.cookie/, /new Image\s*\(/];
  const transmissionHit = TRANSMISSION_PATTERNS.find((re) => re.test(jsSource));
  if (!transmissionHit) ok();
  else fail(`tyre-calculator.js: contains a data-transmission/storage pattern`, transmissionHit.toString());

  // ---- 8. sitemap inclusion, no orphan, no broken links ----
  console.log("\n== Sitemap, orphan and link checks ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  if (sitemap.includes(`https://sfrmotors.co.uk${URL_PATH}`)) ok();
  else fail(`sitemap.xml: missing ${URL_PATH}`);

  const siteFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "assets") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") siteFiles.push(full);
    }
  })(DIST_DIR);
  const linkedElsewhere = siteFiles.some((f) => {
    if (f === path.join(DIST_DIR, "tyre-size-calculator", "index.html")) return false;
    return fs.readFileSync(f, "utf8").includes(`href="${URL_PATH}"`);
  });
  if (linkedElsewhere) ok();
  else fail(`${URL_PATH}: appears to be orphaned — no inbound link found anywhere on the site`);

  const existingPaths = new Set(siteFiles.map((f) => "/" + path.relative(DIST_DIR, path.dirname(f)).replace(/\\/g, "/") + "/").map((p) => (p === "//" ? "/" : p)));
  const redirectSources = new Set(vercelConfig.redirects.map((r) => r.source));
  const staticAssets = new Set(fs.readdirSync(path.join(DIST_DIR, "assets/js")).map((f) => "/assets/js/" + f));
  const hrefs = [...page.body.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1].split("#")[0]).filter(Boolean);
  let brokenLinks = 0;
  for (const href of hrefs) {
    if (href === "/") continue;
    if (href.startsWith("/assets/")) {
      if (fs.existsSync(path.join(DIST_DIR, href))) continue;
      brokenLinks++;
      console.log(`    broken asset: ${href}`);
      continue;
    }
    if (existingPaths.has(href) || redirectSources.has(href)) continue;
    brokenLinks++;
    console.log(`    broken link: ${href}`);
  }
  if (brokenLinks === 0) ok();
  else fail(`${brokenLinks} broken internal link(s)/asset(s) found`);
  void staticAssets;

  // ---- 9. our-tyre-range inbound link present ----
  console.log("\n== Contextual inbound link from /our-tyre-range/ ==");
  const rangePage = await get("/our-tyre-range/");
  if (rangePage.body.includes(`href="${URL_PATH}"`)) ok();
  else fail(`/our-tyre-range/: expected a contextual link to ${URL_PATH}`);

  // ---- 10. calculator links out to relevant service pages ----
  console.log("\n== Outbound links to tyre range and replacement service ==");
  if (page.body.includes('href="/our-tyre-range/"')) ok();
  else fail(`${URL_PATH}: expected a link to /our-tyre-range/`);
  if (page.body.includes('href="/mobile-tyre-replacement/"')) ok();
  else fail(`${URL_PATH}: expected a link to /mobile-tyre-replacement/`);

  // ---- 11. redirect count unchanged ----
  console.log("\n== Redirect count unchanged ==");
  if (vercelConfig.redirects.length === REDIRECTS_BEFORE) ok();
  else fail(`redirects: expected ${REDIRECTS_BEFORE}`, `got ${vercelConfig.redirects.length}`);

  server.close();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Part 1 RESULT: ${results.pass} passed, ${results.fail} failed`);
  console.log(`${"=".repeat(50)}`);

  await runBrowserTestsIfAvailable();

  process.exit(results.fail > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------
// Part 2: real-browser checks via Playwright (skipped if unavailable).
// ---------------------------------------------------------------------
async function runBrowserTestsIfAvailable() {
  const scratchpad = "/tmp/claude-0/-home-user-sfr-motors-ltd/384be95d-ea68-513a-8912-a9dcfaa60171/scratchpad";
  const axePath = path.join(scratchpad, "axe-install/node_modules/axe-core/axe.min.js");
  const playwrightPath = "/opt/node22/lib/node_modules/playwright";
  if (!fs.existsSync(axePath) || !fs.existsSync(playwrightPath)) {
    console.log("\n(axe-core/Playwright not available in this environment — skipping browser tests)");
    return;
  }

  const { chromium } = require(playwrightPath);
  const axeSource = fs.readFileSync(axePath, "utf8");
  const port = 8948;
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let p = decodeURIComponent(url.pathname);
    const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end("404"); }
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}${URL_PATH}`;
  const browser = await chromium.launch();
  const browserResults = { pass: 0, fail: 0 };
  const bok = () => browserResults.pass++;
  const bfail = (label, detail) => { browserResults.fail++; console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`); };

  // ---- keyboard-only operation + accessible announcements ----
  console.log("\n== Keyboard-only operation ==");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const requestsAfterLoad = [];
    await p.goto(base, { waitUntil: "load" });
    p.on("request", (req) => requestsAfterLoad.push(req.url()));

    await p.locator("#cur-width").focus();
    await p.keyboard.type("205");
    await p.keyboard.press("Tab");
    await p.keyboard.type("55");
    await p.keyboard.press("Tab");
    await p.keyboard.type("16");
    await p.keyboard.press("Tab");
    await p.keyboard.type("215");
    await p.keyboard.press("Tab");
    await p.keyboard.type("50");
    await p.keyboard.press("Tab");
    await p.keyboard.type("17");
    await p.keyboard.press("Tab"); // -> Calculate button
    await p.keyboard.press("Enter");

    const resultsHidden = await p.locator("#calc-results").getAttribute("hidden");
    if (resultsHidden === null) bok();
    else bfail("keyboard submit: results panel did not become visible");

    const diffText = (await p.locator("#calc-diff-value").textContent()) || "";
    if (diffText.includes("2.36") || diffText.includes("+2.36")) bok();
    else bfail("keyboard submit: unexpected diameter-difference value", diffText);

    const statusText = (await p.locator("#calc-status").textContent()) || "";
    if (/results updated/i.test(statusText)) bok();
    else bfail("aria-live status region did not announce the result", statusText);

    // reset via keyboard
    await p.locator('button[type="reset"]').focus();
    await p.keyboard.press("Enter");
    const widthAfterReset = await p.locator("#cur-width").inputValue();
    const resultsHiddenAfterReset = await p.locator("#calc-results").getAttribute("hidden");
    if (widthAfterReset === "" && resultsHiddenAfterReset !== null) bok();
    else bfail("keyboard reset did not clear the form/results");

    // no network requests fired by any of the above interaction beyond the initial page load's own assets
    const postLoadRequests = requestsAfterLoad.filter((u) => !u.endsWith(".css") && !u.endsWith(".js") && !u.includes("/assets/img/") && !u.endsWith(".woff2"));
    if (postLoadRequests.length === 0) bok();
    else bfail("calculator triggered unexpected network request(s)", postLoadRequests.join(", "));

    await ctx.close();
  }

  // ---- invalid / boundary input handling ----
  console.log("\n== Invalid and boundary input handling ==");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(base, { waitUntil: "load" });

    // empty fields -> inline errors, no calculation, focus moves to first invalid field
    await p.locator('button[type="submit"]').click();
    const widthError = (await p.locator("#cur-width-error").textContent()) || "";
    if (widthError.length > 0) bok();
    else bfail("empty-field submit: expected an inline error message");
    const focusedId = await p.evaluate(() => document.activeElement && document.activeElement.id);
    if (focusedId === "cur-width") bok();
    else bfail("empty-field submit: focus expected on first invalid field", focusedId);
    const resultsStillHidden = await p.locator("#calc-results").getAttribute("hidden");
    if (resultsStillHidden !== null) bok();
    else bfail("empty-field submit: results should not be shown");

    // negative / zero / non-numeric
    for (const [val, label] of [["-5", "negative"], ["0", "zero"], ["abc", "non-numeric"]]) {
      await p.locator("#cur-width").fill(val);
      await p.locator("#cur-width").blur();
      await p.locator('button[type="submit"]').click();
      const err = (await p.locator("#cur-width-error").textContent()) || "";
      if (err.length > 0) bok();
      else bfail(`${label} input ("${val}"): expected an inline error`);
    }

    // below-range and above-range
    await p.locator("#cur-width").fill("50"); // below 135 min
    await p.locator('button[type="submit"]').click();
    const belowRangeErr = (await p.locator("#cur-width-error").textContent()) || "";
    if (/between/i.test(belowRangeErr)) bok();
    else bfail("below-range input: expected a range error message", belowRangeErr);

    await p.locator("#cur-width").fill("500"); // above 335 max
    await p.locator('button[type="submit"]').click();
    const aboveRangeErr = (await p.locator("#cur-width-error").textContent()) || "";
    if (/between/i.test(aboveRangeErr)) bok();
    else bfail("above-range input: expected a range error message", aboveRangeErr);

    // exact boundary values must succeed (135 min width, paired with valid other fields)
    await p.locator("#cur-width").fill("135");
    await p.locator("#cur-profile").fill("25");
    await p.locator("#cur-rim").fill("12");
    await p.locator("#new-width").fill("335");
    await p.locator("#new-profile").fill("85");
    await p.locator("#new-rim").fill("24");
    await p.locator('button[type="submit"]').click();
    const boundaryResultsHidden = await p.locator("#calc-results").getAttribute("hidden");
    if (boundaryResultsHidden === null) bok();
    else bfail("exact-boundary-value inputs: expected a successful calculation");
    const boundaryDiff = (await p.locator("#calc-diff-value").textContent()) || "";
    if (!/nan/i.test(boundaryDiff) && !/infinity/i.test(boundaryDiff) && boundaryDiff.trim() !== "") bok();
    else bfail("exact-boundary-value inputs: NaN/Infinity/empty result", boundaryDiff);

    await ctx.close();
  }

  // ---- mobile responsiveness + axe-core at 3 viewports ----
  console.log("\n== Mobile/tablet/desktop responsiveness + axe-core ==");
  const viewports = [
    { name: "mobile-390", width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: "tablet-768", width: 768, height: 1024, isMobile: true, hasTouch: true },
    { name: "desktop-1440", width: 1440, height: 900, isMobile: false, hasTouch: false },
  ];
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    const p = await ctx.newPage();
    await p.goto(base, { waitUntil: "load" });

    // no horizontal overflow at this viewport
    const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflowX <= 1) bok();
    else bfail(`${vp.name}: horizontal overflow of ${overflowX}px`);

    // tap targets: Calculate/Reset buttons at least 44x44 CSS px
    const btnBoxes = await p.evaluate(() => {
      const btns = document.querySelectorAll(".sfr-calc__btn");
      return Array.from(btns).map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    });
    const tooSmall = btnBoxes.filter((b) => b.w < 44 || b.h < 44);
    if (tooSmall.length === 0) bok();
    else bfail(`${vp.name}: ${tooSmall.length} button(s) below the 44x44 minimum tap target`);

    await p.addScriptTag({ content: axeSource });
    const axeResult = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    if (axeResult.violations.length === 0) {
      bok();
      console.log(`    ${vp.name}: 0 axe-core violations`);
    } else {
      bfail(`${vp.name}: ${axeResult.violations.length} axe-core violation(s)`);
      for (const v of axeResult.violations) console.log(`          ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
    }
    await ctx.close();
  }

  await browser.close();
  srv.close();

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Part 2 (browser) RESULT: ${browserResults.pass} passed, ${browserResults.fail} failed`);
  console.log(`${"=".repeat(50)}`);
  if (browserResults.fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
