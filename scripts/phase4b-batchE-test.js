#!/usr/bin/env node
// Phase 4B Batch E regression tests — final 90-URL WordPress disposition
// reconciliation. This is a documentation/reconciliation batch: it does
// not add, remove or rewrite any site page, redirect, or generator. It
// independently re-derives the authoritative WordPress inventory from
// scripts/wp-export-inventory.json (itself extracted directly from the
// original WXR export, not from cached summaries) and cross-checks the
// disposition recorded for every one of the 90 URLs in
// scripts/phase4b-batchE-disposition.json against the ACTUAL built site,
// redirect map and sitemap — not against prose.
//
// This is in addition to — not a replacement for — scripts/phase3-test.js
// and scripts/phase4-test.js, which independently verify sitemap/page
// parity, canonicals, and internal-link health for the whole site via
// dynamic sweeps. This suite does not duplicate those checks; it
// specifically verifies the 90-URL WordPress disposition matrix.
//
// Per the Batch E instruction, this suite intentionally carries NO
// site-wide page/redirect total assertion of its own (expected site
// pages: 80, expected redirects: 19 — both already verified by every
// other regression suite). Its own totals are the 90-URL disposition
// counts, which are fixed by definition (the WordPress export doesn't
// change) and are therefore not "brittle" in the sense the other
// batch-specific suites' page counts were.
//
// Run: `node scripts/phase4b-batchE-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");

const results = { pass: 0, fail: 0 };
function ok() { results.pass++; }
function fail(label, detail) {
  results.fail++;
  console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
}

const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "wp-export-inventory.json"), "utf8"));
const disposition = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "phase4b-batchE-disposition.json"), "utf8"));
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const sitemapXml = fs.readFileSync(path.join(SITE_DIR, "sitemap.xml"), "utf8");
const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]));

function pageFileExists(urlPath) {
  const slug = urlPath.replace(/^\/|\/$/g, "");
  const filePath = slug === "" ? path.join(SITE_DIR, "index.html") : path.join(SITE_DIR, slug, "index.html");
  return fs.existsSync(filePath);
}

console.log("Phase 4B Batch E reconciliation tests\n");

// ---- 1. exactly 90 published WordPress URLs, 37 pages + 53 posts ----
console.log("== WordPress inventory totals ==");
if (inventory.total === 90) ok();
else fail("expected 90 published WordPress URLs", `got ${inventory.total}`);
if (inventory.urls.length === 90) ok();
else fail("inventory.urls array length mismatch", `got ${inventory.urls.length}`);
if (inventory.pages === 37) ok();
else fail("expected 37 published pages", `got ${inventory.pages}`);
if (inventory.posts === 53) ok();
else fail("expected 53 published posts", `got ${inventory.posts}`);
const actualPages = inventory.urls.filter((u) => u.type === "page").length;
const actualPosts = inventory.urls.filter((u) => u.type === "post").length;
if (actualPages === 37) ok();
else fail("recount of page-type entries", `got ${actualPages}`);
if (actualPosts === 53) ok();
else fail("recount of post-type entries", `got ${actualPosts}`);

// ---- 2. no duplicate source URLs in the inventory ----
console.log("\n== No duplicate URLs in the WordPress inventory ==");
{
  const seen = new Set();
  let dupes = 0;
  for (const u of inventory.urls) {
    if (seen.has(u.url)) { dupes++; console.log(`    duplicate: ${u.url}`); }
    seen.add(u.url);
  }
  if (dupes === 0) ok();
  else fail(`${dupes} duplicate URL(s) found in the WordPress inventory`);
}

// ---- 3. disposition matrix covers exactly the same 90 URLs, one disposition each ----
console.log("\n== Disposition matrix: exactly 90 entries, matching the inventory 1:1 ==");
if (disposition.total === 90) ok();
else fail("expected 90 disposition entries", `got ${disposition.total}`);
if (disposition.entries.length === 90) ok();
else fail("disposition.entries array length mismatch", `got ${disposition.entries.length}`);
{
  const inventoryUrls = new Set(inventory.urls.map((u) => u.url));
  const dispositionUrls = new Set(disposition.entries.map((e) => e.url));
  const missingFromDisposition = [...inventoryUrls].filter((u) => !dispositionUrls.has(u));
  const extraInDisposition = [...dispositionUrls].filter((u) => !inventoryUrls.has(u));
  if (missingFromDisposition.length === 0) ok();
  else fail(`${missingFromDisposition.length} WordPress URL(s) have no disposition entry`, missingFromDisposition.slice(0, 5).join(", "));
  if (extraInDisposition.length === 0) ok();
  else fail(`${extraInDisposition.length} disposition entry/entries don't correspond to a real WordPress URL`, extraInDisposition.slice(0, 5).join(", "));
  const seenDisp = new Set();
  let dispDupes = 0;
  for (const e of disposition.entries) {
    if (seenDisp.has(e.url)) { dispDupes++; console.log(`    duplicate disposition entry: ${e.url}`); }
    seenDisp.add(e.url);
  }
  if (dispDupes === 0) ok();
  else fail(`${dispDupes} duplicate disposition entry/entries found`);
}

// ---- 4. final disposition totals sum to exactly 90 ----
console.log("\n== Final disposition totals sum to exactly 90 ==");
{
  const counts = {};
  for (const e of disposition.entries) counts[e.disposition] = (counts[e.disposition] || 0) + 1;
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`    ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  if (sum === 90) ok();
  else fail("disposition totals do not sum to 90", `got ${sum}`);
  const VALID = new Set(["Preserved", "Recreated", "Redirected", "Excluded", "Pending GSC decision"]);
  const invalid = disposition.entries.filter((e) => !VALID.has(e.disposition));
  if (invalid.length === 0) ok();
  else fail(`${invalid.length} entry/entries have an unrecognised disposition value`, invalid.slice(0, 3).map((e) => `${e.url}=${e.disposition}`).join(", "));
}

// ---- 5. every "Preserved"/"Recreated" disposition resolves to a real generated page ----
console.log("\n== Every Preserved/Recreated URL resolves to a real page ==");
{
  const pageDispositions = disposition.entries.filter((e) => e.disposition === "Preserved" || e.disposition === "Recreated");
  let missing = 0;
  for (const e of pageDispositions) {
    if (pageFileExists(e.url)) ok();
    else { missing++; fail(`${e.url}: marked "${e.disposition}" but no page file exists`); }
  }
  console.log(`    checked ${pageDispositions.length} page-disposition URLs (${missing} missing)`);
}

// ---- 6. every "Redirected" disposition exists as a source in infra/redirects.json, and its destination resolves to a real page ----
console.log("\n== Every Redirected URL exists in infra/redirects.json with a resolvable destination ==");
{
  const redirectMap = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));
  const redirectDispositions = disposition.entries.filter((e) => e.disposition === "Redirected");
  for (const e of redirectDispositions) {
    if (redirectMap.has(e.url)) ok();
    else fail(`${e.url}: marked "Redirected" but no matching source exists in infra/redirects.json`);
    const actualDest = redirectMap.get(e.url);
    if (actualDest && pageFileExists(actualDest)) ok();
    else fail(`${e.url}: redirect destination "${actualDest}" does not resolve to a real page`);
  }
  console.log(`    checked ${redirectDispositions.length} redirect-disposition URLs`);
}

// ---- 7. no redirect chains or loops anywhere in the full redirect map ----
console.log("\n== No redirect chains or loops ==");
{
  const sources = new Set(vercelConfig.redirects.map((r) => r.source));
  let chains = 0;
  for (const r of vercelConfig.redirects) {
    if (sources.has(r.destination)) { chains++; console.log(`    chain: ${r.source} -> ${r.destination} (itself a redirect source)`); }
    if (r.source === r.destination) { chains++; console.log(`    loop: ${r.source} -> itself`); }
  }
  if (chains === 0) ok();
  else fail(`${chains} redirect chain(s)/loop(s) detected across all ${vercelConfig.redirects.length} redirects`);
}

// ---- 8. no Excluded or Pending-GSC URL appears in the sitemap, or was accidentally built as a page ----
console.log("\n== Excluded / Pending-GSC URLs: no sitemap entry, no accidental page ==");
{
  const nonPageDispositions = disposition.entries.filter((e) => e.disposition === "Excluded" || e.disposition === "Pending GSC decision");
  for (const e of nonPageDispositions) {
    if (!sitemapUrls.has(e.url)) ok();
    else fail(`${e.url}: marked "${e.disposition}" but appears in sitemap.xml`);
    if (!pageFileExists(e.url)) ok();
    else fail(`${e.url}: marked "${e.disposition}" but a page file exists for it`);
  }
  console.log(`    checked ${nonPageDispositions.length} excluded/pending URLs`);
}

// ---- 9. every sitemap URL resolves to a real page ----
console.log("\n== Every sitemap URL resolves to a real page ==");
{
  let missing = 0;
  for (const u of sitemapUrls) {
    if (pageFileExists(u)) ok();
    else { missing++; fail(`sitemap.xml: ${u} does not resolve to a real page`); }
  }
  console.log(`    checked ${sitemapUrls.size} sitemap URLs (${missing} unresolved)`);
}

// ---- 10. every generated indexable (Preserved/Recreated) page has a self-referencing canonical ----
console.log("\n== Self-referencing canonicals on every Preserved/Recreated page ==");
{
  const pageDispositions = disposition.entries.filter((e) => e.disposition === "Preserved" || e.disposition === "Recreated");
  let bad = 0;
  for (const e of pageDispositions) {
    if (!pageFileExists(e.url)) continue; // already reported above
    const slug = e.url.replace(/^\/|\/$/g, "");
    const filePath = slug === "" ? path.join(SITE_DIR, "index.html") : path.join(SITE_DIR, slug, "index.html");
    const html = fs.readFileSync(filePath, "utf8");
    const m = html.match(/<link rel="canonical" href="([^"]+)">/);
    const expected = `https://sfrmotors.co.uk${e.url}`;
    if (m && m[1] === expected) ok();
    else { bad++; fail(`${e.url}: canonical mismatch or missing`, m ? m[1] : "no canonical tag found"); }
  }
  console.log(`    checked ${pageDispositions.length} pages (${bad} bad)`);
}

// ---- 11. no stale .html URLs or retired/redirect-source slugs remain in internal links ----
console.log("\n== No stale .html links or links to a retired (redirect-source) slug ==");
{
  const redirectSources = new Set(vercelConfig.redirects.map((r) => r.source));
  const siteFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "assets") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") siteFiles.push(full);
    }
  })(SITE_DIR);
  let htmlLinkHits = 0;
  let staleSlugHits = 0;
  for (const f of siteFiles) {
    const html = fs.readFileSync(f, "utf8");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (/^https?:\/\//i.test(href) || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("#")) continue;
      if (/\.html(?:[?#]|$)/i.test(href)) {
        htmlLinkHits++;
        console.log(`    stale .html link in ${path.relative(SITE_DIR, f)}: ${href}`);
      }
      const clean = href.split("#")[0].split("?")[0];
      if (redirectSources.has(clean)) {
        staleSlugHits++;
        console.log(`    link to a retired (redirect-source) slug in ${path.relative(SITE_DIR, f)}: ${href}`);
      }
    }
  }
  if (htmlLinkHits === 0) ok();
  else fail(`${htmlLinkHits} stale .html link(s) found`);
  if (staleSlugHits === 0) ok();
  else fail(`${staleSlugHits} internal link(s) to a retired/redirect-source slug found`);
  console.log(`    swept ${siteFiles.length} site files`);
}

// ---- 12. the two D3 exclusions carry the documented "Pending GSC decision" status ----
console.log("\n== D3 exclusions carry the documented pending-GSC status ==");
{
  const D3_PENDING = [
    "/spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/",
    "/what-to-expect-from-a-same-day-mobile-car-repair-service/",
  ];
  for (const u of D3_PENDING) {
    const entry = disposition.entries.find((e) => e.url === u);
    if (entry && entry.disposition === "Pending GSC decision" && entry.gsc_required === "Yes") ok();
    else fail(`${u}: expected disposition "Pending GSC decision" with gsc_required "Yes"`, entry ? JSON.stringify(entry) : "not found");
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULT: ${results.pass} passed, ${results.fail} failed`);
console.log(`${"=".repeat(50)}`);

process.exit(results.fail > 0 ? 1 : 0);
