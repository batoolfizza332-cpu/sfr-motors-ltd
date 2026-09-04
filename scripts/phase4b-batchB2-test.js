#!/usr/bin/env node
// Phase 4B Batch B2 regression tests — the 5 new blog posts:
//   /asymmetric-and-directional-tyres-difference/
//   /how-quality-tyres-improve-safety-and-driving-performance/
//   /how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road/
//   /what-is-mobile-tyre-fitting/
//   /what-tools-do-mobile-tyre-fitters-use/
//
// Plus the Batch B2 cannibalisation correction: /behind-the-scenes-what-
// tools-do-mobile-tyre-fitters-really-use/ (a real WordPress post, post_id
// 2432 — misclassified as a non-live dev slug in the original Batch B2
// report) was consolidated into /what-tools-do-mobile-tyre-fitters-use/
// and retired with a direct 301. See WORDPRESS_MIGRATION_AUDIT.md for the
// full evidence (identical exported SEO titles, 25.2% Jaccard overlap on
// the original WordPress bodies).
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js, scripts/phase4-test.js and the earlier
// Batch A/B1 suites, which already cover these pages generically (sitemap
// inclusion, canonical self-match, single H1, no duplicate titles/meta,
// valid JSON-LD, no orphan pages, redirect single-hop). This file adds
// Batch-B2-specific assertions: no leftover content-brief fragments, no
// copied paragraphs between the five new pages, working phone/WhatsApp
// links, the retirement/redirect regression for the consolidated tools
// pair, no procedural lifting/drilling/destructive wheel-nut instructions
// on the survivor, and a standing cannibalisation guard on the one
// deliberately-kept-separate pair (/what-is-mobile-tyre-fitting/ vs
// /mobile-tyre-fitting-guide/) covering identical titles/meta/H1s,
// identical paragraphs, intent-drift, and a documented overlap threshold.
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
const REDIRECTS_BEFORE = 17; // 16 as of Phase 4B Batch A, +1 from this batch's cannibalisation-correction redirect

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

const RETIRED_TOOLS_URL = "/behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use/";
const TOOLS_SURVIVOR_URL = "/what-tools-do-mobile-tyre-fitters-use/";

// The one pair deliberately kept separate, per the Batch B2 cannibalisation
// review — /mobile-tyre-fitting-guide/ is not a WordPress URL (Phase 3B,
// pre-dates the WXR export) but the two pages sit close enough in topic
// (both "what is / how does mobile tyre fitting work") to need a standing
// guard against future drift, not just a one-off read.
const KEPT_SEPARATE_PAIR = ["/what-is-mobile-tyre-fitting/", "/mobile-tyre-fitting-guide/"];
// Documented threshold: current measured overlap between this pair is
// ~35% Jaccard on body word sets (short, same-domain articles naturally
// share a lot of vocabulary — "tyre", "mobile", "fitter", "garage" etc.).
// 45% gives real headroom above that baseline while still catching a
// future edit that lets the two pages converge back onto the same content.
const OVERLAP_WARN_THRESHOLD = 0.45;

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

// Scopes to just the article body — everything between the opening
// sfr-legal__body div and its matching close — so word/paragraph
// comparisons aren't polluted by the identical sitewide header, nav,
// footer and JSON-LD boilerplate every page shares.
function articleBodyHtml(html) {
  const after = html.split('class="sfr-legal__body"')[1] || "";
  const closeMatch = after.match(/<\/div>\s*<\/div>\s*<\/section>/);
  return closeMatch ? after.slice(0, closeMatch.index) : after;
}

function paragraphs(html) {
  const section = articleBodyHtml(html);
  return [...section.matchAll(/<p>([^<]{40,})<\/p>/g)].map((m) => m[1].trim());
}

function bodyWords(html) {
  const text = stripTags(articleBodyHtml(html)).toLowerCase();
  return new Set((text.match(/[a-z']+/g) || []));
}

function jaccard(setA, setB) {
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
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

// Procedural lifting/drilling/destructive wheel-nut instruction patterns —
// none of these should appear on the consolidated tools survivor, which
// must stay a high-level equipment overview, not a how-to.
const UNSAFE_PROCEDURAL_PATTERNS = [
  /\bdrill(?:ing)?\b/i,
  /\bhammer(?:ing)?\b/i,
  /jack (?:the|your|up).{0,20}(?:car|vehicle) up/i,
  /place the jack under/i,
  /loosen the (?:wheel )?nuts? before/i,
  /remove the (?:wheel )?nuts? (?:fully|completely)/i,
  /lower the (?:car|vehicle)/i,
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

  // ---- 9. consolidated tools survivor: retirement/redirect regression ----
  console.log("\n== Tools-pair consolidation: retirement and redirect ==");
  const survivor = pageData[TOOLS_SURVIVOR_URL];
  const retired = await get(RETIRED_TOOLS_URL);
  if (retired.status === 301 && retired.headers.location === TOOLS_SURVIVOR_URL) ok();
  else fail(`${RETIRED_TOOLS_URL}: expected 301 -> ${TOOLS_SURVIVOR_URL}`, `got ${retired.status} ${retired.headers.location || ""}`);
  // no chain: the destination must not itself be a redirect source
  if (!vercelConfig.redirects.some((r) => r.source === TOOLS_SURVIVOR_URL)) ok();
  else fail(`${TOOLS_SURVIVOR_URL}: is itself a redirect source — this would be a chain from ${RETIRED_TOOLS_URL}`);
  // the retired page must no longer exist as a built file (not indexable)
  if (!fs.existsSync(path.join(DIST_DIR, "behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use", "index.html"))) ok();
  else fail(`${RETIRED_TOOLS_URL}: page file still exists in dist/ — it should have been removed`);

  // ---- 10. consolidated tools survivor: content requirements ----
  console.log("\n== Tools-pair consolidation: content requirements ==");
  const survivorText = stripTags(survivor.body);
  const unsafeHit = UNSAFE_PROCEDURAL_PATTERNS.find((re) => re.test(survivorText));
  if (!unsafeHit) ok();
  else fail(`${TOOLS_SURVIVOR_URL}: contains a procedural lifting/drilling/destructive instruction pattern`, unsafeHit.toString());
  // must not imply every fitter carries identical equipment
  if (/varies between providers|not every fitter carries identical/i.test(survivorText)) ok();
  else fail(`${TOOLS_SURVIVOR_URL}: expected explicit wording that equipment varies between providers`);
  // must not still reference the retired page anywhere
  if (!survivor.body.includes(RETIRED_TOOLS_URL)) ok();
  else fail(`${TOOLS_SURVIVOR_URL}: still references the retired URL ${RETIRED_TOOLS_URL}`);

  // ---- 11. Pair 2 guard: /what-is-mobile-tyre-fitting/ vs /mobile-tyre-fitting-guide/ ----
  console.log("\n== Kept-separate pair guard (definitional vs. guide) ==");
  {
    const [urlA, urlB] = KEPT_SEPARATE_PAIR;
    const resB = await get(urlB);
    if (resB.status !== 200) {
      fail(`${urlB}: expected 200 (needed for the kept-separate-pair guard)`);
    } else {
      const bodyA = pageData[urlA].body;
      const bodyB = resB.body;
      const titleA = bodyA.match(/<title>([^<]*)<\/title>/)?.[1];
      const titleB = bodyB.match(/<title>([^<]*)<\/title>/)?.[1];
      const descA = bodyA.match(/name="description" content="([^"]*)"/)?.[1];
      const descB = bodyB.match(/name="description" content="([^"]*)"/)?.[1];
      const h1A = bodyA.match(/<h1[^>]*>([^<]*)/)?.[1];
      const h1B = bodyB.match(/<h1[^>]*>([^<]*)/)?.[1];
      // identical titles/descriptions/H1s
      if (titleA && titleB && titleA !== titleB) ok();
      else fail(`${urlA} and ${urlB}: titles must differ`, `${titleA} / ${titleB}`);
      if (descA && descB && descA !== descB) ok();
      else fail(`${urlA} and ${urlB}: meta descriptions must differ`, `${descA} / ${descB}`);
      if (h1A && h1B && h1A !== h1B) ok();
      else fail(`${urlA} and ${urlB}: H1s must differ`, `${h1A} / ${h1B}`);
      // identical paragraphs
      const parasA = paragraphs(bodyA);
      const parasB = paragraphs(bodyB);
      const sharedParas = parasA.filter((p) => parasB.includes(p));
      if (sharedParas.length === 0) ok();
      else fail(`${urlA} and ${urlB} share an identical paragraph`, sharedParas[0].slice(0, 80));
      // search-intent drift: each page's H1 must keep its defining marker —
      // "what is" for the definitional page, "guide" for the process page —
      // so a future edit can't quietly blur the two back into the same intent
      if (/what is/i.test(h1A || "")) ok();
      else fail(`${urlA}: H1 no longer reads as a "what is" definitional page`, h1A);
      if (/guide/i.test(h1B || "")) ok();
      else fail(`${urlB}: H1 no longer reads as a "guide" process page`, h1B);
      // excessive future content overlap, documented threshold
      const overlap = jaccard(bodyWords(bodyA), bodyWords(bodyB));
      if (overlap <= OVERLAP_WARN_THRESHOLD) ok();
      else fail(`${urlA} and ${urlB}: word overlap ${(overlap * 100).toFixed(1)}% exceeds the ${(OVERLAP_WARN_THRESHOLD * 100).toFixed(0)}% documented threshold`);
      console.log(`    (current word overlap: ${(overlap * 100).toFixed(1)}%, threshold: ${(OVERLAP_WARN_THRESHOLD * 100).toFixed(0)}%)`);
    }
  }

  // ---- 12. phone and WhatsApp links present and correctly formed ----
  console.log("\n== Phone and WhatsApp links ==");
  for (const p of NEW_URLS) {
    const html = pageData[p].body;
    if (html.includes('href="tel:01312020289"')) ok();
    else fail(`${p}: missing/incorrect tel: link`);
    if (html.includes('href="https://wa.me/447448427154"')) ok();
    else fail(`${p}: missing/incorrect WhatsApp link`);
  }

  // ---- 13. no broken internal links, no stale links to the retired URL ----
  console.log("\n== No broken internal links / no stale links to the retired URL ==");
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
  let staleLinks = 0;
  for (const f of siteFiles) {
    const html = fs.readFileSync(f, "utf8");
    if (html.includes(`href="${RETIRED_TOOLS_URL}"`)) {
      staleLinks++;
      console.log(`    stale link to ${RETIRED_TOOLS_URL} in: ${path.relative(DIST_DIR, f)}`);
    }
  }
  if (staleLinks === 0) ok();
  else fail(`${staleLinks} file(s) still link to the retired URL ${RETIRED_TOOLS_URL}`);

  // ---- 14. no orphan pages ----
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

  // ---- 15. sitemap and page inventory remain 1:1, retired URL absent ----
  console.log("\n== Sitemap : page inventory 1:1 ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_URLS) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  if (!sitemapUrls.includes(RETIRED_TOOLS_URL)) ok();
  else fail(`sitemap.xml: still contains the retired ${RETIRED_TOOLS_URL}`);
  if (siteFiles.length === 56) ok();
  else fail(`expected exactly 56 pages after the consolidation`, `got ${siteFiles.length}`);

  // ---- 16. redirect count is 17 (16 + this correction's one redirect) ----
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
