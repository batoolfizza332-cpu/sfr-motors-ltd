#!/usr/bin/env node
// Phase 4B Batch F — Part 3 redirect & migration verification.
//
// DATA-GATHERING tool (like scripts/batchF-audit.js), not the pass/fail
// gate. Spins up a local server against dist/ that replicates the
// production clean-URL/redirect/404 behaviour (same rules as vercel.json
// and infra/cloudfront-function.js), then:
//   1. Checks every one of the 19 entries in infra/redirects.json:
//      301 status, correct Location, single hop (destination does not
//      itself redirect), destination returns 200, destination exists in
//      the build.
//   2. Confirms infra/redirects.json, vercel.json and
//      infra/cloudfront-function.js agree (same source/destination set).
//   3. Simulates representative requests (old WP URLs, clean URLs, no
//      trailing slash, retired .html variants, unknown URL, a real
//      hashed static asset, a query-string request) using raw http
//      requests that do NOT auto-follow redirects, so 301 status and
//      Location are actually observed rather than masked.
//   4. Confirms the custom 404 path returns a true 404 status.
//
// Run: `node scripts/batchF-redirect-verify.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8962;
const BASE = `http://127.0.0.1:${PORT}`;

const redirectsJson = JSON.parse(fs.readFileSync(path.join(ROOT, "infra", "redirects.json"), "utf8"));
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const cfFunctionSrc = fs.readFileSync(path.join(ROOT, "infra", "cloudfront-function.js"), "utf8");

const sourceRedirects = redirectsJson.redirects.map((r) => ({ source: r.source, destination: r.destination }));
const redirectMap = new Map(sourceRedirects.map((r) => [r.source, r.destination]));

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);
  if (redirectMap.has(p)) {
    res.writeHead(301, { Location: redirectMap.get(p) });
    return res.end();
  }
  // Mirrors the CloudFront Function's fixed logic (scripts/gen-redirects.js):
  // a no-slash request for a retired URL goes straight to the final
  // destination in one hop, not add-slash-then-redirect in two.
  if (p !== "/" && !p.endsWith("/") && !path.extname(p)) {
    const withSlash = p + "/";
    res.writeHead(301, { Location: redirectMap.get(withSlash) || withSlash });
    return res.end();
  }
  const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFoundPath = path.join(DIST_DIR, "index.html");
      fs.readFile(notFoundPath, (err2, data2) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(err2 ? "404" : data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
});

// Raw request — never auto-follows redirects, so a 301's own status and
// Location header are always what is observed and reported.
function request(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on("error", reject);
  });
}

const results = { redirects: [], driftChecks: [], simulations: [], summary: {} };
let failures = 0;

function fail(msg) {
  failures++;
  console.log(`  FAIL: ${msg}`);
}

async function verifyRedirects() {
  console.log(`\n=== Verifying ${sourceRedirects.length} redirects (infra/redirects.json) ===`);
  for (const { source, destination } of sourceRedirects) {
    const r1 = await request(source);
    const entry = { source, destination, hopStatus: r1.status, hopLocation: r1.headers.location || null };
    let ok = true;

    if (r1.status !== 301) { fail(`${source} -> expected 301, got ${r1.status}`); ok = false; }
    if (r1.headers.location !== destination) { fail(`${source} -> Location "${r1.headers.location}" !== expected destination "${destination}"`); ok = false; }

    // Single-hop check: the destination itself must NOT be another redirect source.
    if (redirectMap.has(destination)) { fail(`${source} -> destination "${destination}" is itself a redirect source (chain!)`); ok = false; }

    // Destination must resolve to a real built page returning 200.
    const r2 = await request(destination);
    entry.destinationStatus = r2.status;
    if (r2.status !== 200) { fail(`${source} -> destination "${destination}" returned ${r2.status}, not 200`); ok = false; }

    // Destination must exist in the built site (not served by the 404 fallback).
    const destFile = path.join(DIST_DIR, destination, "index.html");
    entry.destinationExistsInBuild = fs.existsSync(destFile);
    if (!entry.destinationExistsInBuild) { fail(`${source} -> destination "${destination}" has no built index.html`); ok = false; }

    entry.ok = ok;
    results.redirects.push(entry);
    console.log(`  ${ok ? "OK  " : "FAIL"} ${source} -> ${destination} (${r1.status}, dest ${r2.status})`);
  }
}

function verifyDrift() {
  console.log("\n=== Verifying redirect source-of-truth drift ===");

  // vercel.json redirects must match infra/redirects.json exactly (same set, same statusCode).
  const vercelMap = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));
  let vercelDrift = vercelMap.size !== redirectMap.size;
  for (const [source, destination] of redirectMap) {
    if (vercelMap.get(source) !== destination) vercelDrift = true;
  }
  const badStatus = vercelConfig.redirects.filter((r) => r.statusCode !== 301);
  if (badStatus.length) { fail(`vercel.json has ${badStatus.length} redirect(s) not using statusCode 301`); vercelDrift = true; }
  results.driftChecks.push({ check: "vercel.json matches infra/redirects.json", ok: !vercelDrift });
  console.log(`  ${!vercelDrift ? "OK  " : "FAIL"} vercel.json (${vercelConfig.redirects.length} entries) matches infra/redirects.json (${sourceRedirects.length} entries), all statusCode 301`);
  if (vercelDrift) fail("vercel.json redirect set does not match infra/redirects.json");

  // infra/cloudfront-function.js REDIRECTS object must match infra/redirects.json exactly.
  const cfMatch = cfFunctionSrc.match(/var REDIRECTS = (\{[\s\S]*?\n\});/);
  let cfDrift = !cfMatch;
  if (cfMatch) {
    // eslint-disable-next-line no-eval
    const cfRedirects = JSON.parse(cfMatch[1].replace(/\/\/.*$/gm, ""));
    const cfKeys = Object.keys(cfRedirects);
    if (cfKeys.length !== redirectMap.size) cfDrift = true;
    for (const [source, destination] of redirectMap) {
      if (cfRedirects[source] !== destination) cfDrift = true;
    }
  }
  results.driftChecks.push({ check: "infra/cloudfront-function.js REDIRECTS matches infra/redirects.json", ok: !cfDrift });
  console.log(`  ${!cfDrift ? "OK  " : "FAIL"} infra/cloudfront-function.js REDIRECTS matches infra/redirects.json`);
  if (cfDrift) fail("infra/cloudfront-function.js REDIRECTS does not match infra/redirects.json");

  // infra/template.yaml must embed the identical CloudFront function source.
  const templateYaml = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8");
  const templateHasAllSources = sourceRedirects.every((r) => templateYaml.includes(r.source));
  const templateHasAllDests = sourceRedirects.every((r) => templateYaml.includes(r.destination));
  const templateDrift = !templateHasAllSources || !templateHasAllDests;
  results.driftChecks.push({ check: "infra/template.yaml embeds the same redirect map", ok: !templateDrift });
  console.log(`  ${!templateDrift ? "OK  " : "FAIL"} infra/template.yaml embeds every redirect source & destination`);
  if (templateDrift) fail("infra/template.yaml embedded redirect map does not include every source/destination");
}

async function simulate() {
  console.log("\n=== Simulating representative requests (no auto-redirect-follow) ===");

  // Find a real content-hashed asset from the build to exercise static-asset serving.
  const cssDir = path.join(DIST_DIR, "assets", "css");
  const cssFile = fs.readdirSync(cssDir).find((f) => f.endsWith(".css"));
  const hashedAssetPath = `/assets/css/${cssFile}`;

  const cases = [
    { path: "/tyre-lifespan-mobile-tyre-repair-guide/", label: "old WordPress URL -> redirect", expect: 301 },
    { path: "/tyre-lifespan", label: "no trailing slash (live page) -> redirect to slash", expect: 301 },
    { path: "/tyre-lifespan-mobile-tyre-repair-guide", label: "no trailing slash (retired URL) -> single-hop redirect to final destination", expect: 301 },
    { path: "/mobile-tyre-fitting-bathgate/", label: "new clean URL", expect: 200 },
    { path: "/nonexistent-page-xyz/", label: "unknown URL -> true 404", expect: 404 },
    { path: hashedAssetPath, label: "static asset (real hashed path)", expect: 200 },
    { path: "/behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use/", label: "old WordPress URL -> redirect", expect: 301 },
    { path: "/tyre-lifespan-mobile-tyre-repair-guide/index.html", label: "retired .html variant -> not supported, true 404", expect: 404 },
    { path: "/emergency-tyre-fitter-edinburgh-falkirk/?utm_source=test", label: "old URL with query string -> redirect, query dropped safely", expect: 301 },
  ];

  for (const c of cases) {
    const r = await request(c.path);
    const ok = r.status === c.expect;
    const entry = { path: c.path, label: c.label, expectedStatus: c.expect, actualStatus: r.status, location: r.headers.location || null, ok };
    results.simulations.push(entry);
    console.log(`  ${ok ? "OK  " : "FAIL"} ${c.path.padEnd(72)} [${c.label}] -> ${r.status}${r.headers.location ? " -> " + r.headers.location : ""}`);
    if (!ok) fail(`${c.path} (${c.label}): expected ${c.expect}, got ${r.status}`);
  }

  // Query-string case: confirm the redirect strips/ignores the query safely
  // (Location does not echo it back into an open redirect, and the bare
  // source path is what's matched).
  const qsCase = results.simulations.find((s) => s.path.includes("utm_source"));
  if (qsCase && qsCase.location !== "/24-7-mobile-tyre-replacement/") {
    fail(`query-string redirect Location unexpected: ${qsCase.location}`);
  }

  // Single-hop check for the no-slash retired-URL case: Location must be
  // the FINAL destination, not the intermediate slash-added URL.
  const noSlashRetired = results.simulations.find((s) => s.path === "/tyre-lifespan-mobile-tyre-repair-guide");
  if (noSlashRetired && noSlashRetired.location !== "/tyre-lifespan/") {
    fail(`no-slash retired URL should redirect straight to /tyre-lifespan/ in one hop, got Location: ${noSlashRetired.location}`);
  }
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  try {
    await verifyRedirects();
    verifyDrift();
    await simulate();
  } finally {
    server.close();
  }

  results.summary = {
    totalRedirects: sourceRedirects.length,
    redirectsOk: results.redirects.filter((r) => r.ok).length,
    driftChecksOk: results.driftChecks.filter((d) => d.ok).length,
    driftChecksTotal: results.driftChecks.length,
    simulationsOk: results.simulations.filter((s) => s.ok).length,
    simulationsTotal: results.simulations.length,
    failures,
  };

  fs.writeFileSync(path.join(ROOT, "PRELAUNCH_REDIRECT_AUDIT.json"), JSON.stringify(results, null, 1));

  console.log(`\n=== Summary ===`);
  console.log(`Redirects OK: ${results.summary.redirectsOk}/${results.summary.totalRedirects}`);
  console.log(`Drift checks OK: ${results.summary.driftChecksOk}/${results.summary.driftChecksTotal}`);
  console.log(`Simulations OK: ${results.summary.simulationsOk}/${results.summary.simulationsTotal}`);
  console.log(`Total failures: ${failures}`);
  console.log(`Report written to PRELAUNCH_REDIRECT_AUDIT.json`);

  process.exit(failures > 0 ? 1 : 0);
}

main();
