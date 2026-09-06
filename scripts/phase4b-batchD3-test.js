#!/usr/bin/env node
// Phase 4B Batch D3 regression tests — four new blog posts, each recreated
// at its exact original WordPress URL, plus two deliberately-excluded URLs
// that must NOT exist anywhere on the site:
//   Recreated:
//     /tyres-bathgate-technical-breakdown/
//     /why-tyres-fail-mobile-tyre-fitter-falkirk/
//     /which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk/
//     /how-much-does-mobile-tyre-fitting-cost/
//   Excluded (no page, no redirect — pending a Google Search Console
//   decision before launch; see WORDPRESS_MIGRATION_AUDIT.md):
//     /spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/
//     /what-to-expect-from-a-same-day-mobile-car-repair-service/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js
// and scripts/phase4-test.js, which cover the recreated pages generically
// (sitemap inclusion, canonical self-match, single H1, no duplicate
// titles/meta, valid JSON-LD, no orphan pages, no broken links, redirect
// chain/loop checks) via dynamic, non-brittle site-wide sweeps.
// scripts/gen-redirects.js itself also verifies no redirect chains/loops
// on every run (already exercised earlier in this batch).
//
// Per the Batch D3 instruction, this suite carries the CURRENT page/
// redirect totals as its own baseline (80 pages, 19 redirects) — a future
// batch that adds more pages should convert this to a floor check (as
// Batches C, D1 and D2 were converted during earlier batches' cleanup),
// not keep bumping the exact figure here.
//
// Run: `node scripts/phase4b-batchD3-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8955;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 19; // unchanged by Batch D3 — four exact-URL recreations, no redirects added
const EXPECTED_PAGE_COUNT = 80; // 76 after Batch D2, +4 new Batch D3 pages — this batch's own current total

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
  "/tyres-bathgate-technical-breakdown/",
  "/why-tyres-fail-mobile-tyre-fitter-falkirk/",
  "/which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk/",
  "/how-much-does-mobile-tyre-fitting-cost/",
];

const EXCLUDED_URLS = [
  "/spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/",
  "/what-to-expect-from-a-same-day-mobile-car-repair-service/",
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

// ---- unsupported prices / superlatives / customer-counts / response-times ----
// Note: £2,500 is the verified GOV.UK penalty figure for an illegal tyre
// (see the Bathgate article) — it's a legal fact, not an invented tyre
// price, so it's excluded from this price-figure guard specifically.
const INVENTED_CLAIM_PATTERNS = [
  /£(?!2,?500\b)\d/,
  /\$\d/,
  /\bfrom £/i,
  /\barrival time\b.{0,20}\d+\s*minutes?/i,
  /within \d+\s*minutes?/i,
  /\d+%\s*of\s*(?:uk\s*)?drivers/i,
  /rated 5 stars?/i,
  /guaranteed (?:5|five)[- ]star/i,
  /thousands of (?:uk\s*)?(?:drivers|customers)/i,
  /nationwide/i,
  /uk'?s (?:best|most (?:trusted|reliable))/i,
  /most trusted/i,
  /award[- ]winning/i,
];

const STALE_COMPANY_NAME_PATTERN = /sfr mobile tyres ltd/i;

// ---- fabricated customer stories / case studies (the three named Falkirk anecdotes) ----
const FABRICATED_STORY_PATTERNS = [
  /business owner from falkirk/i,
  /parent in grangemouth/i,
  /fleet maintenance for local businesses/i,
  /m9 blowout case/i,
  /school run emergency/i,
];

// ---- unverified statistics from the original exported bodies ----
const UNVERIFIED_STAT_PATTERNS = [
  /62% of uk drivers/i,
  /41% of tyre failures/i,
  /reduces downtime by up to 70%/i,
  /over 98% of tyres sold/i,
  /nearly 1 in 4 vehicles/i,
  /harden after 5 years, reducing traction by up to 30%/i,
  /1 in 6 uk drivers admitted/i,
  /36% of motorway breakdowns/i,
  /10,000 accidents yearly/i,
  /1 in 5 drivers in scotland/i,
  /cut tyre costs by up to 30%/i,
];

// ---- unsafe procedural / DIY instructions ----
const UNSAFE_PROCEDURE_PATTERNS = [
  /jack (?:up|the car|it up)/i,
  /lug wrench/i,
  /loosen(?:ing)? the (?:wheel )?nuts?/i,
  /place the jack under/i,
  /remove the spare (?:wheel|tyre) and/i,
];

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch D3 regression tests — server at ${BASE}\n`);

  const pageData = {};

  // ---- 1. all four new pages return 200 ----
  console.log("== New pages: 200 ==");
  for (const p of NEW_PAGES) {
    const res = await get(p);
    if (res.status === 200) ok();
    else fail(`${p}: expected 200`, `got ${res.status}`);
    pageData[p] = res;
  }

  // ---- 2. the two excluded URLs have no generated page: no dist file, no redirect, 404 (not a redirect to home) ----
  console.log("\n== Excluded URLs: no page, no redirect, plain 404 ==");
  for (const p of EXCLUDED_URLS) {
    if (!fs.existsSync(path.join(DIST_DIR, p.slice(1, -1), "index.html"))) ok();
    else fail(`${p}: a page file exists in dist/ — this URL should be excluded`);
    if (!vercelConfig.redirects.some((r) => r.source === p)) ok();
    else fail(`${p}: a redirect exists for this URL — it should be excluded, not redirected`);
    const res = await get(p);
    if (res.status === 404) ok();
    else fail(`${p}: expected 404`, `got ${res.status}${res.headers.location ? " -> " + res.headers.location : ""}`);
  }

  // ---- 3. self-referencing canonicals, one H1 (recreated pages only) ----
  console.log("\n== Canonicals and H1 ==");
  for (const p of NEW_PAGES) {
    const canon = pageData[p].body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (canon === `https://sfrmotors.co.uk${p}`) ok();
    else fail(`${p}: canonical mismatch`, canon);
    const h1Count = (pageData[p].body.match(/<h1[\s>]/g) || []).length;
    if (h1Count === 1) ok();
    else fail(`${p}: expected exactly 1 H1`, `got ${h1Count}`);
  }

  // ---- 4. unique titles and meta descriptions across the four new pages ----
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

  // ---- 5. valid JSON-LD, BreadcrumbList + Article, no Offer schema on the cost article ----
  console.log("\n== Valid JSON-LD (no Offer/pricing schema) ==");
  for (const p of NEW_PAGES) {
    const blocks = extractJsonLd(pageData[p].body);
    if (blocks.length === 0) { fail(`${p}: no JSON-LD blocks found`); continue; }
    let allOk = true;
    for (const b of blocks) if (b.__parseError) { fail(`${p}: JSON-LD parse error`, b.__parseError); allOk = false; }
    if (allOk) ok();
    const types = blocks.map((b) => b["@type"]).filter(Boolean);
    if (types.includes("BreadcrumbList") && types.includes("Article")) ok();
    else fail(`${p}: expected BreadcrumbList + Article schema`, types.join(","));
    if (!types.includes("Offer") && !types.includes("Product") && !types.includes("PriceSpecification")) ok();
    else fail(`${p}: unexpected structured pricing/Offer schema`, types.join(","));
  }

  // ---- 6. no unsupported prices, superlatives, customer-counts, response-times, stale company name ----
  console.log("\n== No unsupported prices, superlatives, customer-counts, response-times or stale company name ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = INVENTED_CLAIM_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains an unsupported/invented claim`, hit.toString());
    if (!STALE_COMPANY_NAME_PATTERN.test(text)) ok();
    else fail(`${p}: still contains the stale company name "SFR Mobile Tyres Ltd"`);
  }

  // ---- 7. no fabricated Falkirk customer stories, no unverified statistics ----
  console.log("\n== No fabricated customer stories, no unverified statistics ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const storyHit = FABRICATED_STORY_PATTERNS.find((re) => re.test(text));
    if (!storyHit) ok();
    else fail(`${p}: still contains a fabricated customer story/case study`, storyHit.toString());
    const statHit = UNVERIFIED_STAT_PATTERNS.find((re) => re.test(text));
    if (!statHit) ok();
    else fail(`${p}: still contains an unverified statistic from the exported original`, statHit.toString());
  }

  // ---- 8. no unsafe procedural/DIY instructions ----
  console.log("\n== No unsafe procedural/DIY instructions ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = UNSAFE_PROCEDURE_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: appears to contain an unsafe/DIY procedural instruction`, hit.toString());
  }

  // ---- 9. Bathgate article: verified legal tread figure only, no self-praise, no age-alone-proves-safety claim ----
  console.log("\n== Bathgate article: verified tread figure, no unsupported claims ==");
  {
    const p = "/tyres-bathgate-technical-breakdown/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (/1\.6\s?mm/i.test(text)) ok();
    else fail(`${p}: expected the UK legal tread-depth figure (1.6mm)`);
    if (/£2,?500/.test(text) && /3 penalty points|3 points/i.test(text)) ok();
    else fail(`${p}: expected the verified GOV.UK penalty figures (£2,500 and 3 points)`);
    if (pageData[p].body.includes('href="/mobile-tyre-fitting-bathgate/"')) ok();
    else fail(`${p}: expected a link to /mobile-tyre-fitting-bathgate/`);
  }

  // ---- 10. Falkirk article: links to the Falkirk location page, distinct from it ----
  console.log("\n== Falkirk article: links to location page ==");
  {
    const p = "/why-tyres-fail-mobile-tyre-fitter-falkirk/";
    if (pageData[p].body.includes('href="/mobile-tyre-fitting-falkirk/"')) ok();
    else fail(`${p}: expected a link to /mobile-tyre-fitting-falkirk/`);
  }

  // ---- 11. "best provider" article: neutral title, correct company name, no fabricated comparison table, stated coverage only ----
  console.log("\n== Best-provider article: neutral framing, correct company name, no fabricated table ==");
  {
    const p = "/which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk/";
    const text = stripTags(pageData[p].body);
    const h1 = pageData[p].body.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1];
    if (h1 && !/best.{0,20}uk|uk.{0,20}best/i.test(h1)) ok();
    else fail(`${p}: H1 still uses "best in the UK" framing`, h1);
    if (/sfr motors ltd/i.test(text)) ok();
    else fail(`${p}: expected the correct company name "SFR Motors Ltd"`);
    if (!/<table/i.test(pageData[p].body)) ok();
    else fail(`${p}: contains a comparison table — the original's fabricated table must not be reused`);
    if (!/nitrogen inflation|22.inch|22"|run-?flat/i.test(text)) ok();
    else fail(`${p}: claims an unconfirmed service capability (nitrogen inflation / 22-inch wheels / run-flat)`);
  }

  // ---- 12. cost article: no £ figures anywhere, explains factors, directs to contact for a quote ----
  console.log("\n== Cost article: no price figures, explains factors only ==");
  {
    const p = "/how-much-does-mobile-tyre-fitting-cost/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/£\d/.test(text)) ok();
    else fail(`${p}: still contains a £ price figure`);
    if (/contact sfr motors ltd directly|get in touch|contact us/i.test(text)) ok();
    else fail(`${p}: expected a clear instruction to contact SFR Motors Ltd for a quote`);
    for (const factor of ["tyre size", "brand", "vehicle type", "location", "locking wheel nut"]) {
      if (new RegExp(factor, "i").test(text)) ok();
      else fail(`${p}: expected the cost factor "${factor}" to be covered`);
    }
  }

  // ---- 13. cannibalisation: no duplicate substantive paragraphs against related Bathgate/Falkirk/core pages ----
  console.log("\n== Cannibalisation: related pages remain differentiated ==");
  const relatedGroups = [
    ["/tyres-bathgate-technical-breakdown/", "/mobile-tyre-fitting-bathgate/", "/best-mobile-tyre-fitters-bathgate/", "/tyres-bathgate-guide/"],
    ["/why-tyres-fail-mobile-tyre-fitter-falkirk/", "/mobile-tyre-fitting-falkirk/"],
    ["/which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk/", "/mobile-tyre-fitting/", "/best-mobile-tyre-fitters-bathgate/"],
    ["/how-much-does-mobile-tyre-fitting-cost/", "/our-tyre-range/", "/mobile-tyre-fitting-west-lothian/"],
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

  // ---- 14. phone and WhatsApp links present ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of NEW_PAGES) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 15. no broken internal links from the four new pages ----
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

  // ---- 16. no orphan pages — each of the four has at least one inbound link from elsewhere on the site (beyond /blog/) ----
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

  // ---- 17. all four (and only these four) listed on /blog/ ----
  console.log("\n== Blog listing: four recreated URLs present, two excluded URLs absent ==");
  {
    const blogHtml = fs.readFileSync(path.join(DIST_DIR, "blog", "index.html"), "utf8");
    for (const p of NEW_PAGES) {
      if (blogHtml.includes(`href="${p}"`)) ok();
      else fail(`/blog/: missing a link to ${p}`);
    }
    for (const p of EXCLUDED_URLS) {
      if (!blogHtml.includes(`href="${p}"`)) ok();
      else fail(`/blog/: unexpectedly links to the excluded URL ${p}`);
    }
  }

  // ---- 18. sitemap: page inventory 1:1, four recreated URLs present, two excluded URLs absent, expected total ----
  console.log("\n== Sitemap, page inventory and totals ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_PAGES) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  for (const p of EXCLUDED_URLS) {
    if (!sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: unexpectedly contains the excluded URL ${p}`);
  }
  if (siteFiles.length === EXPECTED_PAGE_COUNT) ok();
  else fail(`expected exactly ${EXPECTED_PAGE_COUNT} pages after Batch D3`, `got ${siteFiles.length}`);

  // ---- 19. redirect count unchanged at 19, and no chains/loops anywhere in the redirect map ----
  console.log("\n== Redirect count unchanged; no chains or loops ==");
  if (vercelConfig.redirects.length === REDIRECTS_BEFORE) ok();
  else fail(`redirects: expected ${REDIRECTS_BEFORE}`, `got ${vercelConfig.redirects.length}`);
  const sources = new Set(vercelConfig.redirects.map((r) => r.source));
  let chainCount = 0;
  for (const r of vercelConfig.redirects) {
    if (sources.has(r.destination)) {
      chainCount++;
      console.log(`    chain detected: ${r.source} -> ${r.destination} -> (destination is itself a redirect source)`);
    }
  }
  if (chainCount === 0) ok();
  else fail(`${chainCount} redirect chain(s) detected`);

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
  const port = 8956;
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
  console.log(violations === 0 ? "\naxe-core: 0 violations across all 4 new pages at mobile viewport" : `\naxe-core: ${violations} total violation(s) found`);
  if (violations > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
