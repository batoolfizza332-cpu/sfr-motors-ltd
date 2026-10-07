#!/usr/bin/env node
// Runs every browser test in this folder one after another and exits non-zero if any fails.
//
//   npm run build && npm run test:browser        (needs Node 22+ and Chrome or Edge; set CHROME=<path> for another browser)
//
// The tests drive a real Chromium browser over the DevTools protocol against dist/ served by scripts/preview-edge.js.
// Nothing is sent to Google, WhatsApp or the live domain: Google answers are stubbed or blocked inside the browser, and the
// production hostname (https://sfrmotors.co.uk) is answered from the local server (see cdp.js). Screenshots go to the OS temp
// folder (override with SFR_SHOTS=<folder>). Not part of `npm run verify` because it needs a browser and takes several minutes.

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const TESTS = [
  ["test-sweep.js", "all sitemap pages, Desktop 1280x720 and Mobile 375x812; internal links; Google Map click-to-load"],
  ["test-consent.js", "cookie consent and Analytics, including the production-hostname guard"],
  ["test-functional.js", "404 page, redirects, calculator, quote form (production host and review copies), tel/WhatsApp links"],
  ["test-approved.js", "self-hosted font, click-to-load Map, robots.txt, footer disclosure, no street address"],
];

let failed = 0;
for (const [file, what] of TESTS) {
  console.log(`\n=== ${file}: ${what}`);
  const run = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: "inherit" });
  if (run.status !== 0) { failed++; console.log(`=== ${file} FAILED (exit ${run.status})`); }
}
console.log(failed ? `\n${failed} browser test file(s) FAILED` : "\nAll browser tests passed");
process.exit(failed ? 1 : 0);
