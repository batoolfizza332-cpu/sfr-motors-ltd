#!/usr/bin/env node
// Phase 4 (Technical SEO / Performance / Structured Data audit) — regression
// tests for the defects found and fixed in that pass:
//
//   1. Orphan pages: /blog/ and the recreated article pages had zero
//      sitewide inbound internal links. Fixed by adding a "Blog" nav +
//      footer link to all 5 page templates (scripts/lib/page-shell.js plus
//      the 4 hand-authored pages). This test rebuilds the sitewide link
//      graph from source and fails if any sitemap URL is still unreachable
//      from any other page's <a href>.
//   2. Render-blocking Google Fonts stylesheet: fixed with the standard
//      preload+swap async-CSS pattern. This test fails if any page still
//      has a directly render-blocking <link rel="stylesheet"
//      href="https://fonts.googleapis.com/..."> (the <noscript> fallback
//      copy is fine and expected).
//   3. Self-serving AggregateRating schema: removed from the homepage's
//      AutomotiveBusiness JSON-LD (the real 4.9/282 rating stays as
//      ordinary visible page content, just not re-declared as schema this
//      business can't back with genuine embedded Review objects). This
//      test fails if aggregateRating reappears anywhere in JSON-LD sitewide.
//   4. Tap targets below the 24px WCAG 2.2 practical minimum on footer
//      links and "Learn More" service-card links: fixed with padding in
//      main.css. This test asserts the padding rules are present (a static
//      source check — no browser dependency, consistent with this
//      project's other test scripts).
//   5. Color-contrast failure on /blog/'s "get in touch" link: it sat in a
//      raw <p> with no wrapping class supplying link color (unlike every
//      other body-text link on the site, which inherits orange from a
//      scoped rule like .sfr-legal__body a), so it rendered at the
//      browser's default link blue (#0000ee) against the dark background —
//      1.82:1 contrast, found by a full axe-core sweep of all 41 pages.
//      Fixed with the same inline-style pattern already used on its
//      wrapping <p>. This test asserts the link now carries an explicit
//      color style.
//
// Run: `node scripts/phase4-test.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const CSS_PATH = path.join(ROOT, "site", "assets", "css", "main.css");

const results = { pass: 0, fail: 0 };
function ok(label) {
  results.pass++;
}
function fail(label, detail) {
  results.fail++;
  console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
}

const pages = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "index.html") pages.push(full);
  }
}
walk(SITE_DIR);

function urlPathFor(file) {
  const rel = path.relative(SITE_DIR, path.dirname(file));
  return rel === "" ? "/" : `/${rel}/`;
}

function main() {
  console.log(`Phase 4 regression tests — ${pages.length} pages\n`);

  // ---- 1. orphan-page check: every page reachable from at least one <a href> sitewide ----
  console.log("== Orphan page check ==");
  const linked = new Set();
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const hrefs = [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
    for (const h of hrefs) linked.add(h.endsWith("/") || h.includes(".") ? h : h + "/");
  }
  for (const file of pages) {
    const p = urlPathFor(file);
    if (p === "/") continue; // the homepage is the root, not "orphaned"
    if (!linked.has(p)) fail(`orphan page: ${p}`, "not referenced by any <a href> sitewide");
    else ok(`${p}: linked from at least one page`);
  }

  // ---- 2. no render-blocking Google Fonts <link> (the async preload+swap pattern must be used) ----
  console.log("\n== Font loading: non-render-blocking ==");
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const p = urlPathFor(file);
    const blockingLink = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">(?!\s*<\/noscript>)/.test(
      html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
    );
    const hasPreloadSwap = /<link rel="preload" href="https:\/\/fonts\.googleapis\.com[^"]*" as="style" onload="this\.onload=null;this\.rel='stylesheet'">/.test(html);
    const hasNoscriptFallback = /<noscript><link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com/.test(html);
    if (blockingLink) fail(`${p}: still has a directly render-blocking Google Fonts <link rel="stylesheet">`);
    else if (!hasPreloadSwap) fail(`${p}: missing the async preload+swap Google Fonts pattern`);
    else if (!hasNoscriptFallback) fail(`${p}: missing <noscript> fallback for Google Fonts`);
    else ok(`${p}: Google Fonts loaded async (preload+swap, with noscript fallback)`);
  }

  // ---- 3. no self-serving AggregateRating schema anywhere ----
  console.log("\n== No self-serving AggregateRating schema ==");
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const p = urlPathFor(file);
    if (html.includes('"aggregateRating"') || html.includes('"AggregateRating"')) {
      fail(`${p}: aggregateRating/AggregateRating found in JSON-LD`);
    } else {
      ok(`${p}: no AggregateRating schema`);
    }
  }
  // the real, accurate rating must still be visible as ordinary page content (not removed, just not schema)
  const home = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf8");
  if (home.includes("4.9 out of 5") && home.includes("282 Google Reviews")) ok("homepage: real rating still visible as page content");
  else fail("homepage: visible rating badge (4.9 / 282 Google Reviews) missing");

  // ---- 4. tap-target CSS present ----
  console.log("\n== Tap-target sizing (footer links, service-card links) ==");
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const footerLinkRule = css.match(/\.sfr-footer__links a\{([^}]*)\}/);
  if (footerLinkRule && /padding:\s*5px 0/.test(footerLinkRule[1]) && /display:\s*inline-block/.test(footerLinkRule[1])) {
    ok(".sfr-footer__links a: touch-friendly padding present");
  } else {
    fail(".sfr-footer__links a: expected padding/display rule not found");
  }
  const serviceLinkRule = css.match(/\.sfr-services__link\{([^}]*)\}/);
  if (serviceLinkRule && /padding:\s*5px 0/.test(serviceLinkRule[1])) {
    ok(".sfr-services__link: touch-friendly padding present");
  } else {
    fail(".sfr-services__link: expected padding rule not found");
  }

  // ---- 5. blog "get in touch" link has explicit, sufficient-contrast color ----
  console.log("\n== Blog page: 'get in touch' link contrast fix ==");
  const blogHtml = fs.readFileSync(path.join(SITE_DIR, "blog", "index.html"), "utf8");
  if (/<a href="\/contact-us\/" style="color:var\(--sfr-orange\);">get in touch<\/a>/.test(blogHtml)) {
    ok("blog: 'get in touch' link has explicit orange color style");
  } else {
    fail("blog: 'get in touch' link is missing its explicit color style (would fall back to default link blue on the dark background)");
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULT: ${results.pass} passed, ${results.fail} failed`);
  console.log(`${"=".repeat(50)}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main();
