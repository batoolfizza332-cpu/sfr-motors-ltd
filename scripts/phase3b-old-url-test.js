#!/usr/bin/env node
// Phase 3B Task 6: tests EVERY discovered live WordPress URL (not just the
// ones configured as redirects) against the local server that reproduces
// production redirect/trailing-slash rules — confirms each one reaches its
// intended final page in exactly one hop, with the right classification:
// "exact match" (recreated/renamed at the identical slug, no redirect
// needed), "redirect" (301 to a different final URL), or "unconfirmed"
// (discovered via search sampling but not yet mapped — should not exist
// after this script, or it's a real gap).
//
// Run: `node scripts/phase3b-old-url-test.js` (server from phase3-test.js
// pattern, reused here standalone so it can run independently).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8935;
const BASE = `http://127.0.0.1:${PORT}`;

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REDIRECTS = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8" }[ext] || "application/octet-stream";
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

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(BASE + urlPath, (res) => resolve({ status: res.statusCode, location: res.headers.location })).on("error", reject);
  });
}

// Every URL discovered across Phase 2 + Phase 3B search-index sampling.
// "expect" is what this script asserts; "note" is the human-readable reason.
const OLD_URLS = [
  // ---- Core ----
  { url: "/", expect: "exact" },
  { url: "/about-us/", expect: "exact" },
  { url: "/contact-us/", expect: "exact" },
  { url: "/our-tyre-range/", expect: "exact" },
  { url: "/home-tyre-fitting/", expect: "redirect", to: "/mobile-tyre-fitting/" },
  // ---- Services ----
  { url: "/mobile-tyre-puncture-repair/", expect: "exact" },
  { url: "/van-tyre-replacement-services/", expect: "exact" },
  { url: "/on-demand-mobile-tire-fitting/", expect: "redirect", to: "/mobile-tyre-fitting/" },
  { url: "/mobile-locking-wheel-nut-removal/", expect: "exact" },
  { url: "/premium-vehicle-tyre-service/", expect: "redirect", to: "/our-tyre-range/" },
  { url: "/tyre-pressure-monitoring-system/", expect: "exact" },
  { url: "/locking-wheel-nut-removal-bathgate/", expect: "redirect", to: "/mobile-locking-wheel-nut-removal/" },
  { url: "/tyre-replacement-call-out-bathgate/", expect: "redirect", to: "/mobile-tyre-fitting-bathgate/" },
  { url: "/24-7-mobile-tyre-replacement-in-edinburgh/", expect: "redirect", to: "/mobile-tyre-fitting-edinburgh/" },
  // ---- Locations ----
  { url: "/mobile-tyre-fitting-livingston/", expect: "exact" },
  { url: "/sfr-mobile-tyre-fitting-livingston/", expect: "redirect", to: "/mobile-tyre-fitting-livingston/" },
  { url: "/best-mobile-tyre-fitting-livingston/", expect: "redirect", to: "/mobile-tyre-fitting-livingston/" },
  { url: "/mobile-tyre-fitting-edinburgh/", expect: "exact" },
  { url: "/mobile-tyre-fitting-armadale/", expect: "exact" },
  { url: "/mobile-tyre-fitting-whitburn/", expect: "exact" },
  { url: "/mobile-tyre-fitting-airdrie/", expect: "exact" },
  { url: "/broxburn/", expect: "exact" },
  { url: "/mobile-tyre-fitting-west-lothian/", expect: "exact" },
  { url: "/mobile-tyre-fitting-falkirk/", expect: "exact" },
  { url: "/best-mobile-tyre-fitter-west-lothian/", expect: "redirect", to: "/mobile-tyre-fitting-west-lothian/" },
  { url: "/emergency-tyre-fitter-edinburgh-falkirk/", expect: "redirect", to: "/24-7-mobile-tyre-replacement/" },
  // ---- Guides / listicles / FAQ content — recreated at exact slug ----
  { url: "/mobile-tyre-fitting-guide/", expect: "exact" },
  { url: "/tyres-bathgate-guide/", expect: "exact" },
  { url: "/mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation/", expect: "exact" },
  { url: "/mobile-tyre-repair-edinburgh-west-lothian/", expect: "exact" },
  { url: "/tyre-puncture-repair-near-me-west-lothian/", expect: "exact" },
  { url: "/best-mobile-tyre-fitters-bathgate/", expect: "exact" },
  { url: "/tyre-fitting-edinburgh-expert-technical-aspects-you-must-know/", expect: "exact" },
  { url: "/behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use/", expect: "exact" },
  { url: "/better-tyres-better-drive/", expect: "exact" },
  { url: "/how-to-change-a-tyre/", expect: "exact" },
  { url: "/mobile-tyre-fitting-bathgate-questions/", expect: "redirect", to: "/mobile-tyre-fitting-bathgate/" },
  { url: "/locking-wheel-nut-removal/", expect: "exact" },
  { url: "/best-emergency-locking-wheel-nut-removal-in-west-lothian/", expect: "redirect", to: "/locking-wheel-nut-removal/" },
  { url: "/expert-locking-wheel-nut-removal/", expect: "redirect", to: "/locking-wheel-nut-removal/" },
  // ---- Phase 3B correction: found via external search after the first Phase 3B
  // pass shipped — confirmed live, indexed, and previously entirely unaccounted
  // for (no redirect, no recreated page). Recreated at their exact original slug. ----
  { url: "/emergency-tyre-replacement/", expect: "exact" },
  { url: "/the-best-tyres-for-your-ford-on-edinburghs-roads/", expect: "exact" },
  // ---- Blog ----
  { url: "/blog/", expect: "exact" },
  { url: "/blog/how-mobile-tyre-fitting-in-livingston-saves-time-and-improves-road-safety/", expect: "exact" },
  { url: "/category/best-mobile-tyre-fitting-service/", expect: "redirect", to: "/blog/" },
];

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`Testing ${OLD_URLS.length} discovered live URLs against the local server (${BASE})\n`);

  let pass = 0,
    fail = 0;
  for (const item of OLD_URLS) {
    if (item.expect === "exact") {
      const res = await get(item.url);
      if (res.status === 200) {
        console.log(`  OK    ${item.url}  (exact match, 200)`);
        pass++;
      } else {
        console.log(`  FAIL  ${item.url}  expected 200 (exact match), got ${res.status}`);
        fail++;
      }
    } else {
      const r1 = await get(item.url);
      if (r1.status !== 301 || r1.location !== item.to) {
        console.log(`  FAIL  ${item.url}  expected 301 -> ${item.to}, got ${r1.status} ${r1.location || ""}`);
        fail++;
        continue;
      }
      const r2 = await get(item.to);
      if (r2.status !== 200) {
        console.log(`  FAIL  ${item.url} -> ${item.to}  destination returned ${r2.status}, not 200`);
        fail++;
        continue;
      }
      console.log(`  OK    ${item.url} -> ${item.to}  (301, single hop, 200)`);
      pass++;
    }
  }

  server.close();
  console.log(`\n${pass}/${OLD_URLS.length} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
