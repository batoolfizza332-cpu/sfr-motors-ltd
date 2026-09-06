#!/usr/bin/env node
// One-off Phase 3 migration: restructures site/<slug>.html into
// site/<final-slug>/index.html (clean, trailing-slash URLs matching the
// live WordPress permalinks wherever Phase 2 called for an exact match),
// and rewrites every internal reference — asset paths, page links,
// canonical/OG URLs, breadcrumb and Service JSON-LD — to match.
//
// Run once: `node scripts/migrate-phase3.js`. Not part of the ongoing
// build (scripts/build.js still turns site/ -> dist/ afterwards, same as
// before) — this script only touches source files under site/, and only
// needs to be run again if the slug map below changes.

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const DOMAIN = "https://sfrmotors.co.uk";

// old flat filename -> final absolute path (trailing slash, no .html)
// "/" is the homepage and stays at site/index.html; everything else moves
// to site/<slug-without-leading-or-trailing-slash>/index.html
const SLUG_MAP = {
  "index.html": "/",
  "about.html": "/about-us/",
  "contact.html": "/contact-us/",
  "services.html": "/services/",
  "mobile-tyre-fitting.html": "/mobile-tyre-fitting/",
  "mobile-tyre-replacement.html": "/mobile-tyre-replacement/",
  "mobile-puncture-repair.html": "/mobile-tyre-puncture-repair/",
  "emergency-tyre-change.html": "/emergency-tyre-change/",
  "mobile-locking-wheel-nut-removal.html": "/mobile-locking-wheel-nut-removal/",
  "trade-fleet-tyre-services.html": "/trade-fleet-tyre-services/",
  "van-tyre-replacement.html": "/van-tyre-replacement-services/",
  "caravan-trailer-tyre-fitting.html": "/caravan-trailer-tyre-fitting/",
  // Phase 3B verified sfrmotors.co.uk's live URL is /tyre-pressure-monitoring-system/,
  // not /tpms-services/ — corrected here for accuracy; site/tpms-services.html
  // no longer exists (already migrated), so this entry is now a documented no-op.
  "tpms-services.html": "/tyre-pressure-monitoring-system/",
  "mobile-tyre-fitting-bathgate.html": "/mobile-tyre-fitting-bathgate/",
  "mobile-tyre-fitting-edinburgh.html": "/mobile-tyre-fitting-edinburgh/",
  "mobile-tyre-fitting-livingston.html": "/mobile-tyre-fitting-livingston/",
  "mobile-tyre-fitting-west-lothian.html": "/mobile-tyre-fitting-west-lothian/",
  "mobile-tyre-fitting-falkirk.html": "/mobile-tyre-fitting-falkirk/",
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteContent(html) {
  let out = html;

  // 1. asset paths -> root-absolute, works from any directory depth
  out = out.replace(/="assets\//g, '="/assets/');

  // 2. internal page links + JSON-LD absolute URLs, longest filename first
  //    so "mobile-tyre-fitting.html" doesn't partially swallow
  //    "mobile-tyre-fitting-bathgate.html" (both are exact quoted matches,
  //    but sorting defensively keeps this correct if that ever changes).
  const entries = Object.entries(SLUG_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [oldFile, newPath] of entries) {
    const relRe = new RegExp('"' + escapeRegex(oldFile) + '(#[^"]*)?"', "g");
    out = out.replace(relRe, (_m, frag) => `"${newPath}${frag || ""}"`);

    const absOld = `${DOMAIN}/${oldFile}`;
    const absRe = new RegExp('"' + escapeRegex(absOld) + '(#[^"]*)?"', "g");
    out = out.replace(absRe, (_m, frag) => `"${DOMAIN}${newPath}${frag || ""}"`);
  }

  // 3. fix the breadcrumb inconsistency flagged in the Phase 2 audit:
  //    .../index.html#sfr-areas-heading (now already rewritten to
  //    .../<homepage>#sfr-areas-heading above) — homepage maps to "/", so
  //    this collapses to the correct https://sfrmotors.co.uk/#sfr-areas-heading
  //    automatically via rule 2 above; nothing extra needed here.

  return out;
}

function main() {
  const moved = [];
  for (const [oldFile, newPath] of Object.entries(SLUG_MAP)) {
    const srcPath = path.join(SITE_DIR, oldFile);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  ! skip (not found): ${oldFile}`);
      continue;
    }
    const html = fs.readFileSync(srcPath, "utf8");
    const rewritten = rewriteContent(html);

    let destPath;
    if (newPath === "/") {
      destPath = path.join(SITE_DIR, "index.html");
    } else {
      const slug = newPath.replace(/^\/|\/$/g, "");
      destPath = path.join(SITE_DIR, slug, "index.html");
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
    }

    fs.writeFileSync(destPath, rewritten);
    if (path.resolve(srcPath) !== path.resolve(destPath)) {
      fs.rmSync(srcPath);
    }
    moved.push(`${oldFile} -> ${path.relative(SITE_DIR, destPath).replace(/\\/g, "/")}`);
  }
  console.log(`Migrated ${moved.length} pages:\n` + moved.map((m) => "  " + m).join("\n"));
}

main();
