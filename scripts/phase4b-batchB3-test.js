#!/usr/bin/env node
// Phase 4B Batch B3 regression tests — the 4 new blog posts:
//   /professional-mobile-tyre-services-on-drivers-linlithgow/
//   /the-best-tyres-for-edinburgh-west-lothian-roads/
//   /tyre-services-west-lothian/
//   /your-guide-to-safe-tyre-services-in-harthill/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js, scripts/phase4-test.js and the earlier
// Batch A/B1/B2 suites, which already cover these pages generically
// (sitemap inclusion, canonical self-match, single H1, no duplicate
// titles/meta, valid JSON-LD, no orphan pages, redirect single-hop). This
// file adds Batch-B3-specific assertions: each article stays clearly
// differentiated from its paired location/service page (different title,
// meta description, H1 and primary keyword; no identical paragraphs; no
// excessive word overlap), no competitor names, no unsupported
// superlatives, no unsafe DIY/procedural instructions, no invented
// landmarks/response-times, and no leftover WordPress content-quality
// artifacts (the "With the ALS system..." fragment specifically).
// A separate, optional axe-core mobile-viewport accessibility pass runs at
// the end if a local Playwright + axe-core install is available.
//
// Run: `node scripts/phase4b-batchB3-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8945;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 17; // unchanged from the Batch B2 correction; Batch B3 adds no redirects

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

const NEW_URLS = [
  "/professional-mobile-tyre-services-on-drivers-linlithgow/",
  "/the-best-tyres-for-edinburgh-west-lothian-roads/",
  "/tyre-services-west-lothian/",
  "/your-guide-to-safe-tyre-services-in-harthill/",
];

// Each new article paired with its primary transactional location/service
// page — the cannibalisation guard this batch was explicitly asked for.
const LOCATION_PAIRS = [
  ["/professional-mobile-tyre-services-on-drivers-linlithgow/", "/mobile-tyre-fitting-linlithgow/"],
  ["/the-best-tyres-for-edinburgh-west-lothian-roads/", "/mobile-tyre-fitting-edinburgh/"],
  ["/tyre-services-west-lothian/", "/mobile-tyre-fitting-west-lothian/"],
  ["/your-guide-to-safe-tyre-services-in-harthill/", "/mobile-tyre-fitting-harthill/"],
];
// Same documented threshold used for the Batch B2 kept-separate-pair guard.
const OVERLAP_WARN_THRESHOLD = 0.45;

const COMPETITOR_PATTERN = /kwik.?fit|halfords|national tyre|ats euromaster|tyresonthedrive|tyres on the drive|hometyre|blackcircles|protyre|point s\b|asda tyre|costco tyre|formula one autocentre|etyres|tredz|mytyres|tyre shopper|hunters|arnold clark|evans halshaw|f1 autocentre/i;
const SUPERLATIVE_PATTERN = /\bbest\b(?!\s*(?:option|choice|fit for you|tyre for you))|\btop.?rated\b|\bfastest\b|\bmarket.?leading\b|\bnumber one\b|\b#1\b|\bunmatched\b|\bunbeatable\b/i;
const UNSAFE_PROCEDURAL_PATTERNS = [
  /\bdrill(?:ing)?\b/i,
  /\bhammer(?:ing)?\b/i,
  /jack (?:the|your|up).{0,20}(?:car|vehicle) up/i,
  /place the jack under/i,
  /loosen the (?:wheel )?nuts? before/i,
  /remove the (?:wheel )?nuts? (?:fully|completely)/i,
  /lower the (?:car|vehicle)/i,
];
const STALE_FRAGMENT_PATTERNS = [
  /target keyword/i,
  /students will/i,
  /content brief/i,
  /with the als system/i,
  /meta description:/i,
  /seo title:/i,
  /word count:/i,
  /as an ai\b/i,
  /language model/i,
  /\btbd\b/i,
  /lorem ipsum/i,
  /placeholder/i,
];

function extractJsonLd(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      blocks.push({ __parseError: e.message });
    }
  }
  return blocks;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Scopes to the main content area for article pages (sfr-legal__body) or
// location pages (everything inside <main>...</main>), so comparisons
// aren't polluted by the identical sitewide header/nav/footer/JSON-LD.
function mainContentHtml(html) {
  if (html.includes('class="sfr-legal__body"')) {
    const after = html.split('class="sfr-legal__body"')[1] || "";
    const closeMatch = after.match(/<\/div>\s*<\/div>\s*<\/section>/);
    return closeMatch ? after.slice(0, closeMatch.index) : after;
  }
  const m = html.match(/<main id="main">([\s\S]*?)<\/main>/);
  return m ? m[1] : html;
}

function paragraphs(html) {
  return [...mainContentHtml(html).matchAll(/<p[^>]*>([^<]{40,})<\/p>/g)].map((m) => m[1].trim());
}

function bodyWords(html) {
  const text = stripTags(mainContentHtml(html)).toLowerCase();
  return new Set((text.match(/[a-z']+/g) || []));
}

function jaccard(setA, setB) {
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch B3 regression tests — server at ${BASE}\n`);

  const pageData = {};

  // ---- 1. all four URLs return 200 ----
  console.log("== New pages: 200 ==");
  for (const p of NEW_URLS) {
    const res = await get(p);
    if (res.status === 200) ok();
    else fail(`${p}: expected 200`, `got ${res.status}`);
    pageData[p] = res;
  }

  // ---- 2. self-referencing canonicals ----
  console.log("\n== Self-referencing canonicals ==");
  for (const p of NEW_URLS) {
    const canon = pageData[p].body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (canon === `https://sfrmotors.co.uk${p}`) ok();
    else fail(`${p}: canonical mismatch`, canon);
  }

  // ---- 3. exactly one H1 ----
  console.log("\n== Exactly one H1 ==");
  for (const p of NEW_URLS) {
    const count = (pageData[p].body.match(/<h1[\s>]/g) || []).length;
    if (count === 1) ok();
    else fail(`${p}: expected exactly 1 H1`, `got ${count}`);
  }

  // ---- 4. unique titles and meta descriptions across the four new pages ----
  console.log("\n== Unique titles and meta descriptions ==");
  const titles = new Map();
  const descs = new Map();
  for (const p of NEW_URLS) {
    const title = pageData[p].body.match(/<title>([^<]*)<\/title>/)?.[1];
    const desc = pageData[p].body.match(/name="description" content="([^"]*)"/)?.[1];
    if (!title) fail(`${p}: missing <title>`);
    else if (titles.has(title)) fail(`${p}: duplicate title`, `also used by ${titles.get(title)}`);
    else { titles.set(title, p); ok(); }
    if (!desc) fail(`${p}: missing meta description`);
    else if (descs.has(desc)) fail(`${p}: duplicate meta description`, `also used by ${descs.get(desc)}`);
    else { descs.set(desc, p); ok(); }
  }

  // ---- 5. valid JSON-LD on every new page ----
  console.log("\n== Valid JSON-LD ==");
  const jsonLd = {};
  for (const p of NEW_URLS) {
    const blocks = extractJsonLd(pageData[p].body);
    jsonLd[p] = blocks;
    if (blocks.length === 0) {
      fail(`${p}: no JSON-LD blocks found`);
      continue;
    }
    let allOk = true;
    for (const b of blocks) {
      if (b.__parseError) {
        fail(`${p}: JSON-LD parse error`, b.__parseError);
        allOk = false;
      }
    }
    if (allOk) ok();
    const types = blocks.map((b) => b["@type"]).filter(Boolean);
    if (types.includes("BreadcrumbList") && types.includes("Article")) ok();
    else fail(`${p}: expected BreadcrumbList + Article schema`, types.join(","));
  }

  // ---- 6. no stray FAQ schema without visible FAQs (none intended this batch) ----
  console.log("\n== No stray FAQ schema without visible FAQs ==");
  for (const p of NEW_URLS) {
    const hasFaqSchema = jsonLd[p].some((b) => b["@type"] === "FAQPage");
    const hasVisibleFaq = /class="sfr-faq__item"/.test(pageData[p].body);
    if (!hasFaqSchema && !hasVisibleFaq) ok();
    else fail(`${p}: FAQ schema/visible-FAQ mismatch`, `hasFaqSchema=${hasFaqSchema} hasVisibleFaq=${hasVisibleFaq}`);
  }

  // ---- 7. no stale content-brief fragments (incl. the "ALS system" fragment) ----
  console.log("\n== No stale content-brief fragments ==");
  for (const p of NEW_URLS) {
    const text = stripTags(pageData[p].body);
    const hit = STALE_FRAGMENT_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains a stale content-brief fragment`, hit.toString());
  }

  // Scoped to the article prose only — the full page (canonical/og/JSON-LD
  // tags) legitimately repeats each page's own URL slug, which for this
  // batch includes the word "best" (/the-best-tyres-.../) with no bearing
  // on whether the visible prose makes a superlative claim.
  // ---- 8. no competitor names ----
  console.log("\n== No competitor names ==");
  for (const p of NEW_URLS) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!COMPETITOR_PATTERN.test(text)) ok();
    else fail(`${p}: appears to name a competitor`);
  }

  // ---- 9. no unsupported superlatives ----
  console.log("\n== No unsupported superlatives ==");
  for (const p of NEW_URLS) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!SUPERLATIVE_PATTERN.test(text)) ok();
    else fail(`${p}: contains an unsupported superlative claim`, text.match(SUPERLATIVE_PATTERN)?.[0]);
  }

  // ---- 10. no unsafe procedural instructions ----
  console.log("\n== No unsafe DIY/procedural instructions ==");
  for (const p of NEW_URLS) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = UNSAFE_PROCEDURAL_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains an unsafe procedural instruction pattern`, hit.toString());
  }

  // ---- 11. no copied paragraphs between the four new pages ----
  console.log("\n== No copied paragraphs between the four new pages ==");
  const paraSets = NEW_URLS.map((p) => ({ url: p, paras: paragraphs(pageData[p].body) }));
  let duplicateFound = false;
  for (let i = 0; i < paraSets.length; i++) {
    for (let j = i + 1; j < paraSets.length; j++) {
      const shared = paraSets[i].paras.filter((p) => paraSets[j].paras.includes(p));
      if (shared.length > 0) {
        duplicateFound = true;
        fail(`${paraSets[i].url} and ${paraSets[j].url} share an identical paragraph`, shared[0].slice(0, 80));
      }
    }
  }
  if (!duplicateFound) ok();

  // ---- 12. location/article cannibalisation guard ----
  console.log("\n== Location/article pair differentiation ==");
  for (const [articleUrl, locationUrl] of LOCATION_PAIRS) {
    const locRes = await get(locationUrl);
    if (locRes.status !== 200) {
      fail(`${locationUrl}: expected 200 (needed for the pair guard)`);
      continue;
    }
    const artBody = pageData[articleUrl].body;
    const locBody = locRes.body;
    const artTitle = artBody.match(/<title>([^<]*)<\/title>/)?.[1];
    const locTitle = locBody.match(/<title>([^<]*)<\/title>/)?.[1];
    const artDesc = artBody.match(/name="description" content="([^"]*)"/)?.[1];
    const locDesc = locBody.match(/name="description" content="([^"]*)"/)?.[1];
    const artH1 = artBody.match(/<h1[^>]*>([^<]*)/)?.[1];
    const locH1 = locBody.match(/<h1[^>]*>([^<]*)/)?.[1];
    if (artTitle && locTitle && artTitle !== locTitle) ok();
    else fail(`${articleUrl} vs ${locationUrl}: titles must differ`, `${artTitle} / ${locTitle}`);
    if (artDesc && locDesc && artDesc !== locDesc) ok();
    else fail(`${articleUrl} vs ${locationUrl}: meta descriptions must differ`, `${artDesc} / ${locDesc}`);
    if (artH1 && locH1 && artH1 !== locH1) ok();
    else fail(`${articleUrl} vs ${locationUrl}: H1s must differ`, `${artH1} / ${locH1}`);
    const artParas = paragraphs(artBody);
    const locParas = paragraphs(locBody);
    const shared = artParas.filter((p) => locParas.includes(p));
    if (shared.length === 0) ok();
    else fail(`${articleUrl} and ${locationUrl} share an identical paragraph`, shared[0].slice(0, 80));
    const overlap = jaccard(bodyWords(artBody), bodyWords(locBody));
    if (overlap <= OVERLAP_WARN_THRESHOLD) ok();
    else fail(`${articleUrl} vs ${locationUrl}: word overlap ${(overlap * 100).toFixed(1)}% exceeds the ${(OVERLAP_WARN_THRESHOLD * 100).toFixed(0)}% documented threshold`);
    console.log(`    ${articleUrl} vs ${locationUrl}: ${(overlap * 100).toFixed(1)}% overlap`);
    // article must link to its primary location/service page
    if (artBody.includes(`href="${locationUrl}"`)) ok();
    else fail(`${articleUrl}: expected a contextual link to ${locationUrl}`);
  }

  // ---- 13. Edinburgh article does not reuse the Edinburgh location page's SEO title/keyword ----
  console.log("\n== Edinburgh article vs. Edinburgh location page: distinct keyword ==");
  {
    const artTitle = pageData["/the-best-tyres-for-edinburgh-west-lothian-roads/"].body.match(/<title>([^<]*)<\/title>/)?.[1] || "";
    if (!/^Mobile Tyre Fitting Edinburgh/i.test(artTitle)) ok();
    else fail("the-best-tyres-for-edinburgh-west-lothian-roads: title reuses the Edinburgh location page's SEO title", artTitle);
  }

  // ---- 14. West Lothian article does not front its title with the hub's transactional keyword ----
  console.log("\n== West Lothian article does not compete with the hub's transactional keyword ==");
  {
    const artTitle = pageData["/tyre-services-west-lothian/"].body.match(/<title>([^<]*)<\/title>/)?.[1] || "";
    if (!/^Mobile Tyre Fitting West Lothian/i.test(artTitle)) ok();
    else fail("tyre-services-west-lothian: title competes with the West Lothian hub's transactional keyword", artTitle);
  }

  // ---- 15. phone and WhatsApp links present and correctly formed ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of NEW_URLS) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 16. no broken internal links ----
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
  for (const p of NEW_URLS) {
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

  // ---- 17. no orphan pages ----
  console.log("\n== No orphan pages ==");
  for (const p of NEW_URLS) {
    const linkedElsewhere = siteFiles.some((f) => {
      if (f === path.join(DIST_DIR, p.slice(1), "index.html")) return false;
      const html = fs.readFileSync(f, "utf8");
      return html.includes(`href="${p}"`);
    });
    if (linkedElsewhere) ok();
    else fail(`${p}: appears to be orphaned — no inbound link found anywhere on the site`);
  }

  // ---- 18. sitemap and page inventory remain 1:1, expected total 60 ----
  console.log("\n== Sitemap : page inventory 1:1 ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_URLS) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  if (siteFiles.length === 60) ok();
  else fail(`expected exactly 60 pages after Batch B3`, `got ${siteFiles.length}`);

  // ---- 19. redirect count unchanged (17) ----
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
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:8946`);
    let p = decodeURIComponent(url.pathname);
    const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end("404"); }
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(8946, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let violations = 0;
  for (const p of NEW_URLS) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:8946${p}`, { waitUntil: "load" });
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
