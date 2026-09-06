#!/usr/bin/env node
// Phase 3, Task 8 — local automated verification. Starts a tiny static
// server over dist/ that reproduces vercel.json's redirects + trailingSlash
// behaviour (the same rules that will run in production), then checks
// every sitemap URL, every redirect, every internal link, every asset
// reference, every JSON-LD block, heading structure, and duplicate
// titles/descriptions. Nothing here touches the network beyond
// 127.0.0.1 — this is entirely local.
//
// Run: `node scripts/phase3-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8934;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));
const TRAILING_SLASH = !!vercelConfig.trailingSlash;

// ---------------------------------------------------------------- server
function contentTypeFor(file) {
  const ext = path.extname(file);
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".xml": "application/xml",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".avif": "image/avif",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    }[ext] || "application/octet-stream"
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);

  if (REDIRECTS.has(p)) {
    res.writeHead(301, { Location: REDIRECTS.get(p) });
    return res.end();
  }
  if (TRAILING_SLASH && p !== "/" && !p.endsWith("/") && !path.extname(p)) {
    res.writeHead(301, { Location: p + "/" + url.search });
    return res.end();
  }

  let filePath;
  if (p.endsWith("/")) {
    filePath = path.join(DIST_DIR, p, "index.html");
  } else {
    filePath = path.join(DIST_DIR, p);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found: " + p);
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
});

// ---------------------------------------------------------------- http helper
function get(urlPath, { followRedirect = false } = {}) {
  return new Promise((resolve, reject) => {
    http
      .get(BASE + urlPath, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
}

// ---------------------------------------------------------------- checks
const results = { pass: 0, fail: 0, warn: 0 };
function ok(label) {
  results.pass++;
}
function fail(label, detail) {
  results.fail++;
  console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
}
function warn(label, detail) {
  results.warn++;
  console.log(`  WARN  ${label}${detail ? " — " + detail : ""}`);
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Local test server: ${BASE} (serving dist/)\n`);

  // ---- 1. sitemap URLs: every one resolves 200 on first request, exactly one H1, canonical self-matches ----
  const sitemapXml = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`== Sitemap: ${sitemapUrls.length} URLs ==`);

  const titles = new Map(); // title -> [urls]
  const descriptions = new Map();
  const allInternalLinks = new Set();
  const pageInfo = new Map();

  for (const loc of sitemapUrls) {
    const p = loc.replace("https://sfrmotors.co.uk", "");
    const res = await get(p);
    if (res.status !== 200) {
      fail(`sitemap URL ${p}`, `expected 200, got ${res.status}`);
      continue;
    }
    ok(`sitemap URL ${p} -> 200`);

    const h1s = [...res.body.matchAll(/<h1[ >]/g)];
    if (h1s.length === 0) fail(`${p}: no H1`);
    else if (h1s.length > 1) fail(`${p}: ${h1s.length} H1 tags (must be exactly one)`);
    else ok(`${p}: exactly one H1`);

    const canonicalMatch = res.body.match(/<link rel="canonical" href="([^"]+)">/);
    if (!canonicalMatch) fail(`${p}: missing canonical tag`);
    else if (canonicalMatch[1] !== loc) fail(`${p}: canonical is ${canonicalMatch[1]}, expected ${loc}`);
    else ok(`${p}: canonical self-matches`);

    const titleMatch = res.body.match(/<title>([^<]+)<\/title>/);
    const descMatch = res.body.match(/<meta name="description" content="([^"]*)"/);
    const title = titleMatch ? titleMatch[1] : null;
    const desc = descMatch ? descMatch[1] : null;
    if (!title) fail(`${p}: missing <title>`);
    if (!desc) fail(`${p}: missing meta description`);
    if (title) titles.set(title, [...(titles.get(title) || []), p]);
    if (desc) descriptions.set(desc, [...(descriptions.get(desc) || []), p]);

    // og:url must match canonical
    const ogUrlMatch = res.body.match(/property="og:url" content="([^"]+)"/);
    if (ogUrlMatch && ogUrlMatch[1] !== loc) fail(`${p}: og:url (${ogUrlMatch[1]}) != canonical (${loc})`);

    // JSON-LD blocks parse as valid JSON
    const ldBlocks = [...res.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const [, block] of ldBlocks) {
      try {
        JSON.parse(block);
      } catch (e) {
        fail(`${p}: invalid JSON-LD`, e.message);
      }
    }
    if (ldBlocks.length > 0) ok(`${p}: ${ldBlocks.length} JSON-LD block(s) parse`);

    // phone / whatsapp presence
    if (!res.body.includes('href="tel:01312020289"')) fail(`${p}: no tel: link`);
    if (!res.body.includes("wa.me/447448427154")) warn(`${p}: no WhatsApp link found`);

    // collect internal links for the broken-link pass
    const hrefs = [...res.body.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
    hrefs.forEach((h) => allInternalLinks.add(h));

    // collect asset src/srcset references for the missing-asset pass
    const assetRefs = [...res.body.matchAll(/(?:src|srcset)="(\/assets\/[^" ]+)"/g)].map((m) => m[1]);
    assetRefs.forEach((a) => allInternalLinks.add(a));

    pageInfo.set(p, { title, desc });
  }

  // ---- 2. duplicate titles / descriptions ----
  console.log(`\n== Duplicate titles/descriptions ==`);
  for (const [title, urls] of titles) {
    if (urls.length > 1) fail(`Duplicate title "${title}"`, urls.join(", "));
  }
  if ([...titles.values()].every((v) => v.length === 1)) ok("no duplicate titles");
  for (const [desc, urls] of descriptions) {
    if (urls.length > 1) fail(`Duplicate meta description (${urls.join(", ")})`, desc.slice(0, 60) + "...");
  }
  if ([...descriptions.values()].every((v) => v.length === 1)) ok("no duplicate meta descriptions");

  // ---- 3. broken internal links + missing assets ----
  console.log(`\n== Internal links & assets: ${allInternalLinks.size} unique references ==`);
  for (const link of allInternalLinks) {
    const clean = link.split("#")[0];
    if (!clean) continue; // pure same-page fragment like "#quote-form"
    const res = await get(clean);
    if (res.status === 301) {
      // a redirect target being linked internally isn't "broken" but is worth flagging —
      // internal links should point straight at the final URL, not through a redirect.
      warn(`Internal link ${clean} goes through a redirect (-> ${res.headers.location})`);
    } else if (res.status !== 200) {
      fail(`Internal link/asset ${clean}`, `status ${res.status}`);
    }
  }
  ok(`internal link/asset sweep complete`);

  // ---- 4. redirect map: single hop, correct destination, no loops ----
  console.log(`\n== Redirect map: ${REDIRECTS.size} entries ==`);
  for (const [source, destination] of REDIRECTS) {
    const r1 = await get(source);
    if (r1.status !== 301) {
      fail(`${source}: expected 301, got ${r1.status}`);
      continue;
    }
    if (r1.headers.location !== destination) {
      fail(`${source}: redirects to ${r1.headers.location}, expected ${destination}`);
      continue;
    }
    const r2 = await get(destination);
    if (r2.status !== 200) {
      fail(`${source} -> ${destination}: destination did not return 200 (got ${r2.status})`);
      continue;
    }
    ok(`${source} -> ${destination} (301, single hop, 200)`);
  }

  // ---- 4b. Phase 3B correction: explicit checks for the 2 restored URLs ----
  // (/emergency-tyre-replacement/ and /the-best-tyres-for-your-ford-on-edinburghs-roads/,
  // found missing from the migration entirely during Phase 3B re-verification —
  // named checks here so their coverage doesn't depend solely on the generic
  // sitemap sweep above.)
  console.log(`\n== Phase 3B correction: restored URLs ==`);
  const RESTORED_URLS = [
    { path: "/emergency-tyre-replacement/", h1: "Emergency Tyre Replacement vs Garage Tyre Fitting" },
    { path: "/the-best-tyres-for-your-ford-on-edinburghs-roads/", h1: "The Best Tyres For Your Ford On Edinburgh's Roads" },
  ];
  for (const { path: p, h1 } of RESTORED_URLS) {
    const loc = `https://sfrmotors.co.uk${p}`;

    if (REDIRECTS.has(p)) fail(`${p}: should not be a redirect source`, `found in redirect map -> ${REDIRECTS.get(p)}`);
    else ok(`${p}: not a redirect (recreated page)`);

    const res = await get(p);
    if (res.status !== 200) {
      fail(`${p}: expected 200, got ${res.status}`);
      continue;
    }
    ok(`${p}: 200`);

    const canonicalMatch = res.body.match(/<link rel="canonical" href="([^"]+)">/);
    if (!canonicalMatch || canonicalMatch[1] !== loc) fail(`${p}: canonical mismatch`, canonicalMatch ? canonicalMatch[1] : "missing");
    else ok(`${p}: self-referencing canonical`);

    const h1s = [...res.body.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)];
    if (h1s.length !== 1) fail(`${p}: expected exactly one H1, found ${h1s.length}`);
    else if (h1s[0][1] !== h1) fail(`${p}: H1 text mismatch`, `"${h1s[0][1]}" != "${h1}"`);
    else ok(`${p}: exactly one H1, correct text`);

    const titleMatch = res.body.match(/<title>([^<]+)<\/title>/);
    const descMatch = res.body.match(/<meta name="description" content="([^"]*)"/);
    if (!titleMatch) fail(`${p}: missing <title>`);
    else if ((titles.get(titleMatch[1]) || []).length !== 1) fail(`${p}: title not unique sitewide`, titleMatch[1]);
    else ok(`${p}: unique <title>`);
    if (!descMatch) fail(`${p}: missing meta description`);
    else if ((descriptions.get(descMatch[1]) || []).length !== 1) fail(`${p}: meta description not unique sitewide`, descMatch[1]);
    else ok(`${p}: unique meta description`);

    const ldBlocks = [...res.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    let breadcrumbFound = false;
    if (ldBlocks.length === 0) fail(`${p}: no JSON-LD blocks found`);
    for (const [, block] of ldBlocks) {
      try {
        const parsed = JSON.parse(block);
        if (parsed["@type"] === "BreadcrumbList") breadcrumbFound = true;
      } catch (e) {
        fail(`${p}: invalid JSON-LD`, e.message);
      }
    }
    if (breadcrumbFound) ok(`${p}: valid BreadcrumbList JSON-LD present`);
    else fail(`${p}: no valid BreadcrumbList JSON-LD found`);

    if (!sitemapUrls.includes(loc)) fail(`${p}: not present in sitemap.xml`);
    else ok(`${p}: present in sitemap.xml`);

    const pageLinks = [...res.body.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
    let brokenLinks = 0;
    for (const link of pageLinks) {
      const r = await get(link);
      if (r.status !== 200 && r.status !== 301) brokenLinks++;
    }
    if (brokenLinks > 0) fail(`${p}: ${brokenLinks} broken internal link(s)`);
    else ok(`${p}: all ${pageLinks.length} internal links resolve`);
  }

  // ---- 5. non-trailing-slash / trailing-slash consistency spot check ----
  console.log(`\n== Trailing-slash consistency ==`);
  const spot = await get("/about-us");
  if (spot.status === 301 && spot.headers.location === "/about-us/") ok("/about-us -> /about-us/ (301)");
  else fail("/about-us should 301 to /about-us/", `got ${spot.status} ${spot.headers.location || ""}`);

  // ---- 6. robots.txt / sitemap reachable ----
  console.log(`\n== robots.txt / sitemap.xml ==`);
  const robots = await get("/robots.txt");
  if (robots.status === 200 && robots.body.includes("Sitemap: https://sfrmotors.co.uk/sitemap.xml")) ok("robots.txt OK");
  else fail("robots.txt missing or malformed");

  // ---- 7. quote form present on homepage + contact ----
  console.log(`\n== Quote form ==`);
  const home = await get("/");
  if (home.body.includes('id="quote-form-el"')) ok("quote form present on homepage");
  else fail("quote form missing from homepage");
  const contact = await get("/contact-us/");
  if (contact.body.includes('id="quote-form-el"')) ok("quote form present on contact page");
  else fail("quote form missing from contact page");

  // ---- 8. mobile nav toggle markup present sitewide (sampled) ----
  if (home.body.includes("sfr-nav__toggle")) ok("mobile nav toggle markup present");
  else fail("mobile nav toggle markup missing");

  server.close();

  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULT: ${results.pass} passed, ${results.warn} warnings, ${results.fail} failed`);
  console.log(`${"=".repeat(50)}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
