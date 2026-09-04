#!/usr/bin/env node
// Phase 4B Batch B2 regression tests — the 5 new blog posts:
//   /asymmetric-and-directional-tyres-difference/
//   /how-quality-tyres-improve-safety-and-driving-performance/
//   /how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road/
//   /what-is-mobile-tyre-fitting/
//   /what-tools-do-mobile-tyre-fitters-use/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js, scripts/phase4-test.js and the earlier
// Batch A/B1 suites, which already cover these pages generically (sitemap
// inclusion, canonical self-match, single H1, no duplicate titles/meta,
// valid JSON-LD, no orphan pages, redirect single-hop). This file adds
// Batch-B2-specific assertions: no leftover content-brief fragments, no
// copied paragraphs between the five new pages, working phone/WhatsApp
// links, and — because two of these five share a near-identical topic
// with an already-live article — a dedicated cannibalisation guard
// confirming no identical paragraph text between each such pair.
// A separate, optional axe-core mobile-viewport accessibility pass runs at
// the end if a local Playwright + axe-core install is available.
//
// Run: `node scripts/phase4b-batchB2-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8943;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 16; // count confirmed unchanged from Phase 4B Batch A/B1

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
  "/asymmetric-and-directional-tyres-difference/",
  "/how-quality-tyres-improve-safety-and-driving-performance/",
  "/how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road/",
  "/what-is-mobile-tyre-fitting/",
  "/what-tools-do-mobile-tyre-fitters-use/",
];

// Near-duplicate-topic pairs this batch deliberately created, per the
// Batch B2 cannibalisation check against related pages — each new page's
// content was written to complement, not repeat, its counterpart.
const CANNIBALISATION_PAIRS = [
  ["/what-is-mobile-tyre-fitting/", "/mobile-tyre-fitting-guide/"],
  ["/what-tools-do-mobile-tyre-fitters-use/", "/behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use/"],
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

function paragraphs(html) {
  const section = html.split('class="sfr-legal__body"')[1] || html;
  return [...section.matchAll(/<p>([^<]{40,})<\/p>/g)].map((m) => m[1].trim());
}

const STALE_FRAGMENT_PATTERNS = [
  /target keyword/i,
  /students will/i,
  /content brief/i,
  /meta description:/i,
  /seo title:/i,
  /word count:/i,
  /as an ai\b/i,
  /language model/i,
  /\btbd\b/i,
  /lorem ipsum/i,
  /placeholder/i,
];

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch B2 regression tests — server at ${BASE}\n`);

  const pageData = {};

  // ---- 1. all five URLs return 200 ----
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

  // ---- 4. unique titles and meta descriptions across the five new pages ----
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

  // ---- 6. none of the five carries an FAQPage schema without visible FAQs (none intended this batch) ----
  console.log("\n== No stray FAQ schema without visible FAQs ==");
  for (const p of NEW_URLS) {
    const hasFaqSchema = jsonLd[p].some((b) => b["@type"] === "FAQPage");
    const hasVisibleFaq = /class="sfr-faq__item"/.test(pageData[p].body);
    if (!hasFaqSchema && !hasVisibleFaq) ok();
    else fail(`${p}: FAQ schema/visible-FAQ mismatch`, `hasFaqSchema=${hasFaqSchema} hasVisibleFaq=${hasVisibleFaq}`);
  }

  // ---- 7. no stale content-brief fragments ----
  console.log("\n== No stale content-brief fragments ==");
  for (const p of NEW_URLS) {
    const text = stripTags(pageData[p].body);
    const hit = STALE_FRAGMENT_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains a stale content-brief fragment`, hit.toString());
  }

  // ---- 8. no copied paragraphs between the five new pages ----
  console.log("\n== No copied paragraphs between the five new pages ==");
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

  // ---- 9. cannibalisation guard: no identical paragraphs against the pre-existing near-duplicate-topic articles ----
  console.log("\n== Cannibalisation guard vs. related existing articles ==");
  for (const [newUrl, existingUrl] of CANNIBALISATION_PAIRS) {
    const existingRes = await get(existingUrl);
    if (existingRes.status !== 200) {
      fail(`${existingUrl}: expected 200 (needed for cannibalisation comparison)`, `got ${existingRes.status}`);
      continue;
    }
    const newParas = paragraphs(pageData[newUrl].body);
    const existingParas = paragraphs(existingRes.body);
    const shared = newParas.filter((p) => existingParas.includes(p));
    if (shared.length === 0) ok();
    else fail(`${newUrl} shares an identical paragraph with ${existingUrl}`, shared[0].slice(0, 80));
    // the new page must explicitly cross-link to its companion, not silently duplicate it
    if (pageData[newUrl].body.includes(`href="${existingUrl}"`)) ok();
    else fail(`${newUrl}: expected a cross-link to its companion article ${existingUrl}`);
  }

  // ---- 10. phone and WhatsApp links present and correctly formed ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of NEW_URLS) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 11. no broken internal links ----
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

  // ---- 12. no orphan pages ----
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

  // ---- 13. sitemap and page inventory remain 1:1 ----
  console.log("\n== Sitemap : page inventory 1:1 ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_URLS) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }

  // ---- 14. no redirect changes (still 16) ----
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
    const url = new URL(req.url, `http://127.0.0.1:8944`);
    let p = decodeURIComponent(url.pathname);
    const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end("404"); }
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(8944, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let violations = 0;
  for (const p of NEW_URLS) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:8944${p}`, { waitUntil: "load" });
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
  console.log(violations === 0 ? "\naxe-core: 0 violations across all 5 new pages at mobile viewport" : `\naxe-core: ${violations} total violation(s) found`);
  if (violations > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
