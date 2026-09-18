#!/usr/bin/env node
// Local automated quality gate for site/. Runs the existing production build,
// then inspects site/ (the human-edited source, not the minified dist/
// output) for a fixed set of structural/SEO/link-integrity checks.
//
// Read-only: this script never writes to site/ or to git. It builds dist/
// (already gitignored) as part of check 1, and that's the only filesystem
// write it performs.

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const PROD_DOMAIN = "https://sfrmotors.co.uk";

const failures = []; // { check, error, file, fix }

function fail(check, error, file, fix) {
  failures.push({ check, error, file, fix });
}

function readFile(relPath) {
  return fs.readFileSync(path.join(SITE_DIR, relPath), "utf8");
}

function listHtmlFiles() {
  return fs
    .readdirSync(SITE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => e.name)
    .sort();
}

// Pages whose intentional public/canonical URL differs from their on-disk
// filename, because a CloudFront Function (infra/template.yaml,
// LegacyRedirectFunction) rewrites that URL to this file at the edge —
// preserving a legacy URL as the single primary one rather than serving
// duplicate content at two URLs. Keyed by filename; value is the public
// URL path (no leading slash).
const CANONICAL_URL_OVERRIDES = {
  "emergency-tyre-change.html": "24-7-mobile-tyre-replacement/",
};

// Reverse lookup, for resolving internal links/sitemap entries that
// intentionally use the rewritten public path instead of the filename.
const ROUTE_ALIAS_TO_FILE = Object.fromEntries(
  Object.entries(CANONICAL_URL_OVERRIDES).map(([file, urlPath]) => [urlPath, file])
);

function expectedCanonical(file) {
  if (file === "index.html") return `${PROD_DOMAIN}/`;
  return `${PROD_DOMAIN}/${CANONICAL_URL_OVERRIDES[file] || file}`;
}

function isIndexable(html) {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  if (!m) return true; // no robots meta => indexable by default
  return !/noindex/i.test(m[1]);
}

function matchAll(regex, str) {
  const out = [];
  let m;
  const re = new RegExp(regex, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(str)) !== null) {
    out.push(m);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length matches
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 1: production build completes successfully
// ---------------------------------------------------------------------------
function checkBuild() {
  try {
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch (err) {
    fail(
      "1. Build",
      `Production build failed: ${err.stderr ? err.stderr.toString().trim().split("\n").slice(-5).join(" | ") : err.message}`,
      "scripts/build.js",
      "Run `npm run build` directly and fix the reported error before re-running verify."
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared parse pass: load every HTML file once
// ---------------------------------------------------------------------------
function loadPages() {
  const files = listHtmlFiles();
  const pages = {};
  for (const file of files) {
    const html = readFile(file);
    pages[file] = {
      html,
      indexable: isIndexable(html),
      ids: new Set(matchAll(/\bid=["']([^"']+)["']/g, html).map((m) => m[1])),
    };
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Check 2 & 3: internal .html links resolve, and #anchor targets exist
// ---------------------------------------------------------------------------
function checkLinksAndAnchors(pages) {
  for (const [file, page] of Object.entries(pages)) {
    const hrefs = matchAll(/<a\s[^>]*href=["']([^"']+)["']/g, page.html).map((m) => m[1]);
    for (const href of hrefs) {
      if (href === "#") continue; // intentional no-op placeholder (social icons)
      if (/^(https?:|tel:|mailto:)/i.test(href)) continue; // external, out of scope

      const [targetFileRaw, fragment] = href.split("#");
      let targetFile = targetFileRaw === "" ? file : targetFileRaw.split("?")[0];

      if (targetFileRaw !== "") {
        targetFile = ROUTE_ALIAS_TO_FILE[targetFile] || targetFile;
        if (!pages[targetFile]) {
          fail(
            "2. Internal links",
            `Broken internal link: href="${href}" does not resolve to an existing page.`,
            `site/${file}`,
            `Fix or remove the link; ${targetFile} does not exist in site/.`
          );
          continue;
        }
      }

      if (fragment) {
        const targetPage = pages[targetFile];
        if (!targetPage.ids.has(fragment)) {
          fail(
            "3. Anchor targets",
            `Broken anchor: href="${href}" points to #${fragment}, which has no matching id="${fragment}" in ${targetFile}.`,
            `site/${file}`,
            `Add id="${fragment}" to the intended element in site/${targetFile}, or fix the link.`
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: exactly one H1 per indexable page
// ---------------------------------------------------------------------------
function checkSingleH1(pages) {
  for (const [file, page] of Object.entries(pages)) {
    if (!page.indexable) continue;
    const count = matchAll(/<h1[\s>]/gi, page.html).length;
    if (count !== 1) {
      fail(
        "4. Single H1",
        `Page has ${count} <h1> element(s); exactly 1 is required.`,
        `site/${file}`,
        count === 0 ? "Add one <h1> describing the page's main topic." : "Remove the extra <h1> elements, keeping only one."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check 5: non-empty, unique title and meta description per page
// ---------------------------------------------------------------------------
function checkTitleAndDescription(pages) {
  const titles = new Map(); // text -> [files]
  const descriptions = new Map();

  for (const [file, page] of Object.entries(pages)) {
    const titleMatch = page.html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    if (!title) {
      fail("5. Title", "Page has no <title> or it is empty.", `site/${file}`, "Add a unique, descriptive <title>.");
    } else {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(file);
    }

    const descMatch = page.html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";
    if (!description) {
      fail(
        "5. Meta description",
        "Page has no meta description or it is empty.",
        `site/${file}`,
        'Add <meta name="description" content="..."> with a unique, descriptive summary.'
      );
    } else {
      if (!descriptions.has(description)) descriptions.set(description, []);
      descriptions.get(description).push(file);
    }
  }

  for (const [title, files] of titles) {
    if (files.length > 1) {
      fail(
        "5. Title uniqueness",
        `Title "${title}" is reused across ${files.length} pages: ${files.join(", ")}.`,
        `site/${files[0]}`,
        "Give each page its own unique <title>."
      );
    }
  }
  for (const [desc, files] of descriptions) {
    if (files.length > 1) {
      fail(
        "5. Meta description uniqueness",
        `Meta description reused across ${files.length} pages: ${files.join(", ")}.`,
        `site/${files[0]}`,
        "Give each page its own unique meta description."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check 6 & 10: canonical present, correct, and unique across the site
// ---------------------------------------------------------------------------
function checkCanonicals(pages) {
  const seen = new Map(); // canonical url -> [files]

  for (const [file, page] of Object.entries(pages)) {
    const m = page.html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    const canonical = m ? m[1].trim() : "";
    const expected = expectedCanonical(file);

    if (!canonical) {
      fail("6. Canonical URL", "Page has no <link rel=\"canonical\"> tag.", `site/${file}`, `Add <link rel="canonical" href="${expected}">.`);
      continue;
    }
    if (!canonical.startsWith(`${PROD_DOMAIN}/`)) {
      fail(
        "6. Canonical URL",
        `Canonical "${canonical}" does not use the production domain ${PROD_DOMAIN}/.`,
        `site/${file}`,
        `Set the canonical to ${expected}.`
      );
      continue;
    }
    if (canonical !== expected) {
      fail(
        "6. Canonical URL",
        `Canonical "${canonical}" does not match this page's own expected URL "${expected}".`,
        `site/${file}`,
        `Set the canonical to ${expected}.`
      );
      continue;
    }

    if (!seen.has(canonical)) seen.set(canonical, []);
    seen.get(canonical).push(file);
  }

  for (const [canonical, files] of seen) {
    if (files.length > 1) {
      fail(
        "10. Duplicate canonicals",
        `Canonical "${canonical}" is used by ${files.length} pages: ${files.join(", ")}.`,
        `site/${files[0]}`,
        "Each page must have its own unique canonical URL."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check 7 & 8: local image references exist; alt text and dimensions present
// ---------------------------------------------------------------------------
function checkImages(pages) {
  for (const [file, page] of Object.entries(pages)) {
    const imgTags = matchAll(/<img\b[^>]*>/gi, page.html).map((m) => m[0]);
    const sourceTags = matchAll(/<source\b[^>]*>/gi, page.html).map((m) => m[0]);
    const iconLinks = matchAll(/<link\s+rel=["']icon["'][^>]*>/gi, page.html).map((m) => m[0]);

    const attr = (tag, name) => {
      const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
      return m ? m[1] : null;
    };

    const checkLocalRef = (relRef, sourceTag) => {
      if (!relRef || /^https?:/i.test(relRef)) return; // remote, out of scope
      // srcset can hold comma-separated "url descriptor" entries
      for (const entry of relRef.split(",")) {
        const url = entry.trim().split(/\s+/)[0];
        if (!url) continue;
        const localPath = path.join(SITE_DIR, url);
        if (!fs.existsSync(localPath)) {
          fail(
            "7. Image references",
            `Referenced image "${url}" does not exist in site/.`,
            `site/${file}`,
            `Add the missing file at site/${url}, or fix the ${sourceTag} attribute to point at an existing image.`
          );
        }
      }
    };

    for (const tag of [...imgTags, ...sourceTags, ...iconLinks]) {
      checkLocalRef(attr(tag, "src"), "src");
      checkLocalRef(attr(tag, "srcset"), "srcset");
    }

    for (const tag of imgTags) {
      const decorative = /aria-hidden=["']true["']/i.test(tag);
      const alt = attr(tag, "alt");
      if (alt === null) {
        fail("8. Image alt text", `<img> is missing an alt attribute: ${tag.slice(0, 90)}...`, `site/${file}`, 'Add alt="" for decorative images or a descriptive alt for meaningful ones.');
      } else if (!decorative && alt.trim() === "") {
        fail("8. Image alt text", `Meaningful <img> (not aria-hidden) has empty alt text: ${tag.slice(0, 90)}...`, `site/${file}`, "Add descriptive alt text for this image.");
      }

      const width = attr(tag, "width");
      const height = attr(tag, "height");
      if (!width || !height) {
        fail("8. Image dimensions", `<img> is missing explicit width/height: ${tag.slice(0, 90)}...`, `site/${file}`, "Add explicit width and height attributes to prevent layout shift.");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 9: sitemap URLs are valid and required indexable pages are included
// ---------------------------------------------------------------------------
function checkSitemap(pages) {
  const sitemapPath = path.join(SITE_DIR, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    fail("9. Sitemap", "site/sitemap.xml does not exist.", "site/sitemap.xml", "Create a sitemap listing all indexable pages.");
    return;
  }
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = matchAll(/<loc>([^<]*)<\/loc>/g, xml).map((m) => m[1].trim());

  const fileFor = (url) => {
    if (url === `${PROD_DOMAIN}/`) return "index.html";
    if (url.startsWith(`${PROD_DOMAIN}/`)) {
      const urlPath = url.slice(PROD_DOMAIN.length + 1);
      return ROUTE_ALIAS_TO_FILE[urlPath] || urlPath;
    }
    return null;
  };

  for (const loc of locs) {
    if (!/^https:\/\/sfrmotors\.co\.uk\//.test(loc)) {
      fail("9. Sitemap", `Sitemap entry "${loc}" is not a valid ${PROD_DOMAIN}/ URL.`, "site/sitemap.xml", "Use the full production URL for every <loc> entry.");
      continue;
    }
    const file = fileFor(loc);
    if (file && !pages[file]) {
      fail("9. Sitemap", `Sitemap entry "${loc}" does not correspond to any file in site/.`, "site/sitemap.xml", "Remove this entry or add the missing page.");
    }
  }

  const locSet = new Set(locs);
  for (const [file, page] of Object.entries(pages)) {
    if (!page.indexable) continue;
    const expected = expectedCanonical(file);
    if (!locSet.has(expected)) {
      fail("9. Sitemap", `Indexable page site/${file} is missing from sitemap.xml.`, "site/sitemap.xml", `Add <loc>${expected}</loc> to the sitemap.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 11: no leftover placeholder text, localhost or Vercel preview URLs
// ---------------------------------------------------------------------------
function checkNoPlaceholders(pages) {
  const patterns = [
    { re: /lorem ipsum/i, label: "Lorem ipsum placeholder text" },
    { re: /coming soon/i, label: '"Coming soon" placeholder text' },
    { re: /\btodo\b\s*:/i, label: "TODO marker" },
    { re: /\btbd\b/i, label: "TBD marker" },
    { re: /\[insert[^\]]*\]/i, label: "[insert ...] placeholder bracket" },
    { re: /your content here/i, label: '"your content here" placeholder text' },
    { re: /localhost(?::\d+)?/i, label: "localhost URL" },
    { re: /127\.0\.0\.1(?::\d+)?/i, label: "127.0.0.1 URL" },
    { re: /[a-z0-9-]+\.vercel\.app/i, label: "Vercel preview URL" },
  ];

  for (const [file, page] of Object.entries(pages)) {
    for (const { re, label } of patterns) {
      const m = page.html.match(re);
      if (m) {
        fail("11. Placeholder/preview content", `Found ${label}: "${m[0]}".`, `site/${file}`, "Remove or replace with final production content/URLs.");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 12: git diff --check
// ---------------------------------------------------------------------------
function checkGitDiff() {
  try {
    execSync("git diff --check", { cwd: ROOT, stdio: "pipe" });
  } catch (err) {
    fail(
      "12. git diff --check",
      `git diff --check reported issues:\n${err.stdout ? err.stdout.toString().trim() : err.message}`,
      "(working tree)",
      "Fix the trailing whitespace / conflict markers reported above."
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const TOTAL_CHECKS = 12;

function main() {
  const buildOk = checkBuild();

  const pages = loadPages();
  checkLinksAndAnchors(pages);
  checkSingleH1(pages);
  checkTitleAndDescription(pages);
  checkCanonicals(pages);
  checkImages(pages);
  checkSitemap(pages);
  checkNoPlaceholders(pages);
  checkGitDiff();

  if (failures.length === 0) {
    console.log("QUALITY GATE: PASSED");
    console.log(`Checks passed: ${TOTAL_CHECKS}`);
    process.exit(0);
  }

  console.log("QUALITY GATE: FAILED");
  for (const f of failures) {
    console.log(`Error: [${f.check}] ${f.error}`);
    console.log(`Affected file: ${f.file}`);
    console.log(`Suggested fix: ${f.fix}`);
    console.log("");
  }
  console.log(`${failures.length} issue(s) found across up to ${TOTAL_CHECKS} checks.`);
  process.exit(1);
}

main();
