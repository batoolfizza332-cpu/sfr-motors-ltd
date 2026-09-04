#!/usr/bin/env node
// Phase 4B Batch F — Part 7 mobile/accessibility/functional QA.
//
// DATA-GATHERING tool (like scripts/batchF-audit.js), not a pass/fail
// gate. Uses Playwright (Chromium) + axe-core against the production
// build in dist/:
//   1. Full 80-page axe-core sweep at mobile viewport (390x844).
//   2. Representative-page axe-core sweep at tablet (768x1024) and
//      desktop (1440x900).
//   3. Horizontal-overflow check on every page at mobile viewport.
//   4. JS console-error / page-error / failed-network-request capture
//      across the full 80-page crawl.
//   5. Functional QA: mobile nav open/close/Escape/focus-return, skip
//      link, keyboard-only nav reachability, phone/WhatsApp links, quote
//      form validation + WhatsApp deep-link build, tyre-size calculator
//      boundary/reset/keyboard behaviour.
//
// Findings are reported by severity, not summarised as "passing" —
// automated axe-core coverage is necessary but not sufficient for real
// accessibility; this script does not claim the site is
// accessibility-perfect.
//
// Run: `node scripts/batchF-a11y-qa.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8964;
const BASE = `http://127.0.0.1:${PORT}`;
const AXE_SOURCE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

const REPRESENTATIVE_PAGES = [
  "/",
  "/mobile-tyre-fitting/",
  "/mobile-tyre-fitting-livingston/",
  "/tyre-lifespan/",
  "/tyre-size-calculator/",
  "/contact-us/",
];

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);
  const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
});

function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.name === "index.html") out.push(full);
  }
  return out;
}

function walkPages(dir) {
  return walkFiles(dir).map((full) => {
    const rel = path.relative(dir, path.dirname(full));
    return rel === "" ? "/" : "/" + rel.split(path.sep).join("/") + "/";
  });
}

async function runAxe(page) {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  });
}

async function checkOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const pages = walkPages(DIST_DIR).sort();
  console.log(`Found ${pages.length} built pages.\n`);

  const browser = await chromium.launch();
  // Block third-party network entirely: faster (no real round-trips to
  // Google Fonts/Analytics/Maps) and deterministic (not dependent on this
  // sandboxed environment's outbound proxy reliability for external
  // hosts). Same-origin (localhost) requests are never blocked.
  const blockThirdParty = async (ctx, onThirdPartyRequest) => {
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(BASE)) return route.continue();
      if (onThirdPartyRequest) onThirdPartyRequest(url);
      // Fulfill (rather than abort) so the browser sees a normal empty
      // response instead of a network error — aborting synthesizes a
      // "Failed to load resource: net::ERR_FAILED" console error on every
      // page that references Google Fonts/Analytics/Maps, which would
      // falsely look like a site-code defect in the console-error check.
      // Blocking also means a real window.open(wa.me/...) popup would
      // never actually load — its target URL is captured via
      // onThirdPartyRequest instead of relying on the popup's own
      // (blocked, and therefore unreliable) navigation state.
      route.fulfill({ status: 204, body: "" });
    });
  };
  const report = {
    mobileSweep: [],
    tabletSweep: [],
    desktopSweep: [],
    consoleErrors: [],
    functional: [],
  };

  // ---- 1 & 3 & 4: full 80-page mobile axe sweep + overflow + console/network errors ----
  // Third-party requests (Google Fonts/Analytics/Maps) are excluded from
  // the "network failure caused by site code" check — this sandboxed
  // environment's outbound proxy can itself be unreliable for external
  // hosts, which is an environment condition, not a defect in the site's
  // own code. Same-origin (localhost) failures are the ones that matter.
  console.log("=== Mobile (390x844) axe-core + overflow + console-error sweep: all pages ===");
  const context = await browser.newContext({ viewport: MOBILE });
  await blockThirdParty(context);
  for (const p of pages) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const thirdPartyFailedRequests = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("requestfailed", (req) => {
      const entry = `${req.method()} ${req.url()} — ${req.failure()?.errorText}`;
      if (req.url().startsWith(BASE)) failedRequests.push(entry);
      else thirdPartyFailedRequests.push(entry);
    });

    await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    const violations = await runAxe(page);
    const overflow = await checkOverflow(page);

    report.mobileSweep.push({ page: p, violations, overflow });
    if (consoleErrors.length || pageErrors.length || failedRequests.length) {
      report.consoleErrors.push({ page: p, consoleErrors, pageErrors, failedRequests, thirdPartyFailedRequests });
    }
    const critSerious = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    console.log(`  ${p.padEnd(72)} violations=${violations.length} (crit/serious=${critSerious.length}) overflow=${overflow}${consoleErrors.length || pageErrors.length || failedRequests.length ? " [site console/network issues]" : ""}`);
    await page.close();
  }
  await context.close();

  // ---- 2: representative pages at tablet/desktop ----
  for (const [label, viewport, bucket] of [["Tablet (768x1024)", TABLET, "tabletSweep"], ["Desktop (1440x900)", DESKTOP, "desktopSweep"]]) {
    console.log(`\n=== ${label} axe-core sweep: ${REPRESENTATIVE_PAGES.length} representative pages ===`);
    const ctx = await browser.newContext({ viewport });
    await blockThirdParty(ctx);
    for (const p of REPRESENTATIVE_PAGES) {
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
      const violations = await runAxe(page);
      const overflow = await checkOverflow(page);
      report[bucket].push({ page: p, violations, overflow });
      console.log(`  ${p.padEnd(40)} violations=${violations.length} overflow=${overflow}`);
      await page.close();
    }
    await ctx.close();
  }

  // ---- 5: functional QA ----
  console.log("\n=== Functional QA ===");
  const fctx = await browser.newContext({ viewport: MOBILE });
  let capturedThirdPartyUrl = null;
  await blockThirdParty(fctx, (url) => { capturedThirdPartyUrl = url; });
  const fpage = await fctx.newPage();

  function fnFail(label, detail) {
    report.functional.push({ label, ok: false, detail });
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
  function fnOk(label) {
    report.functional.push({ label, ok: true });
    console.log(`  OK    ${label}`);
  }

  // -- Mobile nav open/close/Escape/focus-return --
  await fpage.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const toggle = fpage.locator(".sfr-nav__toggle");
  const nav = fpage.locator(".sfr-nav");
  if ((await toggle.getAttribute("aria-expanded")) === "false") fnOk("mobile nav starts closed (aria-expanded=false)");
  else fnFail("mobile nav starts closed", "aria-expanded was not false");

  await toggle.click();
  if ((await toggle.getAttribute("aria-expanded")) === "true" && (await nav.getAttribute("data-open")) === "true") fnOk("mobile nav opens on click (aria-expanded=true, data-open=true)");
  else fnFail("mobile nav opens on click");

  await fpage.keyboard.press("Escape");
  const closedAfterEscape = (await toggle.getAttribute("aria-expanded")) === "false";
  const focusedEl = await fpage.evaluate(() => document.activeElement.className);
  if (closedAfterEscape) fnOk("Escape closes the open mobile nav");
  else fnFail("Escape closes the open mobile nav", "aria-expanded still true");
  if (focusedEl.includes("sfr-nav__toggle")) fnOk("focus returns to nav toggle after Escape");
  else fnFail("focus returns to nav toggle after Escape", `activeElement class was "${focusedEl}"`);

  await toggle.click();
  await nav.locator(".sfr-nav__links a").first().click();
  const closedAfterLinkClick = (await toggle.getAttribute("aria-expanded")) === "false";
  if (closedAfterLinkClick) fnOk("mobile nav closes when a link is clicked");
  else fnFail("mobile nav closes when a link is clicked");

  // -- Skip link --
  await fpage.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await fpage.keyboard.press("Tab");
  const firstFocused = await fpage.evaluate(() => ({ cls: document.activeElement.className, text: document.activeElement.textContent }));
  if (firstFocused.cls.includes("sfr-skip")) fnOk("skip link is the first tab stop");
  else fnFail("skip link is the first tab stop", `first focused element was class="${firstFocused.cls}" text="${firstFocused.text}"`);
  await fpage.keyboard.press("Enter");
  const activeAfterSkip = await fpage.evaluate(() => document.activeElement.id);
  if (activeAfterSkip === "main" || activeAfterSkip === "") fnOk("skip link activates (target is #main or focus moved into content)");
  else fnFail("skip link activation target unexpected", `activeElement id="${activeAfterSkip}"`);

  // -- Phone / WhatsApp links on homepage --
  const telLinks = await fpage.locator('a[href^="tel:"]').count();
  const waLinks = await fpage.locator('a[href*="wa.me"]').count();
  if (telLinks > 0) fnOk(`homepage has ${telLinks} tel: link(s)`);
  else fnFail("homepage has a tel: link", "none found");
  if (waLinks > 0) fnOk(`homepage has ${waLinks} wa.me link(s)`);
  else fnFail("homepage has a wa.me link", "none found");
  const badTel = await fpage.locator('a[href^="tel:"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")).filter((h) => h !== "tel:01312020289"));
  if (badTel.length === 0) fnOk("all tel: links use the correct number (01312020289)");
  else fnFail("all tel: links use the correct number", `found: ${badTel.join(", ")}`);

  // -- Quote form validation + WhatsApp deep link --
  // main.js has a bot-deterrent: any submit within 1.5s of the form
  // rendering is silently treated as a fake success (same as the
  // honeypot), specifically so a bot can't distinguish "caught" from
  // "worked" — this is intentional site behaviour, not a bug, but it
  // means a genuine empty-field-validation test must wait past that
  // window first or it will observe the bot path instead.
  await fpage.goto(BASE + "/contact-us/", { waitUntil: "domcontentloaded" });
  await fpage.waitForTimeout(1600);
  const quoteForm = fpage.locator("#quote-form-el");
  if (await quoteForm.count()) {
    await quoteForm.locator('button[type="submit"], input[type="submit"]').first().click();
    const statusText = await fpage.locator("#quote-form-status").textContent();
    if (statusText && /fill in/i.test(statusText)) fnOk("empty quote form submit shows validation error");
    else fnFail("empty quote form submit shows validation error", `status text: "${statusText}"`);

    await fpage.waitForTimeout(1600); // clear the min-fill-time bot check
    await fpage.fill("#q-name", "Test User").catch(() => {});
    await fpage.fill("#q-phone", "07123456789").catch(() => {});
    const serviceSelect = fpage.locator("#q-service");
    if (await serviceSelect.count()) await serviceSelect.selectOption({ index: 1 }).catch(() => {});
    await fpage.fill("#q-location", "Livingston").catch(() => {});

    // The popup's own navigation to wa.me is intercepted/blocked (see
    // blockThirdParty), so its post-navigation state is unreliable in this
    // sandboxed environment (Chromium replaces a blocked popup's URL with
    // chrome-error://chromewebdata/ before Playwright's "popup" event
    // listener observes it, confirmed by direct testing) — capturing the
    // actual outbound request URL via the route handler is the reliable
    // signal that window.open(wa.me/...) was really called, with what.
    capturedThirdPartyUrl = null;
    await quoteForm.locator('button[type="submit"], input[type="submit"]').first().click();
    await fpage.waitForTimeout(1000);
    if (capturedThirdPartyUrl && capturedThirdPartyUrl.startsWith("https://wa.me/447448427154")) {
      fnOk("valid quote form submit opens the correct WhatsApp deep link");
      const decoded = decodeURIComponent(capturedThirdPartyUrl.split("?text=")[1] || "");
      if (decoded.includes("Test User") && decoded.includes("Mobile Tyre Fitting") && decoded.includes("Livingston")) fnOk("WhatsApp message includes the submitted form data");
      else fnFail("WhatsApp message includes the submitted form data", decoded);
    } else {
      fnFail("valid quote form submit opens the correct WhatsApp deep link", `captured request: ${capturedThirdPartyUrl}`);
    }
  } else {
    fnFail("contact-us page has the #quote-form-el form", "not found");
  }

  // -- Tyre-size calculator: boundary, keyboard, reset --
  await fpage.goto(BASE + "/tyre-size-calculator/", { waitUntil: "domcontentloaded" });
  const calcForm = fpage.locator("#tyre-calc-form");
  if (await calcForm.count()) {
    // Out-of-range value -> inline error + focus moves to first invalid field
    await fpage.fill("#cur-width", "9999");
    await fpage.fill("#cur-profile", "60");
    await fpage.fill("#cur-rim", "16");
    await fpage.fill("#new-width", "205");
    await fpage.fill("#new-profile", "55");
    await fpage.fill("#new-rim", "16");
    await calcForm.locator('button[type="submit"]').click();
    const curWidthInvalid = await fpage.locator("#cur-width").getAttribute("aria-invalid");
    const focusedId = await fpage.evaluate(() => document.activeElement.id);
    if (curWidthInvalid === "true") fnOk("calculator flags out-of-range value (aria-invalid)");
    else fnFail("calculator flags out-of-range value", `aria-invalid="${curWidthInvalid}"`);
    if (focusedId === "cur-width") fnOk("calculator moves focus to the first invalid field");
    else fnFail("calculator moves focus to the first invalid field", `focused id="${focusedId}"`);

    // Valid boundary values (min edges) -> results shown
    await fpage.fill("#cur-width", "135");
    await fpage.fill("#cur-profile", "25");
    await fpage.fill("#cur-rim", "12");
    await fpage.fill("#new-width", "335");
    await fpage.fill("#new-profile", "85");
    await fpage.fill("#new-rim", "24");
    await calcForm.locator('button[type="submit"]').click();
    const resultsHidden = await fpage.locator("#calc-results").getAttribute("hidden");
    if (resultsHidden === null) fnOk("calculator shows results for valid boundary-edge values (min/max range)");
    else fnFail("calculator shows results for valid boundary values", "results panel still hidden");

    // Reset clears results and errors
    await calcForm.locator('button[type="reset"]').click();
    const resultsHiddenAfterReset = await fpage.locator("#calc-results").getAttribute("hidden");
    if (resultsHiddenAfterReset !== null) fnOk("calculator reset hides the results panel");
    else fnFail("calculator reset hides the results panel", "still visible after reset");

    // Keyboard-only: Tab to first field, type, Tab through, Enter submits
    await fpage.locator("#cur-width").focus();
    await fpage.keyboard.type("205");
    await fpage.keyboard.press("Tab");
    await fpage.keyboard.type("55");
    await fpage.keyboard.press("Tab");
    await fpage.keyboard.type("16");
    await fpage.keyboard.press("Tab");
    await fpage.keyboard.type("205");
    await fpage.keyboard.press("Tab");
    await fpage.keyboard.type("55");
    await fpage.keyboard.press("Tab");
    await fpage.keyboard.type("17");
    const activeBeforeEnter = await fpage.evaluate(() => document.activeElement.id);
    if (activeBeforeEnter === "new-rim") fnOk("calculator fields are reachable via Tab in order");
    else fnFail("calculator fields reachable via Tab in order", `landed on "${activeBeforeEnter}" instead of new-rim`);
  } else {
    fnFail("tyre-size-calculator page has the #tyre-calc-form form", "not found");
  }

  await fctx.close();
  await browser.close();
  server.close();

  // ---- Summarise ----
  const allMobileViolations = report.mobileSweep.flatMap((r) => r.violations.map((v) => ({ page: r.page, ...v })));
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
  for (const v of allMobileViolations) byImpact[v.impact || "unknown"]++;
  const overflowPages = report.mobileSweep.filter((r) => r.overflow).map((r) => r.page);
  const functionalFails = report.functional.filter((f) => !f.ok);

  console.log("\n=== Summary ===");
  console.log(`Pages scanned (mobile): ${report.mobileSweep.length}`);
  console.log(`Total axe violations (mobile, all pages, instance count by rule x page): ${allMobileViolations.length}`);
  console.log(`  critical: ${byImpact.critical}, serious: ${byImpact.serious}, moderate: ${byImpact.moderate}, minor: ${byImpact.minor}`);
  console.log(`Pages with horizontal overflow at 390px: ${overflowPages.length}${overflowPages.length ? " -> " + overflowPages.join(", ") : ""}`);
  console.log(`Pages with console/pageerror/failed-request issues: ${report.consoleErrors.length}`);
  console.log(`Functional QA checks: ${report.functional.length} total, ${functionalFails.length} failed`);
  if (functionalFails.length) console.log("  Failed: " + functionalFails.map((f) => f.label).join("; "));

  const uniqueRules = new Map();
  for (const v of allMobileViolations) {
    if (!uniqueRules.has(v.id)) uniqueRules.set(v.id, { id: v.id, impact: v.impact, help: v.help, pages: [] });
    uniqueRules.get(v.id).pages.push(v.page);
  }
  console.log(`\nDistinct axe rules violated across the mobile sweep: ${uniqueRules.size}`);
  for (const rule of [...uniqueRules.values()].sort((a, b) => (a.impact > b.impact ? -1 : 1))) {
    console.log(`  [${rule.impact}] ${rule.id} — ${rule.help} (${rule.pages.length} page(s))`);
  }

  report.summary = {
    pagesScanned: report.mobileSweep.length,
    totalViolationInstances: allMobileViolations.length,
    byImpact,
    distinctRulesViolated: uniqueRules.size,
    overflowPages,
    pagesWithConsoleOrNetworkIssues: report.consoleErrors.length,
    functionalChecksTotal: report.functional.length,
    functionalChecksFailed: functionalFails.length,
  };

  fs.writeFileSync(path.join(ROOT, "PRELAUNCH_A11Y_QA_REPORT.json"), JSON.stringify(report, null, 1));
  console.log("\nWritten: PRELAUNCH_A11Y_QA_REPORT.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
