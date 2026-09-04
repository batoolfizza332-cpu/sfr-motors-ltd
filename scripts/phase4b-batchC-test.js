#!/usr/bin/env node
// Phase 4B Batch C regression tests — the two cannibalisation
// consolidations and the locking-wheel-nut industry-practice rewrite:
//   Survivors:
//     /tyre-lifespan/
//     /why-professional-mobile-tyre-services-are-essential-for-modern-drivers/
//     /locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/
//   Retired (301 only, never a live page):
//     /tyre-lifespan-mobile-tyre-repair-guide/
//     /why-professional-mobile-tyre-services-are-information-to-all-drivers/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js and scripts/phase4-test.js, which cover
// these pages generically (sitemap inclusion, canonical self-match,
// single H1, no duplicate titles/meta, valid JSON-LD, no orphan pages,
// redirect single-hop). This file adds the Batch-C-specific safety and
// content assertions requested for this batch.
//
// Run: `node scripts/phase4b-batchC-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8949;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 19; // 17 after the Batch B2 correction, +2 from this batch
const EXPECTED_PAGE_COUNT = 70; // 64 after Batch C, +6 new Batch D1 pages (Batch C itself added 3, from 61 after Batch B4)

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

const SURVIVORS = [
  "/tyre-lifespan/",
  "/why-professional-mobile-tyre-services-are-essential-for-modern-drivers/",
  "/locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/",
];
const RETIRED_PAIRS = [
  ["/tyre-lifespan-mobile-tyre-repair-guide/", "/tyre-lifespan/"],
  ["/why-professional-mobile-tyre-services-are-information-to-all-drivers/", "/why-professional-mobile-tyre-services-are-essential-for-modern-drivers/"],
];

function extractJsonLd(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    try { blocks.push(JSON.parse(m[1])); }
    catch (e) { blocks.push({ __parseError: e.message }); }
  }
  return blocks;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mainContentHtml(html) {
  const after = html.split('class="sfr-legal__body"')[1] || "";
  const closeMatch = after.match(/<\/div>\s*<\/div>\s*<\/section>/);
  return closeMatch ? after.slice(0, closeMatch.index) : after;
}

function paragraphs(html) {
  return [...mainContentHtml(html).matchAll(/<p[^>]*>([^<]{40,})<\/p>/g)].map((m) => m[1].trim());
}

const COMPETITOR_PATTERN = /hometyre|tyresonthedrive|tyres on the drive|halfords|laser tools/i;
const FIXED_MILEAGE_PATTERN = /\d[\d,]*\s*(?:to|-|–|—)\s*\d[\d,]*\s*miles/i;
const FRONT_REAR_SPLIT_PATTERN = /front tyres?.{0,40}rear tyres?|rear tyres?.{0,40}front tyres?/i;
const DESTRUCTIVE_INSTRUCTION_PATTERNS = [
  /hammer(?:ed|ing)? (?:a |the )?(?:brass |sharp )?(?:puck|insert|socket) (?:onto|into)/i,
  /drill(?:ing)? (?:the|a) (?:nut|lock)/i,
  /chisel/i,
  /breaking the metal surface/i,
];
const LIABILITY_WAIVER_PATTERNS = [
  /disclaimer.{0,40}(?:removes?|waives?|releases?).{0,20}(?:liability|responsibility|legal)/i,
  /(?:liability|responsibility).{0,20}(?:removed|waived|released).{0,20}disclaimer/i,
  /sign(?:ing)? (?:this|the) (?:disclaimer|form).{0,30}(?:protects? us|absolves?)/i,
];
const GARBLED_FRAGMENT_PATTERNS = [/tyrerui/i, /fleet support/i];

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch C regression tests — server at ${BASE}\n`);

  const pageData = {};

  // ---- 1. survivors + industry article return 200 ----
  console.log("== Survivor pages: 200 ==");
  for (const p of SURVIVORS) {
    const res = await get(p);
    if (res.status === 200) ok();
    else fail(`${p}: expected 200`, `got ${res.status}`);
    pageData[p] = res;
  }

  // ---- 2. retired URLs: direct single-hop 301, no chain ----
  console.log("\n== Retired duplicate URLs: direct 301, no chain ==");
  for (const [retired, survivor] of RETIRED_PAIRS) {
    const res = await get(retired);
    if (res.status === 301 && res.headers.location === survivor) ok();
    else fail(`${retired}: expected 301 -> ${survivor}`, `got ${res.status} ${res.headers.location || ""}`);
    if (!vercelConfig.redirects.some((r) => r.source === survivor)) ok();
    else fail(`${survivor}: is itself a redirect source — this would be a chain from ${retired}`);
    if (!fs.existsSync(path.join(DIST_DIR, retired.slice(1, -1), "index.html"))) ok();
    else fail(`${retired}: page file still exists in dist/ — it should never have been created`);
  }

  // ---- 3. self-referencing canonicals, one H1 ----
  console.log("\n== Canonicals and H1 ==");
  for (const p of SURVIVORS) {
    const canon = pageData[p].body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (canon === `https://sfrmotors.co.uk${p}`) ok();
    else fail(`${p}: canonical mismatch`, canon);
    const h1Count = (pageData[p].body.match(/<h1[\s>]/g) || []).length;
    if (h1Count === 1) ok();
    else fail(`${p}: expected exactly 1 H1`, `got ${h1Count}`);
  }

  // ---- 4. unique titles and meta descriptions across the three survivors ----
  console.log("\n== Unique titles and meta descriptions ==");
  const titles = new Map();
  const descs = new Map();
  for (const p of SURVIVORS) {
    const title = pageData[p].body.match(/<title>([^<]*)<\/title>/)?.[1];
    const desc = pageData[p].body.match(/name="description" content="([^"]*)"/)?.[1];
    if (!title) fail(`${p}: missing <title>`);
    else if (titles.has(title)) fail(`${p}: duplicate title`, `also used by ${titles.get(title)}`);
    else { titles.set(title, p); ok(); }
    if (!desc) fail(`${p}: missing meta description`);
    else if (descs.has(desc)) fail(`${p}: duplicate meta description`, `also used by ${descs.get(desc)}`);
    else { descs.set(desc, p); ok(); }
  }

  // ---- 5. valid JSON-LD ----
  console.log("\n== Valid JSON-LD ==");
  const jsonLd = {};
  for (const p of SURVIVORS) {
    const blocks = extractJsonLd(pageData[p].body);
    jsonLd[p] = blocks;
    if (blocks.length === 0) { fail(`${p}: no JSON-LD blocks found`); continue; }
    let allOk = true;
    for (const b of blocks) if (b.__parseError) { fail(`${p}: JSON-LD parse error`, b.__parseError); allOk = false; }
    if (allOk) ok();
    const types = blocks.map((b) => b["@type"]).filter(Boolean);
    if (types.includes("BreadcrumbList") && types.includes("Article")) ok();
    else fail(`${p}: expected BreadcrumbList + Article schema`, types.join(","));
  }

  // ---- 6. no copied paragraphs between the three survivors ----
  console.log("\n== No duplicate substantive paragraphs between the three survivors ==");
  const paraSets = SURVIVORS.map((p) => ({ url: p, paras: paragraphs(pageData[p].body) }));
  let dup = false;
  for (let i = 0; i < paraSets.length; i++) {
    for (let j = i + 1; j < paraSets.length; j++) {
      const shared = paraSets[i].paras.filter((p) => paraSets[j].paras.includes(p));
      if (shared.length > 0) { dup = true; fail(`${paraSets[i].url} and ${paraSets[j].url} share an identical paragraph`, shared[0].slice(0, 80)); }
    }
  }
  if (!dup) ok();

  // ---- 7. tyre-lifespan: no fixed mileage, no front/rear split, correct legal-minimum framing ----
  console.log("\n== /tyre-lifespan/: no fixed mileage claim, no front/rear split ==");
  {
    const text = stripTags(mainContentHtml(pageData["/tyre-lifespan/"].body));
    if (!FIXED_MILEAGE_PATTERN.test(text)) ok();
    else fail("/tyre-lifespan/: appears to state a fixed mileage range", text.match(FIXED_MILEAGE_PATTERN)?.[0]);
    if (!FRONT_REAR_SPLIT_PATTERN.test(text)) ok();
    else fail("/tyre-lifespan/: appears to publish a front/rear mileage split");
    if (/1\.6\s?mm/i.test(text)) ok();
    else fail("/tyre-lifespan/: expected the UK legal tread-depth figure (1.6mm)");
    if (/legal minimum, not a target|not a target/i.test(text)) ok();
    else fail("/tyre-lifespan/: expected explicit wording that 1.6mm is a minimum, not an ideal replacement target");
    for (const factor of ["vehicle", "tyre type", "drivetrain", "load", "pressure", "alignment", "road", "damage", "maintenance", "driving style"]) {
      if (new RegExp(factor.replace(" ", "\\s"), "i").test(text)) ok();
      else fail(`/tyre-lifespan/: expected mention of "${factor}" as a variability factor`);
    }
  }

  // ---- 8. why-professional: correct company message, no garbled fragments ----
  console.log("\n== Why-professional survivor: correct SFR message, no garbled fragments ==");
  {
    const text = stripTags(pageData["/why-professional-mobile-tyre-services-are-essential-for-modern-drivers/"].body);
    if (/secure\.?\s*fast\.?\s*reliable/i.test(text)) ok();
    else fail("why-professional survivor: expected the correct 'Secure. Fast. Reliable.' motto");
    const garbledHit = GARBLED_FRAGMENT_PATTERNS.find((re) => re.test(text));
    if (!garbledHit) ok();
    else fail("why-professional survivor: contains a garbled/incorrect fragment from the original export", garbledHit.toString());
  }

  // ---- 9. no named competitors anywhere across the three survivors ----
  console.log("\n== No named competitors ==");
  for (const p of SURVIVORS) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!COMPETITOR_PATTERN.test(text)) ok();
    else fail(`${p}: appears to name a competitor or specific commercial product`, text.match(COMPETITOR_PATTERN)?.[0]);
  }

  // ---- 10. locking-wheel-nut industry article: no destructive instructions, no liability-waiver framing ----
  console.log("\n== Locking-wheel-nut industry article: no destructive instructions, no liability-waiver claim ==");
  {
    const text = stripTags(mainContentHtml(pageData["/locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/"].body));
    const destructiveHit = DESTRUCTIVE_INSTRUCTION_PATTERNS.find((re) => re.test(text));
    if (!destructiveHit) ok();
    else fail("locking-wheel-nut industry article: contains a destructive removal instruction", destructiveHit.toString());
    const waiverHit = LIABILITY_WAIVER_PATTERNS.find((re) => re.test(text));
    if (!waiverHit) ok();
    else fail("locking-wheel-nut industry article: implies a disclaimer removes legal responsibility", waiverHit.toString());
    if (/hammer/i.test(text)) fail("locking-wheel-nut industry article: mentions hammering — should stay at a high level, no technique detail");
    else ok();
    if (pageData["/locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/"].body.includes('href="/mobile-locking-wheel-nut-removal/"')) ok();
    else fail("locking-wheel-nut industry article: expected a link to /mobile-locking-wheel-nut-removal/");
  }

  // ---- 11. FAQ schema matches visible FAQs (industry article only) ----
  console.log("\n== FAQ schema matches visible FAQs ==");
  {
    const p = "/locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/";
    const html = pageData[p].body;
    const faqBlock = jsonLd[p].find((b) => b["@type"] === "FAQPage");
    if (faqBlock) {
      const schemaQuestions = faqBlock.mainEntity.map((q) => q.name);
      const visibleQuestions = [...html.matchAll(/<span class="sfr-faq__q">([^<]*)<\/span>/g)].map((m) => m[1]);
      if (visibleQuestions.length === schemaQuestions.length && visibleQuestions.every((q, i) => q === schemaQuestions[i])) ok();
      else fail(`${p}: visible FAQ questions don't match schema`);
    } else {
      fail(`${p}: expected an FAQPage schema block`);
    }
    for (const other of ["/tyre-lifespan/", "/why-professional-mobile-tyre-services-are-essential-for-modern-drivers/"]) {
      const hasFaqSchema = jsonLd[other].some((b) => b["@type"] === "FAQPage");
      const hasVisibleFaq = /class="sfr-faq__item"/.test(pageData[other].body);
      if (!hasFaqSchema && !hasVisibleFaq) ok();
      else fail(`${other}: FAQ schema/visible-FAQ mismatch`);
    }
  }

  // ---- 12. phone and WhatsApp links present ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of SURVIVORS) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 13. no broken internal links, no stale links to either retired URL ----
  console.log("\n== No broken internal links / no stale links to retired URLs ==");
  const siteFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "assets") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") siteFiles.push(full);
    }
  })(DIST_DIR);
  const existingPaths = new Set(siteFiles.map((f) => "/" + path.relative(DIST_DIR, path.dirname(f)).replace(/\\/g, "/") + "/").map((p) => (p === "//" ? "/" : p)));
  const redirectSources = new Set(vercelConfig.redirects.map((r) => r.source));
  let brokenLinks = 0;
  for (const p of SURVIVORS) {
    const hrefs = [...pageData[p].body.matchAll(/href="(\/[a-z0-9\-\/#]*)"/gi)].map((m) => m[1].split("#")[0]).filter(Boolean);
    for (const href of hrefs) {
      if (href === "/") continue;
      if (existingPaths.has(href) || redirectSources.has(href)) continue;
      brokenLinks++;
      console.log(`    broken link on ${p}: ${href}`);
    }
  }
  if (brokenLinks === 0) ok();
  else fail(`${brokenLinks} broken internal link(s) found`);

  let staleLinks = 0;
  for (const f of siteFiles) {
    const html = fs.readFileSync(f, "utf8");
    for (const [retired] of RETIRED_PAIRS) {
      if (html.includes(`href="${retired}"`)) {
        staleLinks++;
        console.log(`    stale link to ${retired} in: ${path.relative(DIST_DIR, f)}`);
      }
    }
  }
  if (staleLinks === 0) ok();
  else fail(`${staleLinks} file(s) still link to a retired URL`);

  // ---- 14. no orphan pages ----
  console.log("\n== No orphan pages ==");
  for (const p of SURVIVORS) {
    const linkedElsewhere = siteFiles.some((f) => {
      if (f === path.join(DIST_DIR, p.slice(1, -1), "index.html")) return false;
      return fs.readFileSync(f, "utf8").includes(`href="${p}"`);
    });
    if (linkedElsewhere) ok();
    else fail(`${p}: appears to be orphaned — no inbound link found anywhere on the site`);
  }

  // ---- 15. sitemap : page inventory 1:1, retired URLs absent, expected total ----
  console.log("\n== Sitemap, page inventory and totals ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of SURVIVORS) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  for (const [retired] of RETIRED_PAIRS) {
    if (!sitemapUrls.includes(retired)) ok();
    else fail(`sitemap.xml: still contains the retired ${retired}`);
  }
  if (siteFiles.length === EXPECTED_PAGE_COUNT) ok();
  else fail(`expected exactly ${EXPECTED_PAGE_COUNT} pages after Batch C`, `got ${siteFiles.length}`);

  // ---- 16. redirect count is 19 ----
  console.log("\n== Redirect count ==");
  if (vercelConfig.redirects.length === REDIRECTS_BEFORE) ok();
  else fail(`redirects: expected ${REDIRECTS_BEFORE}`, `got ${vercelConfig.redirects.length}`);

  server.close();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULT: ${results.pass} passed, ${results.fail} failed`);
  console.log(`${"=".repeat(50)}`);

  await runAxeIfAvailable();

  process.exit(results.fail > 0 ? 1 : 0);
}

async function runAxeIfAvailable() {
  const scratchpad = "/tmp/claude-0/-home-user-sfr-motors-ltd/384be95d-ea68-513a-8912-a9dcfaa60171/scratchpad";
  const axePath = path.join(scratchpad, "axe-install/node_modules/axe-core/axe.min.js");
  const playwrightPath = "/opt/node22/lib/node_modules/playwright";
  if (!fs.existsSync(axePath) || !fs.existsSync(playwrightPath)) {
    console.log("\n(axe-core/Playwright not available in this environment — skipping mobile accessibility pass)");
    return;
  }
  console.log("\n== Mobile-viewport accessibility (axe-core, 390x844) ==");
  const { chromium } = require(playwrightPath);
  const axeSource = fs.readFileSync(axePath, "utf8");
  const port = 8950;
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
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let violations = 0;
  for (const p of SURVIVORS) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}${p}`, { waitUntil: "load" });
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    if (result.violations.length === 0) {
      console.log(`  OK    ${p}: 0 violations`);
    } else {
      violations += result.violations.length;
      console.log(`  FAIL  ${p}: ${result.violations.length} violation(s)`);
      for (const v of result.violations) console.log(`          ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
    }
    await page.close();
  }
  await browser.close();
  srv.close();
  console.log(violations === 0 ? "\naxe-core: 0 violations across all 3 survivor pages at mobile viewport" : `\naxe-core: ${violations} total violation(s) found`);
  if (violations > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
