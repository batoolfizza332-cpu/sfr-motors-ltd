#!/usr/bin/env node
// Regenerates site/sitemap.xml (Phase 3, Task 7) from the actual final
// pages in site/ — walks the built directory tree rather than a hand-kept
// list, so the sitemap can't drift from what's really there. Reads each
// page's own <link rel="canonical"> as its <loc>, so the sitemap always
// matches the page's own canonical claim. Only indexable pages are
// included: a page whose <meta name="robots"> contains "noindex" is
// skipped automatically (none currently do, but this keeps it safe if one
// ever does).
//
// Run once (or after adding/removing pages): `node scripts/gen-sitemap.js`.

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");

// Real, defensible lastmod: each page's own last-commit date from git
// history, not a fabricated/hand-set constant that goes stale the moment
// this script isn't re-run on the day it claims. Falls back to today only
// for a file with no git history yet (e.g. staged but uncommitted).
function lastCommitDate(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: ROOT, encoding: "utf8" }).trim();
    if (out) return out;
  } catch (e) {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}

// priority/changefreq by first path segment — mirrors the original
// hand-written sitemap's weighting (home highest, services/locations
// high, core pages medium, legal/blog lower).
function weightFor(slug) {
  if (slug === "") return { priority: "1.0", changefreq: "monthly" }; // home
  if (["about-us", "contact-us"].includes(slug)) return { priority: "0.8", changefreq: "monthly" };
  if (slug === "services") return { priority: "0.9", changefreq: "monthly" };
  if (slug === "our-tyre-range") return { priority: "0.7", changefreq: "monthly" };
  if (slug === "blog") return { priority: "0.6", changefreq: "weekly" };
  if (slug.startsWith("blog/")) return { priority: "0.6", changefreq: "monthly" };
  if (["privacy-policy", "cookie-policy", "terms-and-conditions"].includes(slug)) return { priority: "0.3", changefreq: "yearly" };
  // everything else: the 9 service pages + 8 location pages
  return { priority: "0.9", changefreq: "monthly" };
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "assets") continue;
      walk(full, base, out);
    } else if (entry.name === "index.html") {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = walk(SITE_DIR).sort();
  const entries = [];
  const skipped = [];

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");

    const robotsMatch = html.match(/<meta name="robots" content="([^"]*)"/);
    if (robotsMatch && /noindex/i.test(robotsMatch[1])) {
      skipped.push(path.relative(SITE_DIR, file));
      continue;
    }

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)">/);
    if (!canonicalMatch) {
      console.warn(`  ! no canonical tag found in ${path.relative(SITE_DIR, file)} — skipped`);
      continue;
    }
    const loc = canonicalMatch[1];
    const slug = loc.replace(/^https:\/\/sfrmotors\.co\.uk\//, "").replace(/\/$/, "");
    const { priority, changefreq } = weightFor(slug);
    const lastmod = lastCommitDate(file);
    entries.push({ loc, priority, changefreq, lastmod });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  fs.writeFileSync(path.join(SITE_DIR, "sitemap.xml"), xml);
  console.log(`sitemap.xml: ${entries.length} URLs written${skipped.length ? `, ${skipped.length} noindex page(s) excluded (${skipped.join(", ")})` : ""}`);
}

main();
