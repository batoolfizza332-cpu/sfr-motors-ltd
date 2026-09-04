#!/usr/bin/env node
// Phase 4B Batch A regression tests — the 9 URLs this batch added, renamed,
// or redirected:
//   New location pages (7): mobile-tyre-fitting-{boness,harthill,
//     in-addiewell,linlithgow,west-calder,shotts,wishaw}
//   Renamed (1): /caravan-trailer-tyre-fitting/ -> /mobile-trailer-and-caravan-tyre-fitting/
//     (with a 301 redirect from the old new-site-only slug)
//   New primary page (1): /24-7-mobile-tyre-replacement/ (retained per
//     WORDPRESS_MIGRATION_AUDIT.md §6 Q4)
//   Batch A correction: /emergency-tyre-change/ retired and 301-redirected
//     to /24-7-mobile-tyre-replacement/ after confirming the two pages
//     substantially overlapped in keyword targeting and search intent
//     (cannibalisation risk) — its unique content (5-step emergency safety
//     section, 2 FAQ entries) was merged into the primary page first.
//
// This is in addition to — not a replacement for — scripts/phase3-test.js,
// scripts/phase3b-old-url-test.js and scripts/phase4-test.js, which already
// cover these pages generically (sitemap inclusion, canonical self-match,
// single H1, no duplicate titles/meta, valid JSON-LD, no orphan pages,
// redirect single-hop). This file adds Batch-A-specific assertions.
//
// Run: `node scripts/phase4b-batchA-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const SITE_DIR = path.join(ROOT, "site");
const PORT = 8940;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".xml": "application/xml" }[ext] || "application/octet-stream";
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);
  if (REDIRECTS.has(p)) {
    res.writeHead(301, { Location: REDIRECTS.get(p) });
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

const NEW_LOCATION_PAGES = [
  "/mobile-tyre-fitting-boness/",
  "/mobile-tyre-fitting-harthill/",
  "/mobile-tyre-fitting-in-addiewell/",
  "/mobile-tyre-fitting-linlithgow/",
  "/mobile-tyre-fitting-west-calder/",
  "/mobile-tyre-fitting-shotts/",
  "/mobile-tyre-fitting-wishaw/",
];
const RENAMED_URL = "/mobile-trailer-and-caravan-tyre-fitting/";
const RETIRED_URL = "/caravan-trailer-tyre-fitting/";
const NEW_247_URL = "/24-7-mobile-tyre-replacement/";
const RETIRED_EMERGENCY_URL = "/emergency-tyre-change/";

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Phase 4B Batch A regression tests — server at ${BASE}\n`);

  // ---- 1. every new/renamed page returns 200 ----
  console.log("== New and renamed pages: 200 ==");
  for (const p of [...NEW_LOCATION_PAGES, RENAMED_URL, NEW_247_URL]) {
    const res = await get(p);
    if (res.status === 200) ok();
    else fail(`${p}: expected 200`, `got ${res.status}`);
  }

  // ---- 2. Shotts and Wishaw do not contain the mismatched live-site content ----
  console.log("\n== Shotts/Wishaw: no migrated wrong-town content ==");
  const shotts = await get("/mobile-tyre-fitting-shotts/");
  if (/Bathgate town centre|based in Bathgate, but our service/i.test(shotts.body)) {
    fail("/mobile-tyre-fitting-shotts/: appears to contain the mismatched live Bathgate copy");
  } else ok();
  if (/Shotts/.test(shotts.body)) ok();
  else fail("/mobile-tyre-fitting-shotts/: page does not even mention Shotts");

  const wishaw = await get("/mobile-tyre-fitting-wishaw/");
  if (/Leith|Princes Street|A720 City Bypass/i.test(wishaw.body)) {
    fail("/mobile-tyre-fitting-wishaw/: appears to contain the mismatched live Edinburgh copy");
  } else ok();
  if (/Wishaw/.test(wishaw.body)) ok();
  else fail("/mobile-tyre-fitting-wishaw/: page does not even mention Wishaw");

  // ---- 3. retired slug redirects in exactly one hop, no chain ----
  console.log("\n== Retired /caravan-trailer-tyre-fitting/ slug ==");
  const r1 = await get(RETIRED_URL);
  if (r1.status === 301 && r1.headers.location === RENAMED_URL) ok();
  else fail(`${RETIRED_URL}: expected 301 -> ${RENAMED_URL}`, `got ${r1.status} ${r1.headers.location || ""}`);
  const r2 = await get(RENAMED_URL);
  if (r2.status === 200) ok();
  else fail(`${RENAMED_URL}: destination did not return 200`, `got ${r2.status}`);
  // no chain: the destination itself must not also be a redirect source
  if (!REDIRECTS.has(RENAMED_URL)) ok();
  else fail(`${RENAMED_URL}: is itself a redirect source — this would be a chain`);

  // ---- 4. renamed page preserved its content (not a stub) ----
  console.log("\n== Renamed trailer/caravan page: content preserved ==");
  if (r2.body.includes("Do caravan and trailer tyres need replacing more often")) ok();
  else fail(`${RENAMED_URL}: expected FAQ content from the original page not found — looks like content was lost, not just renamed`);
  if (/mobile-trailer-and-caravan-tyre-fitting/.test(r2.body.match(/<link rel="canonical" href="([^"]+)">/)?.[1] || "")) ok();
  else fail(`${RENAMED_URL}: canonical does not point to the new URL`);
  if (!r2.body.includes("caravan-trailer-tyre-fitting/\"")) ok();
  else fail(`${RENAMED_URL}: still contains a self-reference to the old slug`);

  // ---- 5. /24-7-mobile-tyre-replacement/ is the sole primary page; /emergency-tyre-change/ is retired ----
  console.log("\n== 24/7 replacement page (primary) + retired emergency-tyre-change ==");
  const new247 = await get(NEW_247_URL);
  if (new247.status === 200) ok();
  else fail(`${NEW_247_URL}: expected 200`, `got ${new247.status}`);
  const canon247 = new247.body.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (canon247 === `https://sfrmotors.co.uk${NEW_247_URL}`) ok();
  else fail(`${NEW_247_URL}: canonical mismatch`, canon247);
  // the retired page's unique content (safety steps, FAQs) must have been merged in
  if (new247.body.includes("Move To Safety") && new247.body.includes("Hazard Lights On") && new247.body.includes("Share Your Location") && new247.body.includes("Wait Safely")) ok();
  else fail(`${NEW_247_URL}: expected the merged 5-step emergency safety section not found`);
  const hasLocationFaq = new247.body.includes("What if I don&#39;t know my exact location?") || new247.body.includes("What if I don't know my exact location?");
  if (new247.body.includes("What counts as a tyre emergency?") && hasLocationFaq) ok();
  else fail(`${NEW_247_URL}: expected the merged FAQ entries from /emergency-tyre-change/ not found`);
  // the retired URL must redirect in exactly one hop, straight to the primary page — not indexable, not a chain
  const retired = await get(RETIRED_EMERGENCY_URL);
  if (retired.status === 301 && retired.headers.location === NEW_247_URL) ok();
  else fail(`${RETIRED_EMERGENCY_URL}: expected 301 -> ${NEW_247_URL}`, `got ${retired.status} ${retired.headers.location || ""}`);
  if (!REDIRECTS.has(NEW_247_URL)) ok();
  else fail(`${NEW_247_URL}: is itself a redirect source — this would create a chain from ${RETIRED_EMERGENCY_URL}`);
  // the retired page must no longer exist as a built file (not indexable)
  if (!fs.existsSync(path.join(DIST_DIR, "emergency-tyre-change", "index.html"))) ok();
  else fail(`${RETIRED_EMERGENCY_URL}: page file still exists in dist/ — it should have been removed`);
  // the redirect that used to chain through it now points straight to the primary page
  const chainCheck = await get("/emergency-tyre-fitter-edinburgh-falkirk/");
  if (chainCheck.status === 301 && chainCheck.headers.location === NEW_247_URL) ok();
  else fail(`/emergency-tyre-fitter-edinburgh-falkirk/: expected direct 301 -> ${NEW_247_URL} (no chain through the retired page)`, `got ${chainCheck.status} ${chainCheck.headers.location || ""}`);

  // ---- 6. nowhere on the site still links to a retired slug ----
  console.log("\n== No remaining internal links to a retired slug ==");
  const siteFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "assets") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") siteFiles.push(full);
    }
  })(SITE_DIR);
  for (const retiredSlug of [RETIRED_URL, RETIRED_EMERGENCY_URL]) {
    let staleLinks = 0;
    for (const f of siteFiles) {
      const html = fs.readFileSync(f, "utf8");
      if (html.includes(`href="${retiredSlug}"`) || html.includes(`"url": "https://sfrmotors.co.uk${retiredSlug}"`) || html.includes(`"url": "${retiredSlug}"`)) {
        staleLinks++;
        console.log(`    stale link to ${retiredSlug} in: ${path.relative(SITE_DIR, f)}`);
      }
    }
    if (staleLinks === 0) ok();
    else fail(`${staleLinks} file(s) still link to the retired slug ${retiredSlug}`);
  }

  // ---- 7. homepage area pins now point to the new dedicated pages, not the West Lothian hub ----
  console.log("\n== Homepage area pins updated ==");
  const home = await get("/");
  for (const p of NEW_LOCATION_PAGES) {
    if (home.body.includes(`href="${p}"`)) ok();
    else fail(`homepage: expected an area pin linking to ${p}`);
  }

  // ---- 8. sitemap includes all 9 Batch A URLs (7 new locations + renamed + new 24/7 page), and NOT any retired slug ----
  console.log("\n== Sitemap ==");
  const sitemap = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  for (const p of [...NEW_LOCATION_PAGES, RENAMED_URL, NEW_247_URL]) {
    if (sitemap.includes(`https://sfrmotors.co.uk${p}`)) ok();
    else fail(`sitemap.xml: missing ${p}`);
  }
  for (const retiredSlug of [RETIRED_URL, RETIRED_EMERGENCY_URL]) {
    if (!sitemap.includes(`https://sfrmotors.co.uk${retiredSlug}`)) ok();
    else fail(`sitemap.xml: still contains the retired ${retiredSlug}`);
  }

  server.close();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULT: ${results.pass} passed, ${results.fail} failed`);
  console.log(`${"=".repeat(50)}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
