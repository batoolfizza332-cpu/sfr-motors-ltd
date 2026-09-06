#!/usr/bin/env node
// Phase 4B Batch F regression tests — final pre-launch verification gate.
//
// Unlike scripts/batchF-audit.js, scripts/batchF-redirect-verify.js and
// scripts/batchF-a11y-qa.js (data-gathering crawlers that write JSON
// reports for PRELAUNCH_READINESS_REPORT.md), this is the pass/fail gate:
// it consumes those reports plus its own direct checks and fails loudly
// if any launch-critical requirement isn't met.
//
// Per the Batch F instruction, this suite avoids brittle historical
// constants — it doesn't hardcode "80 pages" or "19 redirects" as magic
// numbers scattered through assertions; it reads the actual built site
// and infra/redirects.json and checks the fixtures/build agree with
// each other and with the requirements, not against a number frozen at
// batch-write time. (The one placed where an exact number IS meaningful
// — "the two named pending-GSC URLs are still pending, not guessed at"
// — is a small fixed list, not a whole-site count.)
//
// Run: `node scripts/phase4b-batchF-test.js` (after `npm run build`,
// `node scripts/batchF-audit.js`, `node scripts/batchF-redirect-verify.js`
// and `node scripts/batchF-a11y-qa.js`, in that order).
//
// Lighthouse (performance/security readiness, Part 8) is run separately
// and by hand, not wired into this gate — it needs a real Chrome binary
// and a running HTTP server on dist/, which isn't worth the coupling for
// a report-only, non-pass/fail check. See PRELAUNCH_READINESS_REPORT.md
// §11 for its results.

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const DIST_DIR = path.join(ROOT, "dist");

const results = { pass: 0, fail: 0 };
function ok() { results.pass++; }
function fail(label, detail) {
  results.fail++;
  console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
}
function check(label, cond, detail) {
  if (cond) ok();
  else fail(label, detail);
}

function loadJson(rel, label) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    fail(`${label} exists`, `missing ${rel} — run its generator first`);
    return null;
  }
  ok();
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

console.log("Phase 4B Batch F pre-launch regression tests\n");

// ---- 0. Required Batch F fixtures exist ----
console.log("== Batch F fixtures present ==");
const pageAudit = loadJson("PRELAUNCH_PAGE_AUDIT.json", "PRELAUNCH_PAGE_AUDIT.json");
const redirectAudit = loadJson("PRELAUNCH_REDIRECT_AUDIT.json", "PRELAUNCH_REDIRECT_AUDIT.json");
const a11yReport = loadJson("PRELAUNCH_A11Y_QA_REPORT.json", "PRELAUNCH_A11Y_QA_REPORT.json");

// ---- 1. Production build sanity ----
console.log("\n== Production build ==");
check("dist/ exists (production build has been run)", fs.existsSync(DIST_DIR));
function countBuiltPages(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countBuiltPages(full);
    else if (entry.name === "index.html") n += 1;
  }
  return n;
}
const builtPageCount = fs.existsSync(DIST_DIR) ? countBuiltPages(DIST_DIR) : 0;
function countSitePages(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countSitePages(full);
    else if (entry.name === "index.html") n += 1;
  }
  return n;
}
const sitePageCount = countSitePages(SITE_DIR);
check("dist/ page count matches site/ page count (no build drift)", builtPageCount === sitePageCount, `dist=${builtPageCount} site=${sitePageCount}`);
check("at least one page was built", builtPageCount > 0);

// ---- 2. No leaked internal/private files in the deployable output ----
console.log("\n== No leaked internal files in dist/ ==");
function findLeaks(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { findLeaks(full, out); continue; }
    if (/\.json$/i.test(entry.name)) out.push(full);
    if (/wxr|wp-export|disposition|audit/i.test(entry.name)) out.push(full);
  }
  return out;
}
const leaks = fs.existsSync(DIST_DIR) ? findLeaks(DIST_DIR) : [];
check("dist/ contains no JSON fixtures, WXR export or audit files", leaks.length === 0, leaks.join(", "));

const SECRET_PATTERNS = [/AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/, /["']?password["']?\s*[:=]\s*["'][^"']{4,}["']/i];
let secretHits = [];
if (fs.existsSync(DIST_DIR)) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(html|js|css|txt|xml)$/i.test(entry.name)) continue;
      const content = fs.readFileSync(full, "utf8");
      for (const pat of SECRET_PATTERNS) if (pat.test(content)) secretHits.push(`${path.relative(ROOT, full)} matched ${pat}`);
    }
  };
  walk(DIST_DIR);
}
check("dist/ contains no obvious secret/credential patterns", secretHits.length === 0, secretHits.join("; "));

// ---- 3. Generator/configuration drift ----
console.log("\n== Generator drift ==");
const redirectsJson = JSON.parse(fs.readFileSync(path.join(ROOT, "infra", "redirects.json"), "utf8"));
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const cfSrc = fs.readFileSync(path.join(ROOT, "infra", "cloudfront-function.js"), "utf8");
const templateSrc = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8");

const srcMap = new Map(redirectsJson.redirects.map((r) => [r.source, r.destination]));
const vercelMap = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));
let vercelMatches = vercelMap.size === srcMap.size;
for (const [s, d] of srcMap) if (vercelMap.get(s) !== d) vercelMatches = false;
check("vercel.json redirects match infra/redirects.json exactly", vercelMatches);
check("vercel.json trailingSlash is true", vercelConfig.trailingSlash === true);
check("every vercel.json redirect uses statusCode 301", vercelConfig.redirects.every((r) => r.statusCode === 301));

const cfMatch = cfSrc.match(/var REDIRECTS = (\{[\s\S]*?\n\});/);
let cfMatches = false;
if (cfMatch) {
  const cfRedirects = JSON.parse(cfMatch[1]);
  cfMatches = Object.keys(cfRedirects).length === srcMap.size && [...srcMap].every(([s, d]) => cfRedirects[s] === d);
}
check("infra/cloudfront-function.js REDIRECTS matches infra/redirects.json exactly", cfMatches);
check("infra/template.yaml embeds every redirect source", redirectsJson.redirects.every((r) => templateSrc.includes(r.source)));
check("infra/template.yaml embeds every redirect destination", redirectsJson.redirects.every((r) => templateSrc.includes(r.destination)));

// package-lock.json must be tracked so `npm ci` works from a fresh clone.
const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
check("package-lock.json is not gitignored (npm ci works from a fresh clone)", !/^package-lock\.json$/m.test(gitignore));
check("package-lock.json exists on disk", fs.existsSync(path.join(ROOT, "package-lock.json")));

// ---- 4. Sitemap-to-page reconciliation ----
console.log("\n== Sitemap reconciliation ==");
const sitemapXml = fs.readFileSync(path.join(SITE_DIR, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("sitemap.xml URL count matches built page count", sitemapUrls.length === builtPageCount, `sitemap=${sitemapUrls.length} pages=${builtPageCount}`);
check("sitemap.xml has no duplicate URLs", new Set(sitemapUrls).size === sitemapUrls.length);

const disposition = loadJson("scripts/phase4b-batchE-disposition.json", "scripts/phase4b-batchE-disposition.json");
if (disposition) {
  const sitemapPaths = new Set(sitemapUrls.map((u) => u.replace("https://sfrmotors.co.uk", "")));
  const excludedOrRedirected = disposition.entries.filter((e) => e.disposition === "Excluded" || e.disposition === "Redirected" || e.disposition === "Pending GSC decision");
  const leaked = excludedOrRedirected.filter((e) => sitemapPaths.has(e.url));
  check("no excluded/redirected/pending URL appears in sitemap.xml", leaked.length === 0, leaked.map((e) => e.url).join(", "));

  const pendingUrls = disposition.entries.filter((e) => e.disposition === "Pending GSC decision").map((e) => e.url).sort();
  check(
    "both pending-GSC URLs are still explicitly pending (not silently resolved)",
    pendingUrls.length === 2 &&
      pendingUrls.includes("/spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/") &&
      pendingUrls.includes("/what-to-expect-from-a-same-day-mobile-car-repair-service/"),
    pendingUrls.join(", ")
  );
  for (const url of pendingUrls) {
    check(`pending URL ${url} is not redirected to the homepage`, srcMap.get(url) !== "/");
    check(`pending URL ${url} has no redirect entry at all`, !srcMap.has(url));
  }
}

// robots.txt
const robotsTxt = fs.readFileSync(path.join(SITE_DIR, "robots.txt"), "utf8");
check("robots.txt allows crawling (no blanket Disallow)", !/Disallow:\s*\/\s*$/m.test(robotsTxt));
check("robots.txt references the production sitemap URL", robotsTxt.includes("https://sfrmotors.co.uk/sitemap.xml"));

// No noindex directive survives anywhere in the built output.
let noindexPages = [];
(function walkForNoindex(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walkForNoindex(full); continue; }
    if (entry.name !== "index.html") continue;
    const html = fs.readFileSync(full, "utf8");
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) noindexPages.push(path.relative(DIST_DIR, full));
  }
})(DIST_DIR);
check("no page in dist/ carries a noindex directive", noindexPages.length === 0, noindexPages.join(", "));

// ---- 5. Full 80-page audit fixture: every category is clean or the one documented exception ----
console.log("\n== Full-site SEO/content audit (from PRELAUNCH_PAGE_AUDIT.json) ==");
if (pageAudit) {
  const pages = pageAudit.pages;
  check("every audited page returned HTTP 200", pages.every((p) => p.httpStatus === 200));
  check("every audited page has exactly one H1", pages.every((p) => p.h1Count === 1));
  check("no duplicate titles sitewide", pageAudit.duplicateTitles.length === 0, JSON.stringify(pageAudit.duplicateTitles));
  check("no duplicate meta descriptions sitewide", pageAudit.duplicateMetaDescriptions.length === 0, JSON.stringify(pageAudit.duplicateMetaDescriptions));
  check("every page's canonical self-matches", pages.every((p) => p.canonicalSelfMatch));
  check("every page's og:url matches its canonical", pages.every((p) => p.ogUrlMatchesCanonical));
  check("every page is indexable (index, follow)", pages.every((p) => p.robotsMeta === "index, follow"));
  check("no JSON-LD parse errors anywhere", pages.every((p) => p.jsonLdParseErrors.length === 0));
  check("no page has a self-serving AggregateRating", pages.every((p) => !p.hasAggregateRating));
  check("every JSON-LD url field uses the correct production domain", pages.every((p) => p.jsonLdUrlsUseCorrectDomain));
  check("every page is listed in the sitemap", pages.every((p) => p.inSitemap));
  check("no page has a broken internal link", pages.every((p) => p.brokenInternalLinks.length === 0));
  check("no page links to a stale (pre-redirect) URL", pages.every((p) => p.staleRedirectSourceLinks.length === 0));
  check("no page links to a .html URL", pages.every((p) => p.htmlExtensionLinks.length === 0));
  check("no page links to a preview/localhost URL", pages.every((p) => p.previewOrLocalhostLinks.length === 0));
  check("no page has a broken local asset reference", pages.every((p) => p.brokenLocalAssets.length === 0));
  check("every page has a phone link", pages.every((p) => p.hasPhoneLink));
  check("every page has a WhatsApp link", pages.every((p) => p.hasWhatsAppLink));
  check("no page uses a stale company name", pages.every((p) => !p.hasStaleCompanyName));
  check("no page makes a nationwide-coverage claim", pages.every((p) => !p.hasNationwideClaim));
  check("no page makes an unsupported price claim", pages.every((p) => !p.hasUnsupportedPriceClaim));
  check("no page contains placeholder text", pages.every((p) => !p.hasPlaceholderText));
  check("no page contains Devanagari/non-English placeholder text", pages.every((p) => !p.hasDevanagariText));
  check("no page has unrequired American spelling (outside the documented URL exception)", pages.every((p) => !p.hasAmericanSpelling || p.americanSpellingIsUrlException));
  check("no orphan pages", pages.every((p) => !p.isOrphan));

  // The one documented finding from this batch: the homepage testimonial's
  // "within 30 minutes" phrase trips the unsupported-arrival-time pattern
  // but is a real, named, sourced Google review — reviewed and accepted,
  // not a defect. This test locks that in as the ONLY page allowed to
  // trip that pattern, so a new unverified arrival-time claim elsewhere
  // still fails the suite.
  const arrivalTimeHits = pages.filter((p) => p.hasUnsupportedArrivalTimeClaim).map((p) => p.url);
  check(
    "the only page tripping the unsupported-arrival-time pattern is the reviewed homepage testimonial",
    arrivalTimeHits.length === 1 && arrivalTimeHits[0] === "/",
    JSON.stringify(arrivalTimeHits)
  );
}

// ---- 6. Redirect verification (from PRELAUNCH_REDIRECT_AUDIT.json) ----
console.log("\n== Redirect verification (from PRELAUNCH_REDIRECT_AUDIT.json) ==");
if (redirectAudit) {
  check("every redirect verified 301 + correct Location", redirectAudit.redirects.every((r) => r.ok));
  check("every redirect count matches infra/redirects.json", redirectAudit.redirects.length === redirectsJson.redirects.length);
  check("no redirect chains (destination is not itself a redirect source)", redirectAudit.redirects.every((r) => !srcMap.has(r.destination)));
  check("every redirect destination returns 200 and exists in the build", redirectAudit.redirects.every((r) => r.destinationStatus === 200 && r.destinationExistsInBuild));
  check("all 3 source-of-truth drift checks passed", redirectAudit.driftChecks.every((d) => d.ok));
  check("all representative-request simulations passed", redirectAudit.simulations.every((s) => s.ok));
  const unknownUrlSim = redirectAudit.simulations.find((s) => s.label.includes("unknown URL"));
  check("unknown URL returns a true 404 (not a soft-404 200)", !!unknownUrlSim && unknownUrlSim.actualStatus === 404);
  const htmlVariantSim = redirectAudit.simulations.find((s) => s.label.includes(".html variant"));
  check("retired .html variant is not silently served — returns a true 404", !!htmlVariantSim && htmlVariantSim.actualStatus === 404);
}

// ---- 7. Mobile/accessibility/functional QA (from PRELAUNCH_A11Y_QA_REPORT.json) ----
console.log("\n== Accessibility & functional QA (from PRELAUNCH_A11Y_QA_REPORT.json) ==");
if (a11yReport) {
  check("mobile axe sweep covered every built page", a11yReport.summary.pagesScanned === builtPageCount, `scanned=${a11yReport.summary.pagesScanned} built=${builtPageCount}`);
  check("zero critical axe violations at mobile viewport", a11yReport.summary.byImpact.critical === 0, `critical=${a11yReport.summary.byImpact.critical}`);
  check("zero serious axe violations at mobile viewport", a11yReport.summary.byImpact.serious === 0, `serious=${a11yReport.summary.byImpact.serious}`);
  check("no page has horizontal overflow at 390px", a11yReport.summary.overflowPages.length === 0, JSON.stringify(a11yReport.summary.overflowPages));
  check("no page raised a JS console error / page error / failed network request", a11yReport.summary.pagesWithConsoleOrNetworkIssues === 0, JSON.stringify(a11yReport.consoleErrors.map((c) => c.page)));
  check("all functional QA checks passed (nav, skip link, forms, calculator, keyboard)", a11yReport.summary.functionalChecksFailed === 0, JSON.stringify(a11yReport.functional.filter((f) => !f.ok).map((f) => f.label)));
}

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULT: ${results.pass} passed, ${results.fail} failed`);
console.log("=".repeat(50));
process.exit(results.fail > 0 ? 1 : 0);
