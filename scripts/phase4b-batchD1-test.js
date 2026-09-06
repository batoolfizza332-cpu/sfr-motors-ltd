#!/usr/bin/env node
// Phase 4B Batch D1 regression tests — six new blog posts, each recreated
// at its exact original WordPress URL:
//   /what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/
//   /how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns/
//   /mobile-tyre-fitting-livingston-tyre-problems/
//   /tyre-blowout-causes-prevention/
//   /preparing-your-car-tyres-for-winter-driving-in-livingston/
//   /how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js and scripts/phase4-test.js, which cover
// these pages generically (sitemap inclusion, canonical self-match, single
// H1, no duplicate titles/meta, valid JSON-LD, no orphan pages). This file
// adds the Batch-D1-specific safety and content assertions requested for
// this batch: no content-brief/AI artifacts, no invented prices/stats/
// reviews/response times, no procedural roadside lifting or DIY
// wheel-changing instructions, no fixed tyre-life or rotation-mileage
// claim, and that related pages stay differentiated from each other.
//
// Run: `node scripts/phase4b-batchD1-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8951;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS_BEFORE = 19; // unchanged by Batch D1 — six exact-URL recreations, no redirects added
const MIN_EXPECTED_PAGE_COUNT = 70; // this batch's own baseline (64 after Batch C, +6 new Batch D1 pages) — a floor,
// not an exact figure, since later batches only add pages; the authoritative current
// total is maintained in scripts/phase4-test.js, not here (see the Batch D2 cleanup)

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
  "/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/",
  "/how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns/",
  "/mobile-tyre-fitting-livingston-tyre-problems/",
  "/tyre-blowout-causes-prevention/",
  "/preparing-your-car-tyres-for-winter-driving-in-livingston/",
  "/how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/",
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

// ---- content-brief / AI-artifact residue from the exported WordPress bodies ----
const ARTIFACT_PATTERNS = [
  /target keywords?:/i,
  /^url:\s*\//im,
  /students will recognize/i,
  /tyre-shop directory/i,
  /directory$/im,
];

// ---- unverified reviews / prices / stats / response-time commitments ----
const INVENTED_CLAIM_PATTERNS = [
  /283\s*google reviews?/i,
  /£\d/,                              // any price figure
  /\$\d/,                             // any US-dollar price figure
  /\barrival time\b.{0,20}\d+\s*minutes?/i,
  /within \d+\s*minutes?/i,
  /\d+%\s*of\s*(?:uk\s*)?drivers/i,
  /rated 5 stars?/i,
  /thousands of (?:uk\s*)?drivers/i,
];

// ---- unsupported "2mm summer / 3mm winter" GOV.UK attribution ----
// GOV.UK's Highway Code Annex 6 states only the 1.6mm legal minimum; it
// does not recommend a seasonal replacement threshold. See the Phase 4B
// Batch D1 correction — this must never reappear, on any page.
const UNSUPPORTED_SEASONAL_THRESHOLD_PATTERN = /2\s?mm[\s\S]{0,60}summer[\s\S]{0,60}3\s?mm[\s\S]{0,60}winter|3\s?mm[\s\S]{0,60}winter[\s\S]{0,60}2\s?mm[\s\S]{0,60}summer|official guidance suggests[\s\S]{0,60}(?:2|3)\s?mm/i;

// ---- procedural roadside lifting / DIY wheel-changing instructions ----
const PROCEDURAL_LIFTING_PATTERNS = [
  /jack (?:up|the car|it up)/i,
  /lug wrench/i,
  /loosen(?:ing)? the (?:wheel )?nuts?/i,
  /place the jack under/i,
  /remove the spare (?:wheel|tyre) and/i,
];

// ---- fixed tyre-life / rotation-mileage claims ----
const FIXED_MILEAGE_PATTERN = /\d[\d,]*\s*(?:to|-|–|—)\s*\d[\d,]*\s*miles/i;
const ROTATION_MILEAGE_PATTERN = /rotat\w*.{0,40}\d[\d,]*\s*(?:to|-|–|—)?\s*\d*[\d,]*\s*miles/i;

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch D1 regression tests — server at ${BASE}\n`);

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

  // ---- 4. valid JSON-LD ----
  console.log("\n== Valid JSON-LD ==");
  for (const p of NEW_PAGES) {
    const blocks = extractJsonLd(pageData[p].body);
    if (blocks.length === 0) { fail(`${p}: no JSON-LD blocks found`); continue; }
    let allOk = true;
    for (const b of blocks) if (b.__parseError) { fail(`${p}: JSON-LD parse error`, b.__parseError); allOk = false; }
    if (allOk) ok();
    const types = blocks.map((b) => b["@type"]).filter(Boolean);
    if (types.includes("BreadcrumbList") && types.includes("Article")) ok();
    else fail(`${p}: expected BreadcrumbList + Article schema`, types.join(","));
  }

  // ---- 5. no content-brief / AI artifacts on any of the six ----
  console.log("\n== No content-brief / AI-artifact residue ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = ARTIFACT_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: appears to contain leftover content-brief/artifact text`, hit.toString());
  }

  // ---- 6. no invented reviews, prices, stats or response-time commitments ----
  console.log("\n== No unverified reviews, prices, statistics or fixed response times ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = INVENTED_CLAIM_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: contains an unverified/invented claim`, hit.toString());
  }

  // ---- 7. no procedural roadside lifting / DIY wheel-changing instructions ----
  console.log("\n== No procedural roadside lifting/wheel-changing instructions ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    const hit = PROCEDURAL_LIFTING_PATTERNS.find((re) => re.test(text));
    if (!hit) ok();
    else fail(`${p}: appears to contain procedural DIY jacking/wheel-changing instructions`, hit.toString());
  }

  // ---- 8. no fixed tyre-life or rotation-mileage claim ----
  console.log("\n== No fixed tyre-life or rotation-mileage claim ==");
  for (const p of NEW_PAGES) {
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!FIXED_MILEAGE_PATTERN.test(text)) ok();
    else fail(`${p}: appears to state a fixed mileage range`, text.match(FIXED_MILEAGE_PATTERN)?.[0]);
    if (!ROTATION_MILEAGE_PATTERN.test(text)) ok();
    else fail(`${p}: appears to state a fixed rotation-mileage figure`, text.match(ROTATION_MILEAGE_PATTERN)?.[0]);
  }

  // ---- 9. hill-jacking article: no slope-lifting instruction, correct safety framing ----
  console.log("\n== Hill-jacking article: safety framing ==");
  {
    const p = "/what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (/we won't (?:lift|attempt)|not safe to work|won't attempt the job/i.test(text)) ok();
    else fail(`${p}: expected explicit wording that an unsafe slope won't be worked on`);
    if (pageData[p].body.includes('href="/mobile-tyre-fitting/"')) ok();
    else fail(`${p}: expected a link to /mobile-tyre-fitting/`);
    if (pageData[p].body.includes('href="/24-7-mobile-tyre-replacement/"')) ok();
    else fail(`${p}: expected a link to /24-7-mobile-tyre-replacement/`);
  }

  // ---- 10. tyre-blowout article: verified emergency guidance, no live-lane stop, links to 24/7 page ----
  // Guidance verified against GOV.UK's Highway Code Annex 6 (see the
  // Phase 4B Batch D1 correction): "try to keep control", "grip the
  // steering wheel firmly", "allow the vehicle to roll to a stop",
  // "stop as soon as it is safe", "only change the tyre ... without
  // risk ... otherwise call a breakdown service". Annex 6 does NOT say
  // "ease off the accelerator rather than braking hard" — that wording
  // must never reappear.
  console.log("\n== Tyre-blowout article: emergency guidance ==");
  {
    const p = "/tyre-blowout-causes-prevention/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (/keep control|grip the steering wheel firmly/i.test(text)) ok();
    else fail(`${p}: expected guidance to keep control and grip the steering wheel firmly`);
    if (/roll to a stop/i.test(text)) ok();
    else fail(`${p}: expected guidance to let the vehicle roll to a stop`);
    if (/stop as soon as it'?s safe|stop as soon as it is safe/i.test(text)) ok();
    else fail(`${p}: expected guidance to stop as soon as it's safe`);
    if (/without (?:putting yourself or anyone else at risk|risk)|call (?:for )?breakdown assistance/i.test(text)) ok();
    else fail(`${p}: expected guidance to change the tyre only without risk, otherwise call for breakdown assistance`);
    if (!/ease off the accelerator|brake hard|braking hard/i.test(text)) ok();
    else fail(`${p}: contains the unsupported "ease off the accelerator / brake hard" wording — not in GOV.UK Annex 6`);
    if (!/stop (?:immediately )?in (?:the |a )?(?:live |moving )?(?:traffic )?lane/i.test(text)) ok();
    else fail(`${p}: appears to tell the driver to stop in a live traffic lane`);
    if (pageData[p].body.includes('href="/24-7-mobile-tyre-replacement/"')) ok();
    else fail(`${p}: expected a link to /24-7-mobile-tyre-replacement/`);
    if (!pageData[p].body.includes('href="/emergency-tyre-change/"')) ok();
    else fail(`${p}: links to the retired /emergency-tyre-change/ slug instead of /24-7-mobile-tyre-replacement/`);
  }

  // ---- 11. winter-Livingston article: no DIY spare-wheel steps, no unsafe-location wheel change, no endorsement framing ----
  console.log("\n== Winter-Livingston article: no DIY change steps, no endorsement framing ==");
  {
    const p = "/preparing-your-car-tyres-for-winter-driving-in-livingston/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/lift the boot floor|space-saver spare|connect the gel bottle|12v (?:air )?compressor/i.test(text)) ok();
    else fail(`${p}: appears to retain step-by-step DIY spare-wheel-changing instructions`);
    if (!/change (?:the|a) (?:wheel|tyre) (?:yourself )?(?:on the|on a) (?:motorway|hard shoulder|slope)/i.test(text)) ok();
    else fail(`${p}: appears to recommend changing a wheel on a motorway/hard shoulder/slope`);
    if (!/we recommend (?:the )?(?:aa|rac|green flag)|(?:aa|rac|green flag) is our (?:recommended|preferred|approved)/i.test(text)) ok();
    else fail(`${p}: appears to present a breakdown provider as an SFR endorsement`);
  }

  // ---- 12. buying-guide article: no universal "best" claim, GOV.UK-consistent tread wording ----
  // GOV.UK's Highway Code Annex 6 states only the 1.6mm legal minimum
  // (central three-quarters, full circumference) — it does not recommend
  // a "2mm in summer / 3mm in winter" replacement threshold (see the
  // Phase 4B Batch D1 correction). That attribution must never reappear,
  // and it must not be replaced with any other invented threshold.
  console.log("\n== Buying-guide article: no universal best-brand/tier claim, correct tread wording ==");
  {
    const p = "/how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/";
    const text = stripTags(mainContentHtml(pageData[p].body));
    if (!/\bthe best\b tyres? (?:are|is) always|always (?:the )?best/i.test(text)) ok();
    else fail(`${p}: appears to claim one brand/tier is universally best`);
    if (/1\.6\s?mm/i.test(text)) ok();
    else fail(`${p}: expected the UK legal tread-depth figure (1.6mm)`);
    if (!UNSUPPORTED_SEASONAL_THRESHOLD_PATTERN.test(text)) ok();
    else fail(`${p}: contains the unsupported "2mm summer / 3mm winter" GOV.UK attribution`);
    if (/doesn'?t automatically mean|not (?:a )?guarantee/i.test(text) && /condition.{0,20}damage.{0,20}pressure|pressure.{0,40}manufacturer/i.test(text)) ok();
    else fail(`${p}: expected wording that the legal minimum isn't a guarantee of safety — condition, damage, pressure and manufacturer guidance also matter`);
    if (pageData[p].body.includes('href="/our-tyre-range/"') && pageData[p].body.includes('href="/tyre-lifespan/"')) ok();
    else fail(`${p}: expected links to both /our-tyre-range/ and /tyre-lifespan/`);
  }

  // ---- 12a. site-wide regression guard: the unsupported seasonal threshold
  // and the "ease off / brake hard" GOV.UK misattribution must never
  // reappear anywhere on the site, not just on these two pages ----
  console.log("\n== Site-wide: no unsupported GOV.UK tread-depth or blowout attribution ==");
  {
    const allSiteFiles = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "assets") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "index.html") allSiteFiles.push(full);
      }
    })(DIST_DIR);
    let seasonalHits = 0;
    let blowoutHits = 0;
    for (const f of allSiteFiles) {
      const text = stripTags(fs.readFileSync(f, "utf8"));
      if (UNSUPPORTED_SEASONAL_THRESHOLD_PATTERN.test(text)) {
        seasonalHits++;
        console.log(`    unsupported seasonal threshold in: ${path.relative(DIST_DIR, f)}`);
      }
      if (/ease off the accelerator|brake hard|braking hard/i.test(text)) {
        blowoutHits++;
        console.log(`    unsupported blowout wording in: ${path.relative(DIST_DIR, f)}`);
      }
    }
    if (seasonalHits === 0) ok();
    else fail(`${seasonalHits} page(s) still attribute a "2mm summer / 3mm winter" threshold to GOV.UK`);
    if (blowoutHits === 0) ok();
    else fail(`${blowoutHits} page(s) still contain the unsupported "ease off the accelerator / brake hard" wording`);
  }

  // ---- 13. related pages remain differentiated (no duplicate substantive paragraphs) ----
  console.log("\n== Related pages remain differentiated ==");
  const relatedGroups = [
    ["/how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns/", "/tyre-lifespan/", "/better-tyres-better-drive/"],
    ["/mobile-tyre-fitting-livingston-tyre-problems/", "/preparing-your-car-tyres-for-winter-driving-in-livingston/", "/mobile-tyre-fitting-livingston/"],
    ["/how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/", "/our-tyre-range/", "/tyre-lifespan/"],
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

  // ---- 15. no broken internal links from the six new pages ----
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

  // ---- 16. no orphan pages — each of the six has at least one inbound link from elsewhere on the site ----
  console.log("\n== No orphan pages ==");
  for (const p of NEW_PAGES) {
    const linkedElsewhere = siteFiles.some((f) => {
      if (f === path.join(DIST_DIR, p.slice(1, -1), "index.html")) return false;
      return fs.readFileSync(f, "utf8").includes(`href="${p}"`);
    });
    if (linkedElsewhere) ok();
    else fail(`${p}: appears to be orphaned — no inbound link found anywhere on the site (beyond /blog/)`);
  }

  // ---- 17. all six listed on /blog/ ----
  console.log("\n== All six listed on /blog/ ==");
  {
    const blogHtml = fs.readFileSync(path.join(DIST_DIR, "blog", "index.html"), "utf8");
    for (const p of NEW_PAGES) {
      if (blogHtml.includes(`href="${p}"`)) ok();
      else fail(`/blog/: missing a link to ${p}`);
    }
  }

  // ---- 18. sitemap : page inventory 1:1, expected total ----
  console.log("\n== Sitemap, page inventory and totals ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]);
  if (sitemapUrls.length === siteFiles.length) ok();
  else fail(`sitemap has ${sitemapUrls.length} URLs but dist/ has ${siteFiles.length} pages`);
  for (const p of NEW_PAGES) {
    if (sitemapUrls.includes(p)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  if (siteFiles.length >= MIN_EXPECTED_PAGE_COUNT) ok();
  else fail(`expected at least ${MIN_EXPECTED_PAGE_COUNT} pages (Batch D1's own baseline)`, `got ${siteFiles.length}`);

  // ---- 19. redirect count unchanged at 19 ----
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
  const port = 8952;
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
