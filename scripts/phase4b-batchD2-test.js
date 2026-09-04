#!/usr/bin/env node
// Phase 4B Batch D2 regression tests — six new blog posts, each recreated
// at its exact original WordPress URL:
//   /premium-or-budget-which-tyres-keep-you-safer/
//   /puncture-repairs-whats-actually-being-done-to-your-tyre/
//   /mobile-tyre-fitter-near-me-myths/
//   /michelin-radial-tire-history-innovation/
//   /pirelli-silent-tyres-uk/
//   /tyre-care-and-flat-tyre-help-in-linlithgow/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js
// and scripts/phase4-test.js, which cover these pages generically (sitemap
// inclusion, canonical self-match, single H1, no duplicate titles/meta,
// valid JSON-LD, no orphan pages, no broken links) via dynamic, non-brittle
// site-wide sweeps. This file adds the Batch-D2-specific safety and content
// assertions requested for this batch, including the Michelin/Pirelli
// source-attribution checks and the Linlithgow competitor/landmark/
// response-time removals.
//
// Per the Batch D2 instruction, this suite carries the CURRENT page/redirect
// totals as its own baseline (76 pages, 19 redirects) — a future batch that
// adds more pages should convert these to floor checks (as Batches C and D1
// were converted during this batch's cleanup), not keep bumping the exact
// figure here.
//
// Run: `node scripts/phase4b-batchD2-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8953;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 19; // unchanged by Batch D2 — six exact-URL recreations, no redirects added
const EXPECTED_PAGE_COUNT = 76; // 70 after Batch D1, +6 new Batch D2 pages — this batch's own current total

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

const NEW_PAGES = [
  "/premium-or-budget-which-tyres-keep-you-safer/",
  "/puncture-repairs-whats-actually-being-done-to-your-tyre/",
  "/mobile-tyre-fitter-near-me-myths/",
  "/michelin-radial-tire-history-innovation/",
  "/pirelli-silent-tyres-uk/",
  "/tyre-care-and-flat-tyre-help-in-linlithgow/",
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

// ---- unsupported prices / response-times / superlatives / customer-counts ----
const INVENTED_CLAIM_PATTERNS = [
  /£\d/,
  /\$\d/,
  /\barrival time\b.{0,20}\d+\s*minutes?/i,
  /within \d+\s*minutes?/i,
  /\d+%\s*of\s*(?:uk\s*)?drivers/i,
  /rated 5 stars?/i,
  /thousands of (?:uk\s*)?(?:drivers|customers)/i,
  /nationwide/i,
  /uk'?s most trusted/i,
  /award[- ]winning/i,
  /guaranteed (?:5|five)[- ]star/i,
  /\d+\s*google reviews?/i,
];

// ---- named competitors (national + the specific Linlithgow garages) ----
const COMPETITOR_PATTERN = /hometyre|tyresonthedrive|tyres on the drive|halfords|laser tools|hunters of linlithgow|regent motors/i;

// ---- unsafe roadside-repair / DIY procedure instructions ----
const UNSAFE_PROCEDURE_PATTERNS = [
  /jack (?:up|the car|it up)/i,
  /lug wrench/i,
  /loosen(?:ing)? the (?:wheel )?nuts?/i,
  /place the jack under/i,
  /remove the spare (?:wheel|tyre) and/i,
  /insert the (?:string|plug)/i,
  /push (?:it|the plug|the string) into the hole/i,
];

// ---- unsupported seasonal tread threshold (see the Phase 4B Batch D1 correction) ----
const UNSUPPORTED_SEASONAL_THRESHOLD_PATTERN = /2\s?mm[\s\S]{0,60}summer[\s\S]{0,60}3\s?mm[\s\S]{0,60}winter|3\s?mm[\s\S]{0,60}winter[\s\S]{0,60}2\s?mm[\s\S]{0,60}summer|official guidance suggests[\s\S]{0,60}(?:2|3)\s?mm/i;

// ---- BS AU 159 must not be cited with precise provisions (safest: not cited at all) ----
const BS_AU_159_PATTERN = /bs\s?au\s?159/i;

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch D2 regression tests — server at ${BASE}\n`);

  const pageData = {};

  // ---- 1. all six new pages return 200 ----
  console.log("== New pages: 200 ==");
  for (const p of NEW_PAGES) {
    const res = await get(p);
    if (res.status === 200) ok();
    else fail(`${p}: expected 200`, `got ${res.status}`);
    pageData[p] = res;
  }

  // ---- 2. self-referencing canonicals, one H1 ----
  console.log("\n== Canonicals and H1 ==");
  for (const p of NEW_PAGES) {
    const canon = pageData[p].body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (canon === `https://sfrmotors.co.uk${p}`) ok();
    else fail(`${p}: canonical mismatch`, canon);
    const h1Count = (pageData[p].body.match(/<h1[\s>]/g) || []).length;
    if (h1Count === 1) ok();
    else fail(`${p}: expected exactly 1 H1`, `got ${h1Count}`);
  }

  // ---- 3. unique titles and meta descriptions across the six new pages ----
  console.log("\n== Unique titles and meta descriptions ==");
  const titles = new Map();
  const descs = new Map();
  for (const p of NEW_PAGES) {
    const title = pageData[p].body.match(/<title>([^<]*)<\/title>/)?.[1];
    const desc = pageData[p].body.match(/name="description" content="([^"]*)"/)?.[1];
    if (!title) fail(`${p}: missing <title>`);
    else if (titles.has(title)) fail(`${p}: duplicate title`, `also used by ${titles.get(title)}`);
    else { titles.set(title, p); ok(); }
    if (!desc) fail(`${p}: missing meta description`);
    else if (descs.has(desc)) fail(`${p}: duplicate meta description`, `also used by ${descs.get(desc)}`);
    else { descs.set(desc, p); ok(); }
  }

  // ---- 4. valid JSON-LD, BreadcrumbList + Article ----
  console.log("\n== Valid JSON-LD ==");
  const jsonLd = {};
  for (const p of NEW_PAGES) {
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

  // ---- 5. no unsupported prices, response-times, superlatives, customer/review counts, nationwide claims ----
  console.log("\n== No unsupported prices, response-times, superlatives or customer-count claims ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = INVENTED_CLAIM_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains an unsupported/invented claim`, hit.toString());
  }

  // ---- 6. no named competitors (national or the specific Linlithgow garages) ----
  console.log("\n== No named competitors ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!COMPETITOR_PATTERN.test(text)) ok();
    else fail(`${p}: appears to name a competitor`, text.match(COMPETITOR_PATTERN)?.[0]);
  }

  // ---- 7. no unsafe roadside-repair / DIY procedure instructions ----
  console.log("\n== No unsafe roadside-repair instructions ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = UNSAFE_PROCEDURE_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: appears to contain an unsafe/DIY roadside-repair instruction`, hit.toString());
  }

  // ---- 8. no unsupported seasonal tread threshold, no uncited BS AU 159 provisions ----
  console.log("\n== No unsupported seasonal tread threshold, no uncited BS AU 159 provisions ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!UNSUPPORTED_SEASONAL_THRESHOLD_PATTERN.test(text)) ok();
    else fail(`${p}: contains the unsupported "2mm summer / 3mm winter" GOV.UK attribution`);
    if (!BS_AU_159_PATTERN.test(text)) ok();
    else fail(`${p}: cites BS AU 159 — precise provisions are not verified for this site, so it should not be cited`);
  }

  // ---- 9. premium-or-budget: no automatic-safety claim, no 50% stat, verified tread wording ----
  console.log("\n== Premium-or-budget article: no automatic-safety claim, verified tread wording ==");
  {
    const p = "/premium-or-budget-which-tyres-keep-you-safer/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/premium tyres? (?:are|is) (?:always |automatically )?safer/i.test(text)) ok();
    else fail(`${p}: appears to claim premium tyres are automatically safer`);
    if (!/50%/.test(text)) ok();
    else fail(`${p}: contains the unsupported "50%" handling/braking figure`);
    if (/1\.6\s?mm/i.test(text)) ok();
    else fail(`${p}: expected the UK legal tread-depth figure (1.6mm)`);
    if (/doesn'?t automatically mean|not (?:a )?guarantee|isn'?t a (?:safety )?guarantee/i.test(text)) ok();
    else fail(`${p}: expected wording that price/legal minimum isn't a safety guarantee on its own`);
    if (pageData[p].body.includes('href="/our-tyre-range/"')) ok();
    else fail(`${p}: expected a link to /our-tyre-range/`);
  }

  // ---- 10. puncture-repairs: no content-brief artifact, no price, high-level only ----
  console.log("\n== Puncture-repairs article: no artifact, no price, no DIY steps ==");
  {
    const p = "/puncture-repairs-whats-actually-being-done-to-your-tyre/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/target keywords?:|^url:\s*\//im.test(text)) ok();
    else fail(`${p}: appears to contain leftover content-brief/artifact text`);
    if (/not every puncture|can'?t be safely repaired|isn'?t repairable/i.test(text)) ok();
    else fail(`${p}: expected clear wording that not every puncture is safely repairable`);
    if (pageData[p].body.includes('href="/mobile-tyre-puncture-repair/"')) ok();
    else fail(`${p}: expected a link to /mobile-tyre-puncture-repair/`);
  }

  // ---- 11. myths article: no "2025" framing, consistent service area ----
  console.log("\n== Myths article: no outdated year, consistent service area ==");
  {
    const p = "/mobile-tyre-fitter-near-me-myths/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/\b2025\b/.test(text)) ok();
    else fail(`${p}: still contains the outdated "2025" framing`);
    if (/bathgate/i.test(text) && /edinburgh/i.test(text) && /west lothian/i.test(text)) ok();
    else fail(`${p}: expected the site's standard service-area wording (Bathgate, Edinburgh, West Lothian)`);
  }

  // ---- 12. Michelin article: verified facts present, unverified narrative removed, no endorsement claim ----
  console.log("\n== Michelin article: verified facts only, no endorsement claim ==");
  {
    const p = "/michelin-radial-tire-history-innovation/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (/4 june 1946/i.test(text)) ok();
    else fail(`${p}: expected the verified patent date (4 June 1946)`);
    if (/pierre-marcel bourdon/i.test(text)) ok();
    else fail(`${p}: expected the verified patent filer (Pierre-Marcel Bourdon)`);
    if (/194[89]/.test(text)) ok();
    else fail(`${p}: expected the verified Michelin X launch period (1948-1949)`);
    if (!/paolo ferrini|puiseux|mignol/i.test(text)) ok();
    else fail(`${p}: still contains the unverified Paolo Ferrini/Puiseux/Mignol narrative`);
    if (!/official (?:michelin )?partner|authorised michelin|sponsored by michelin|in partnership with michelin/i.test(text)) ok();
    else fail(`${p}: appears to imply a Michelin endorsement or partnership`);
  }

  // ---- 13. Pirelli article: PNCS claim attributed to Pirelli, no unsupported citations, no stock claim, no endorsement ----
  console.log("\n== Pirelli article: attributed PNCS claim only, no unsupported citations, no stock/endorsement claim ==");
  {
    const p = "/pirelli-silent-tyres-uk/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (/2.3 decibels|2–3 decibels|2-3 decibels|around 2.3|2&ndash;3/i.test(text) && /pirelli/i.test(text)) ok();
    else fail(`${p}: expected the verified ~2-3dB PNCS claim, attributed to Pirelli`);
    if (/pirelli'?s own|according to pirelli|pirelli reports|pirelli'?s published/i.test(text)) ok();
    else fail(`${p}: expected explicit attribution of the noise-reduction figure to Pirelli`);
    if (!/ukhsa|uk health security agency|etrma|mclaren life|forum/i.test(text)) ok();
    else fail(`${p}: still contains an unsupported UKHSA/ETRMA/forum citation`);
    if (!/we stock pncs|we fit pncs|our pncs (?:tyres|stock)/i.test(text)) ok();
    else fail(`${p}: appears to claim SFR stocks/fits PNCS tyres without confirmation`);
    if (/confirm.{0,30}(?:when you call|availability)|check(?:ing)? availability/i.test(text)) ok();
    else fail(`${p}: expected wording that availability/compatibility is confirmed when the customer calls`);
    if (!/official (?:pirelli )?partner|authorised pirelli|sponsored by pirelli|in partnership with pirelli/i.test(text)) ok();
    else fail(`${p}: appears to imply a Pirelli endorsement or partnership`);
  }

  // ---- 14. Linlithgow article: no competitor garages, no unverified landmarks, no fixed arrival promise, links to the location page ----
  console.log("\n== Linlithgow article: no competitor garages/landmarks/arrival promise ==");
  {
    const p = "/tyre-care-and-flat-tyre-help-in-linlithgow/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/water yett|stockbridge retail park|regent centre car park/i.test(text)) ok();
    else fail(`${p}: still names a specific unverified local car park/landmark`);
    if (!/within 45 minutes|45[- ]minute/i.test(text)) ok();
    else fail(`${p}: still contains a fixed arrival-time promise`);
    if (pageData[p].body.includes('href="/mobile-tyre-fitting-linlithgow/"')) ok();
    else fail(`${p}: expected a link to /mobile-tyre-fitting-linlithgow/`);
  }

  // ---- 15. cannibalisation: no duplicate substantive paragraphs against related pages ----
  console.log("\n== Cannibalisation: related pages remain differentiated ==");
  const relatedGroups = [
    ["/premium-or-budget-which-tyres-keep-you-safer/", "/our-tyre-range/", "/how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/"],
    ["/puncture-repairs-whats-actually-being-done-to-your-tyre/", "/mobile-tyre-puncture-repair/", "/tyre-services-west-lothian/"],
    ["/mobile-tyre-fitter-near-me-myths/", "/mobile-tyre-fitting/", "/best-mobile-tyre-fitters-bathgate/"],
    ["/tyre-care-and-flat-tyre-help-in-linlithgow/", "/mobile-tyre-fitting-linlithgow/", "/professional-mobile-tyre-services-on-drivers-linlithgow/"],
  ];
  for (const group of relatedGroups) {
    const bodies = {};
    for (const p of group) {
      if (pageData[p]) { bodies[p] = pageData[p].body; continue; }
      const filePath = path.join(DIST_DIR, p.slice(1, -1), "index.html");
      bodies[p] = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    }
    const paraSets = group.map((p) => ({ url: p, paras: paragraphs(bodies[p]) }));
    let dup = false;
    for (let i = 0; i < paraSets.length; i++) {
      for (let j = i + 1; j < paraSets.length; j++) {
        const shared = paraSets[i].paras.filter((pp) => paraSets[j].paras.includes(pp));
        if (shared.length > 0) { dup = true; fail(`${paraSets[i].url} and ${paraSets[j].url} share an identical paragraph`, shared[0].slice(0, 80)); }
      }
    }
    if (!dup) ok();
  }

  // ---- 16. phone and WhatsApp links present ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of NEW_PAGES) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 17. no broken internal links from the six new pages ----
  console.log("\n== No broken internal links ==");
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
  for (const p of NEW_PAGES) {
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

  // ---- 18. each new page has at least one relevant outbound link to an existing SFR page ----
  console.log("\n== Relevant outbound links to existing SFR pages ==");
  const EXPECTED_OUTBOUND = {
    "/premium-or-budget-which-tyres-keep-you-safer/": "/our-tyre-range/",
    "/puncture-repairs-whats-actually-being-done-to-your-tyre/": "/mobile-tyre-puncture-repair/",
    "/mobile-tyre-fitter-near-me-myths/": "/emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key/",
    "/michelin-radial-tire-history-innovation/": "/our-tyre-range/",
    "/pirelli-silent-tyres-uk/": "/our-tyre-range/",
    "/tyre-care-and-flat-tyre-help-in-linlithgow/": "/mobile-tyre-fitting-linlithgow/",
  };
  for (const [p, target] of Object.entries(EXPECTED_OUTBOUND)) {
    if (pageData[p].body.includes(`href="${target}"`)) ok();
    else fail(`${p}: expected an outbound link to ${target}`);
  }

  // ---- 19. no orphan pages — each of the six has at least one inbound link from elsewhere on the site (beyond /blog/) ----
  console.log("\n== No orphan pages ==");
  for (const p of NEW_PAGES) {
    const linkedElsewhere = siteFiles.some((f) => {
      if (f === path.join(DIST_DIR, p.slice(1, -1), "index.html")) return false;
      if (path.relative(DIST_DIR, f) === path.join("blog", "index.html")) return false;
      return fs.readFileSync(f, "utf8").includes(`href="${p}"`);
    });
    if (linkedElsewhere) ok();
    else fail(`${p}: appears to be orphaned — no inbound link found anywhere on the site beyond /blog/`);
  }

  // ---- 20. all six listed on /blog/ ----
  console.log("\n== All six listed on /blog/ ==");
  {
    const blogHtml = fs.readFileSync(path.join(DIST_DIR, "blog", "index.html"), "utf8");
    for (const p of NEW_PAGES) {
      if (blogHtml.includes(`href="${p}"`)) ok();
      else fail(`/blog/: missing a link to ${p}`);
    }
  }

  // ---- 21. sitemap : page inventory 1:1, expected total ----
  console.log("\n== Sitemap, page inventory and totals ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_PAGES) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  if (siteFiles.length === EXPECTED_PAGE_COUNT) ok();
  else fail(`expected exactly ${EXPECTED_PAGE_COUNT} pages after Batch D2`, `got ${siteFiles.length}`);

  // ---- 22. redirect count unchanged at 19 ----
  console.log("\n== Redirect count unchanged ==");
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
  const port = 8954;
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
  for (const p of NEW_PAGES) {
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
  console.log(violations === 0 ? "\naxe-core: 0 violations across all 6 new pages at mobile viewport" : `\naxe-core: ${violations} total violation(s) found`);
  if (violations > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
