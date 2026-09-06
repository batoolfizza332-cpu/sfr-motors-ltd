#!/usr/bin/env node
// Turns site/ into dist/: a minified, cache-fingerprinted production build
// ready to sync straight to S3. Nothing here changes site/ itself — dist/
// is fully disposable and gitignored.
//
//   - assets/css/main.css and assets/js/*.js are minified and renamed with
//     a content hash (main.<hash>.css, main.<hash>.js), so they can be
//     cached by the browser/CDN for a full year without ever going stale:
//     a content change produces a new filename, an unchanged file produces
//     the same hash and the same URL.
//   - Every .html file has its <link>/<script src> references to those
//     files rewritten to match, then is minified (whitespace/comments
//     only — no JS/CSS minification inside HTML, so the inline JSON-LD
//     <script> blocks are never touched).
//   - Everything else (images, fonts, robots.txt, sitemap.xml, favicon)
//     is copied through unchanged — it's already optimized and its
//     filenames are already stable.

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const CleanCSS = require("clean-css");
const { minify: minifyJs } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const DIST_DIR = path.join(ROOT, "dist");

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  collapseBooleanAttributes: true,
  removeComments: true,
  removeRedundantAttributes: false,
  removeEmptyAttributes: false,
  keepClosingSlash: true,
  caseSensitive: true,
  minifyCSS: false, // no inline <style> in this site — CSS is minified separately
  minifyJS: false, // leaves inline application/ld+json <script> blocks untouched
};

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

function hashOf(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex").slice(0, 8);
}

function fmtBytes(n) {
  return (n / 1024).toFixed(1) + " KB";
}

async function buildCss(relPath) {
  const srcPath = path.join(SITE_DIR, relPath);
  const source = fs.readFileSync(srcPath, "utf8");
  const result = new CleanCSS({ level: 2 }).minify(source);
  if (result.errors.length) {
    throw new Error(`CSS minify failed for ${relPath}: ${result.errors.join("; ")}`);
  }
  const minified = result.styles;
  const hash = hashOf(minified);
  const ext = path.extname(relPath);
  const base = relPath.slice(0, -ext.length);
  const outRel = `${base}.${hash}${ext}`;
  const outPath = path.join(DIST_DIR, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, minified);
  console.log(`  ${relPath} -> ${outRel}  (${fmtBytes(source.length)} -> ${fmtBytes(minified.length)})`);
  return { from: "/" + relPath.replace(/\\/g, "/"), to: "/" + outRel.replace(/\\/g, "/") };
}

async function buildJs(relPath) {
  const srcPath = path.join(SITE_DIR, relPath);
  const source = fs.readFileSync(srcPath, "utf8");
  const result = await minifyJs(source, {
    ecma: 5, // main.js/analytics.js are deliberately ES5 for older-browser support; don't upgrade syntax
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) {
    throw new Error(`JS minify produced no output for ${relPath}`);
  }
  const minified = result.code;
  const hash = hashOf(minified);
  const ext = path.extname(relPath);
  const base = relPath.slice(0, -ext.length);
  const outRel = `${base}.${hash}${ext}`;
  const outPath = path.join(DIST_DIR, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, minified);
  console.log(`  ${relPath} -> ${outRel}  (${fmtBytes(source.length)} -> ${fmtBytes(minified.length)})`);
  return { from: "/" + relPath.replace(/\\/g, "/"), to: "/" + outRel.replace(/\\/g, "/") };
}

async function buildHtmlFiles(assetMap) {
  // Recursive: every page now lives at site/<slug>/index.html (clean,
  // trailing-slash production URLs) rather than flat site/<slug>.html —
  // see scripts/migrate-phase3.js for the one-off restructure this build
  // step now assumes.
  const htmlFiles = walk(SITE_DIR).filter((f) => f.endsWith(".html"));
  let totalBefore = 0;
  let totalAfter = 0;
  for (const file of htmlFiles) {
    const srcPath = path.join(SITE_DIR, file);
    let html = fs.readFileSync(srcPath, "utf8");
    totalBefore += html.length;

    for (const { from, to } of assetMap) {
      // Matches href="/assets/css/main.css" / src="/assets/js/main.js"
      // exactly — the quoted attribute value, not any incidental
      // substring elsewhere.
      html = html.split(`"${from}"`).join(`"${to}"`);
    }

    const minified = await minifyHtml(html, HTML_MINIFY_OPTIONS);
    totalAfter += minified.length;
    const destPath = path.join(DIST_DIR, file);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, minified);
  }
  console.log(`  ${htmlFiles.length} pages  (${fmtBytes(totalBefore)} -> ${fmtBytes(totalAfter)})`);
}

function copyStaticFiles() {
  const all = walk(SITE_DIR);
  const skip = new Set(["assets/css/main.css", "assets/js/main.js", "assets/js/analytics.js", "assets/js/tyre-calculator.js"]);
  let count = 0;
  for (const rel of all) {
    const relNorm = rel.replace(/\\/g, "/");
    if (relNorm.endsWith(".html")) continue; // handled by buildHtmlFiles
    if (skip.has(relNorm)) continue; // handled by buildCss/buildJs
    const src = path.join(SITE_DIR, rel);
    const dest = path.join(DIST_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    count++;
  }
  console.log(`  ${count} static files copied unchanged (images, fonts, robots.txt, sitemap.xml, ...)`);
}

async function main() {
  console.log(`Building ${SITE_DIR} -> ${DIST_DIR}\n`);

  rmrf(DIST_DIR);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  console.log("Minifying CSS...");
  const cssMap = [await buildCss("assets/css/main.css")];

  console.log("Minifying JS...");
  const jsMap = [await buildJs("assets/js/main.js"), await buildJs("assets/js/analytics.js"), await buildJs("assets/js/tyre-calculator.js")];

  console.log("Copying static files...");
  copyStaticFiles();

  console.log("Minifying HTML and rewriting asset references...");
  await buildHtmlFiles([...cssMap, ...jsMap]);

  console.log(`\nBuild complete: ${DIST_DIR}`);
}

main()
  .then(() => {
    // Force a clean exit once the build is done. Without this, a lingering
    // handle left open by a dependency (terser/clean-css/html-minifier-terser
    // workers, timers, etc.) can keep the Node process alive after all our
    // own work is finished — invisible locally (the shell just returns), but
    // on Vercel the build step never reports done, and the deployment hangs
    // in "Building" forever with no error. See:
    // https://vercel.com/kb/guide/fixing-deployments-that-hang-after-the-build-step-succeeds
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
