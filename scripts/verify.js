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
  "about.html": "about-us/",
  "contact.html": "contact-us/",
  "broxburn.html": "broxburn/",
  "caravan-trailer-tyre-fitting.html": "mobile-trailer-and-caravan-tyre-fitting/",
  "mobile-puncture-repair.html": "mobile-tyre-puncture-repair/",
  "tpms-services.html": "tyre-pressure-monitoring-system/",
  "van-tyre-replacement.html": "van-tyre-replacement-services/",
  "how-much-does-mobile-tyre-fitting-cost.html": "how-much-does-mobile-tyre-fitting-cost/",
  "7-warning-signs-your-tyres-need-immediate-professional-attention.html": "7-warning-signs-your-tyres-need-immediate-professional-attention/",
  "blog.html": "blog/",
  "how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road.html": "how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road/",
  "how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns.html": "how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns/",
  "why-professional-mobile-tyre-services-are-essential-for-modern-drivers.html": "why-professional-mobile-tyre-services-are-essential-for-modern-drivers/",
  "tyre-size-calculator.html": "tyre-size-calculator/",
  "tyre-care-and-flat-tyre-help-in-linlithgow.html": "tyre-care-and-flat-tyre-help-in-linlithgow/",
  "preparing-your-car-tyres-for-winter-driving-in-livingston.html": "preparing-your-car-tyres-for-winter-driving-in-livingston/",
  "how-quality-tyres-improve-safety-and-driving-performance.html": "how-quality-tyres-improve-safety-and-driving-performance/",
  "why-tyre-safety-is-more-important-than-most-drivers-realize.html": "why-tyre-safety-is-more-important-than-most-drivers-realize/",
  "professional-mobile-tyre-services-on-drivers-linlithgow.html": "professional-mobile-tyre-services-on-drivers-linlithgow/",
  "your-guide-to-safe-tyre-services-in-harthill.html": "your-guide-to-safe-tyre-services-in-harthill/",
  "the-best-tyres-for-edinburgh-west-lothian-roads.html": "the-best-tyres-for-edinburgh-west-lothian-roads/",
  "the-best-tyres-for-your-ford-on-edinburghs-roads.html": "the-best-tyres-for-your-ford-on-edinburghs-roads/",
  "puncture-repairs-whats-actually-being-done-to-your-tyre.html": "puncture-repairs-whats-actually-being-done-to-your-tyre/",
  "what-mobile-fitters-check-before-changing-a-tyre-on-a-hill.html": "what-mobile-fitters-check-before-changing-a-tyre-on-a-hill/",
  "locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk.html": "locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/",
  "emergency-tyre-replacement.html": "emergency-tyre-replacement/",
  "locking-wheel-nut-removal.html": "locking-wheel-nut-removal/",
  "better-tyres-better-drive.html": "better-tyres-better-drive/",
  "how-to-change-a-tyre.html": "how-to-change-a-tyre/",
  "mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation.html": "mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation/",
  "mobile-tyre-repair-edinburgh-west-lothian.html": "mobile-tyre-repair-edinburgh-west-lothian/",
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
  const inbound = new Map(Object.keys(pages).map((f) => [f, new Set()])); // file -> pages that link to it
  for (const [file, page] of Object.entries(pages)) {
    const hrefs = matchAll(/<a\s[^>]*href=["']([^"']+)["']/g, page.html).map((m) => m[1]);
    for (const href of hrefs) {
      if (href === "#") {
        // placeholder links (the removed Facebook/Instagram icons) go nowhere; add real URLs or nothing
        fail("2. Internal links", 'Placeholder link href="#" (goes nowhere).', `site/${file}`, "Remove it, or give it a real destination.");
        continue;
      }
      if (/^(https?:|tel:|mailto:)/i.test(href)) continue; // external, out of scope

      const [targetFileRaw, fragment] = href.split("#");
      // A leading "/" makes the link root-relative rather than relative to
      // the current page — required on pages served at a pretty path (e.g.
      // /broxburn/), where a plain relative href would otherwise resolve
      // underneath that path instead of at the site root. Every physical
      // file already lives at the root of site/, so stripping it resolves
      // to the same filename a same-directory relative link would use.
      let targetFile = targetFileRaw === "" ? file : targetFileRaw.replace(/^\//, "").split("?")[0];

      // "/" is the Home page (index.html). /index.html itself 301s to "/", so nothing may link to it.
      if (/^\/?index\.html$/.test(targetFileRaw)) {
        fail("2. Internal links", `Link to the redirecting /index.html: href="${href}".`, `site/${file}`, 'Point it at "/" (the canonical Home URL).');
        continue;
      }
      if (targetFileRaw !== "" && targetFile === "") targetFile = "index.html";

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

      if (targetFile !== file) inbound.get(targetFile) && inbound.get(targetFile).add(file);

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

  // every indexable page must be reachable from at least one other page (sitemap alone is not internal linking)
  for (const [file, page] of Object.entries(pages)) {
    if (file === "index.html" || !page.indexable) continue;
    if (inbound.get(file).size === 0) {
      fail("2. Internal links", `Orphan page: nothing links to ${expectedCanonical(file)}.`, `site/${file}`, "Link to it from a relevant listing (for example the Areas We Cover list).");
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

    // Non-indexable pages (the CloudFront 404 page) have no public URL of their own, so no canonical.
    if (!page.indexable) {
      if (canonical) fail("6. Canonical URL", "A noindex page must not declare a canonical URL.", `site/${file}`, "Remove the <link rel=\"canonical\"> tag.");
      continue;
    }

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

// Every file in assets/img must be used somewhere: unreferenced images still ship to S3 (and can carry
// content that was deliberately replaced, e.g. a source photo with a corner watermark).
function checkUnreferencedImages(pages) {
  const imgDir = path.join(SITE_DIR, "assets", "img");
  const readDir = (d) => fs.readdirSync(path.join(SITE_DIR, d)).map((f) => fs.readFileSync(path.join(SITE_DIR, d, f), "utf8")).join("\n");
  const haystack = Object.values(pages).map((p) => p.html).join("\n") + readDir("assets/css") + readDir("assets/js");
  for (const f of fs.readdirSync(imgDir)) {
    if (!haystack.includes(f)) {
      fail("7. Unreferenced images", `site/assets/img/${f} is not referenced by any page, stylesheet or script.`, `site/assets/img/${f}`, "Delete it (it is history-recoverable in git) or reference it.");
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
// Check 13: pretty-path pages never use document-relative local assets
// ---------------------------------------------------------------------------
// A page served at a pretty path (e.g. /blog/) resolves a plain
// href="assets/..." to /blog/assets/..., which doesn't exist. The routing
// source of truth is the `rewrites` map in the CloudFront Function in
// infra/template.yaml, unioned with CANONICAL_URL_OVERRIDES.
// The CloudFront Function's routing tables, parsed out of infra/template.yaml:
//   special: public slug -> file basename where they differ; same: slugs whose file has the same name;
//   legacy: old WordPress paths (no trailing slash) -> 301 destination.
function loadRoutingTables() {
  const template = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8").replace(/\r/g, "");
  const code = (template.match(/FunctionCode: \|\n([\s\S]*?)\n\n  Distribution:/) || [])[1];
  if (!code) return null;
  const obj = (name) => {
    const block = code.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\n\\s*\\};`));
    return block ? Object.fromEntries(matchAll(/'([^']*)':\s*'([^']*)'/g, block[1]).map((m) => [m[1], m[2]])) : null;
  };
  const sameBlock = code.match(/var same = \(([\s\S]*?)\)\.split\(' '\);/);
  const same = sameBlock ? matchAll(/'([^']*)'/g, sameBlock[1]).map((m) => m[1]).join("").split(" ").filter(Boolean) : null;
  const special = obj("special");
  const legacy = obj("legacy");
  if (!special || !same || !legacy) return null;
  const pageFiles = { ...Object.fromEntries(Object.entries(special).map(([slug, file]) => [`${file}.html`, `${slug}/`])), ...Object.fromEntries(same.map((s) => [`${s}.html`, `${s}/`])) };
  return { code, template, special, same, legacy, pageFiles };
}

function prettyPathFiles() {
  const routing = loadRoutingTables();
  if (!routing) {
    fail(
      "13. Pretty-path assets",
      "Could not read the routing tables (special / same / legacy) from the LegacyRedirectFunction in infra/template.yaml.",
      "infra/template.yaml",
      "Restore the tables, or update loadRoutingTables() in scripts/verify.js to match the new routing."
    );
    return Object.keys(CANONICAL_URL_OVERRIDES).sort();
  }
  // 404.html is served by CloudFront for a missing URL at ANY depth, so it needs root-relative assets too.
  return [...new Set([...Object.keys(routing.pageFiles), ...Object.keys(CANONICAL_URL_OVERRIDES), "404.html"])].sort();
}

function checkPrettyPathAssets(pages) {
  for (const file of prettyPathFiles()) {
    const page = pages[file];
    if (!page) {
      fail("13. Pretty-path assets", `Pretty-path routing points at site/${file}, which does not exist.`, `site/${file}`, "Fix the routing or restore the page.");
      continue;
    }
    for (const [, tag] of matchAll(/(<[a-zA-Z][^>]*>)/g, page.html)) {
      for (const [, attrName, , value] of matchAll(/\b(href|src|srcset|imagesrcset|poster)\s*=\s*(["'])([^"']*)\2/gi, tag)) {
        const isSrcset = /srcset$/i.test(attrName);
        for (const entry of isSrcset ? value.split(",") : [value]) {
          const url = entry.trim().split(/\s+/)[0];
          // Only local asset paths that don't start with "/" (or a scheme) are flagged.
          if (!/^(\.{1,2}\/)*assets\//.test(url)) continue;
          fail(
            "13. Pretty-path assets",
            `${attrName.toLowerCase()}="${url}" is document-relative; on a pretty-path page it resolves under the page's own path and 404s.`,
            `site/${file}`,
            `Change it to "/${url.replace(/^(\.{1,2}\/)*/, "")}".`
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 14: root /favicon.ico exists, is a valid ICO, ships in the build and
// in the deploy script
// ---------------------------------------------------------------------------
function checkRootFavicon() {
  const check = "14. Root favicon";
  const srcPath = path.join(SITE_DIR, "favicon.ico");
  if (!fs.existsSync(srcPath)) {
    fail(check, "site/favicon.ico is missing, so /favicon.ico would 404.", "site/favicon.ico", "Restore site/favicon.ico (an ICO made from the approved logo, assets/img/logo.webp).");
    return;
  }
  const buf = fs.readFileSync(srcPath);
  // ICONDIR: reserved=0, type=1 (icon), count>=1; each 16-byte ICONDIRENTRY
  // must point at non-empty image data (PNG or BMP DIB) inside the file.
  let valid = buf.length >= 22 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1 && buf.readUInt16LE(4) >= 1;
  for (let i = 0; valid && i < buf.readUInt16LE(4); i++) {
    const size = buf.readUInt32LE(6 + 16 * i + 8);
    const offset = buf.readUInt32LE(6 + 16 * i + 12);
    const isPng = buf.subarray(offset, offset + 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isDib = buf.readUInt32LE(offset) === 40;
    valid = size > 0 && offset + size <= buf.length && (isPng || isDib);
  }
  if (!valid) {
    fail(check, "site/favicon.ico is not a valid ICO file (bad header or image entry).", "site/favicon.ico", "Regenerate it as a real ICO from assets/img/logo.webp.");
  }

  const distPath = path.join(ROOT, "dist", "favicon.ico");
  if (!fs.existsSync(distPath) || !fs.readFileSync(distPath).equals(buf)) {
    fail(check, "dist/favicon.ico is missing or differs from site/favicon.ico after the build.", "scripts/build.js", "Make sure the build copies site/favicon.ico to dist/favicon.ico unchanged.");
  }

  const deploy = fs.readFileSync(path.join(ROOT, "infra", "deploy-site.sh"), "utf8");
  if (!deploy.includes('"$DIST_DIR/favicon.ico"')) {
    fail(check, "infra/deploy-site.sh does not upload favicon.ico (only assets/, *.html, robots.txt and sitemap.xml are synced).", "infra/deploy-site.sh", "Add an `aws s3 cp \"$DIST_DIR/favicon.ico\" ...` step.");
  }
}

// ---------------------------------------------------------------------------
// Check 15: cookie consent + consent-gated Google Analytics
// ---------------------------------------------------------------------------
// The single central implementation is site/assets/js/analytics.js. These
// checks are structural (function bodies, call sites, parsed CSP directives)
// rather than exact-string matches, so harmless reformatting does not trip them.
const APPROVED_GA_ID = "G-B9TY4GMXYT";

// Body of `function name(...) { ... }` by brace matching, or null.
function functionBody(source, name) {
  const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

function parseCsp() {
  const template = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8").replace(/\r/g, "");
  const m = template.match(/ContentSecurityPolicy: >-\n([\s\S]*?)\n\s*Override: true/);
  if (!m) return null;
  const directives = {};
  for (const part of m[1].split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives[tokens[0]] = tokens.slice(1);
  }
  return directives;
}

function checkConsentAndAnalytics(pages) {
  const check = "15. Cookie consent & Analytics";
  const jsFile = "site/assets/js/analytics.js";
  // Comments are stripped first so prose that mentions a function name cannot satisfy or trip a check.
  const js = fs
    .readFileSync(path.join(ROOT, jsFile), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\w])\/\/.*$/gm, "$1");

  // -- Measurement ID: approved, configured once, in the central file only ------
  const ids = matchAll(/\bGA_MEASUREMENT_ID\s*=\s*["']([^"']*)["']/g, js).map((m) => m[1]);
  if (ids.length !== 1 || ids[0] !== APPROVED_GA_ID) {
    fail(check, `analytics.js must define GA_MEASUREMENT_ID exactly once as the approved ${APPROVED_GA_ID} (found: ${ids.join(", ") || "none"}).`, jsFile, `Set GA_MEASUREMENT_ID = "${APPROVED_GA_ID}".`);
  }
  // The old "not configured" placeholder path must be gone, not merely silenced.
  if (/Analytics not configured|G-X{6,}/.test(js)) {
    fail(check, 'analytics.js still contains the old placeholder ID / "Analytics not configured" branch.', jsFile, "Remove the placeholder branch; the real ID is configured.");
  }
  for (const rel of fs.readdirSync(path.join(SITE_DIR, "assets", "js"))) {
    if (rel === "analytics.js") continue;
    if (/G-[A-Z0-9]{10}\b|googletagmanager\.com|google-analytics\.com/.test(fs.readFileSync(path.join(SITE_DIR, "assets", "js", rel), "utf8"))) {
      fail(check, `site/assets/js/${rel} contains a GA ID or Google Analytics URL; analytics must live only in analytics.js.`, `site/assets/js/${rel}`, "Move it into analytics.js.");
    }
  }

  // -- Nothing loads Analytics unconditionally ---------------------------------
  for (const [file, page] of Object.entries(pages)) {
    if (/googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bdataLayer\b|\bG-[A-Z0-9]{10}\b/.test(page.html)) {
      fail(check, "Page HTML references Google Analytics/gtag directly; it must only load through the consent-gated analytics.js.", `site/${file}`, "Remove the inline tag/script; analytics.js loads gtag.js after consent.");
    }
    const tags = matchAll(/<script\b[^>]*\bsrc=["'][^"']*assets\/js\/analytics\.js["'][^>]*>/g, page.html);
    if (tags.length !== 1 || !/\bdefer\b/.test(tags[0][0])) {
      fail(check, `Page must include assets/js/analytics.js exactly once with defer (found ${tags.length}).`, `site/${file}`, 'Add <script src="assets/js/analytics.js" defer></script> once, matching the page\'s other script paths.');
    }
    const openers = matchAll(/<button\b[^>]*\bdata-sfr-cookie-settings\b[^>]*>([^<]*)<\/button>/g, page.html);
    const inFooter = /<footer\b[\s\S]*data-sfr-cookie-settings[\s\S]*<\/footer>/.test(page.html);
    if (openers.length !== 1 || !/Cookie settings/i.test(openers[0][1]) || !inFooter) {
      fail(check, `Page needs exactly one footer "Cookie settings" button (data-sfr-cookie-settings); found ${openers.length}.`, `site/${file}`, 'Add <button type="button" class="sfr-footer__cookie" data-sfr-cookie-settings hidden>Cookie settings</button> to the footer bottom bar.');
    }
  }

  // -- gtag.js is requested only from acceptAnalytics(), and only after "granted" --
  const gtagRefs = matchAll(/googletagmanager\.com\/gtag\/js/g, js).length;
  const accept = functionBody(js, "acceptAnalytics");
  if (gtagRefs !== 1 || !accept || !/createElement\(\s*["']script["']\s*\)/.test(accept) || !/GTAG_URL/.test(accept)) {
    fail(check, "gtag.js must be referenced once and injected only inside acceptAnalytics().", jsFile, "Keep a single GTAG_URL and create the <script> only in acceptAnalytics().");
  }
  if (accept && !/document\.querySelector\([^)]*gtag\/js/.test(accept) && !/analyticsLoaded/.test(accept)) {
    fail(check, "acceptAnalytics() has no guard against inserting gtag.js twice.", jsFile, "Guard with an analyticsLoaded flag / existing-script check.");
  }
  if (accept && matchAll(/gtag\(\s*["']config["']/g, accept).length !== 1) {
    fail(check, 'acceptAnalytics() must call gtag("config", ...) exactly once (duplicate page_view otherwise).', jsFile, 'Keep one gtag("config") call.');
  }
  const callSites = matchAll(/\bacceptAnalytics\(\)/g, js).filter((m) => !/function\s+$/.test(js.slice(Math.max(0, m.index - 10), m.index)));
  for (const m of callSites) {
    if (!/["']granted["']/.test(js.slice(Math.max(0, m.index - 200), m.index))) {
      fail(check, "acceptAnalytics() is called somewhere without an immediately preceding \"granted\" consent check.", jsFile, "Only call acceptAnalytics() when the stored/selected choice is granted.");
    }
  }
  if (callSites.length < 2) {
    fail(check, "Expected acceptAnalytics() to be called from both the accept action and the remembered-consent start-up path.", jsFile, "Restore the call sites.");
  }
  if (/localStorage|sessionStorage/.test(js)) {
    fail(check, "analytics.js uses web storage; the consent preference is meant to be a single first-party cookie.", jsFile, "Store only the sfr_consent cookie.");
  }

  // -- Consent controls: equal Accept / Reject, withdrawal, cookie attributes ---
  for (const [value, label] of [["granted", "Accept analytics"], ["denied", "Reject analytics"]]) {
    if (!new RegExp(`data-sfr-consent=\\\\?["']${value}\\\\?["'][^<]*>${label}<`).test(js)) {
      fail(check, `Consent panel is missing the "${label}" button (data-sfr-consent="${value}").`, jsFile, `Add a "${label}" button with the same prominence as its counterpart.`);
    }
  }
  if (!/data-sfr-cookie-settings/.test(js) || !/clearAnalyticsCookies\(\)/.test(js) || !/ga-disable-/.test(js)) {
    fail(check, "Withdrawal handling (Cookie settings opener, cookie clearing, ga-disable flag) is incomplete.", jsFile, "Restore reopen + clearAnalyticsCookies() + the ga-disable-<ID> flag.");
  }
  const maxAge = Number((js.match(/CONSENT_MAX_AGE\s*=\s*(\d+)/) || [])[1]);
  const cookieName = (js.match(/CONSENT_COOKIE\s*=\s*["']([^"']+)["']/) || [])[1];
  if (!maxAge || !cookieName || !/SameSite=Lax/.test(js) || !/Path=\//.test(js) || !/protocol\s*===\s*["']https:["'][\s\S]{0,30}Secure/.test(js)) {
    fail(check, "Consent cookie must have a name, a Max-Age, Path=/, SameSite=Lax and Secure on HTTPS.", jsFile, "Restore the cookie attributes in writeChoice().");
  }

  // -- Privacy policy describes what the code really does -----------------------
  const policy = pages["privacy-policy.html"] ? pages["privacy-policy.html"].html : "";
  const text = policy.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
  const gaCookie = "_ga_" + APPROVED_GA_ID.slice(2);
  const required = [
    ["the consent cookie name", cookieName],
    ["the consent cookie lifetime", maxAge ? `${Math.round(maxAge / 86400)} days` : null],
    ["the _ga cookie", "_ga"],
    ["the container cookie", gaCookie],
    ["Google Analytics 4", "Google Analytics 4"],
    ["the Cookie settings control", "Cookie settings"],
    ["the Reject choice", "Reject analytics"],
  ];
  for (const [what, needle] of required) {
    if (!needle || !text.includes(needle)) {
      fail(check, `privacy-policy.html does not mention ${what} (${needle}).`, "site/privacy-policy.html", "Keep the Cookie/Analytics sections in sync with analytics.js.");
    }
  }
  if (/Google Ads (tracking|and)/i.test(text)) {
    fail(check, "privacy-policy.html claims Google Ads tracking, which this site does not load.", "site/privacy-policy.html", "Describe only tags the site actually uses.");
  }

  // -- CSP: exact Google origins, no wildcards or unsafe allowances -------------
  const csp = parseCsp();
  if (!csp) {
    fail(check, "Could not parse the ContentSecurityPolicy in infra/template.yaml.", "infra/template.yaml", "Restore the ContentSecurityPolicy block.");
  } else {
    const has = (dir, origin) => (csp[dir] || []).includes(origin);
    for (const [dir, origin] of [
      ["script-src", "https://www.googletagmanager.com"],
      ["connect-src", "https://www.google-analytics.com"],
      ["connect-src", "https://region1.google-analytics.com"],
      ["frame-src", "https://maps.google.com"],
      ["frame-src", "https://www.google.com"],
    ]) {
      if (!has(dir, origin)) fail(check, `CSP ${dir} is missing ${origin}.`, "infra/template.yaml", `Add ${origin} to ${dir}.`);
    }
    for (const dir of ["default-src", "script-src", "style-src", "connect-src", "img-src", "frame-src"]) {
      for (const src of csp[dir] || []) {
        if (/\*/.test(src)) fail(check, `CSP ${dir} contains a wildcard source "${src}".`, "infra/template.yaml", "List exact origins instead.");
        if (/unsafe-eval|unsafe-inline/.test(src)) fail(check, `CSP ${dir} allows ${src}.`, "infra/template.yaml", "Remove it; the site needs no inline/eval allowances.");
      }
    }
    for (const dir of ["script-src", "connect-src", "img-src"]) {
      for (const src of csp[dir] || []) {
        if (/(^|\.)(google\.com|doubleclick\.net|googlesyndication\.com)$/.test(src.replace(/^https:\/\//, ""))) {
          fail(check, `CSP ${dir} allows ${src}, which this analytics set-up does not need.`, "infra/template.yaml", "Google signals/ads are off; remove it.");
        }
      }
    }
  }

  // -- Build output carries the same implementation ----------------------------
  const distJs = path.join(ROOT, "dist", "assets", "js");
  const built = fs.existsSync(distJs) ? fs.readdirSync(distJs).filter((f) => /^analytics\.[0-9a-f]{8}\.js$/.test(f)) : [];
  if (built.length !== 1 || !fs.readFileSync(path.join(distJs, built[0]), "utf8").includes(APPROVED_GA_ID)) {
    fail(check, "dist/ does not contain exactly one fingerprinted analytics.js carrying the approved Measurement ID.", "scripts/build.js", "Rebuild and make sure analytics.js is fingerprinted into dist/.");
  }
}

// ---------------------------------------------------------------------------
// Check 16: CloudFront Function limits + routing tables + 404 page
// ---------------------------------------------------------------------------
// AWS rejects a CloudFront Function whose code exceeds 10 KB (10,240 bytes, not adjustable) or whose
// Comment exceeds 128 characters — the stack could not even be created. Nothing else in this repo can
// notice that before deploy day, so it is checked here, together with the routing it implements.
function checkCloudFrontRouting(pages) {
  const check = "16. CloudFront routing & 404 page";
  const tpl = "infra/template.yaml";
  const routing = loadRoutingTables();
  if (!routing) return; // already reported by check 13
  const { code, template, special, same, legacy, pageFiles } = routing;

  const bytes = Buffer.byteLength(code);
  if (bytes >= 10240) fail(check, `LegacyRedirectFunction code is ${bytes} bytes; CloudFront Functions are limited to 10,240 bytes.`, tpl, "Shrink the routing tables/code (keep documentation in YAML comments, not in the function).");
  const comment = (template.match(/FunctionConfig:\n\s+Comment: (?:>-\n)?([\s\S]*?)\n\s+Runtime:/) || [])[1] || "";
  if (comment.replace(/\s+/g, " ").trim().length > 128) fail(check, `LegacyRedirectFunction Comment is ${comment.replace(/\s+/g, " ").trim().length} characters; the limit is 128.`, tpl, "Shorten FunctionConfig.Comment; move the detail into YAML comments above the resource.");
  if (/=>|\blet\b|\bconst\b|`/.test(code)) fail(check, "LegacyRedirectFunction uses syntax outside the cloudfront-js-1.0 (ES5) runtime.", tpl, "Use var / function expressions / string concatenation only.");
  const csp = (template.match(/ContentSecurityPolicy: >-\n([\s\S]*?)\n\s*Override: true/) || [])[1];
  if (csp && csp.split("\n").map((l) => l.trim()).join(" ").length > 1783) fail(check, "Content-Security-Policy header value exceeds CloudFront's 1,783-character limit.", tpl, "Shorten the CSP.");

  // The routing tables must describe exactly the pretty-path pages verify.js already knows about.
  const derived = Object.fromEntries(Object.entries(pageFiles));
  const expected = Object.fromEntries(Object.entries(CANONICAL_URL_OVERRIDES));
  for (const [file, slug] of Object.entries(expected)) {
    if (derived[file] !== slug) fail(check, `Routing tables map ${file} to ${derived[file] || "nothing"}, but its canonical is /${slug}.`, tpl, "Keep the special/same tables and CANONICAL_URL_OVERRIDES in sync.");
  }
  for (const [file, slug] of Object.entries(derived)) {
    if (!expected[file]) fail(check, `Routing tables serve /${slug} from ${file}, which is not in CANONICAL_URL_OVERRIDES.`, tpl, "Add it to CANONICAL_URL_OVERRIDES (and the sitemap) or remove it from the function.");
    if (!pages[file]) fail(check, `Routing tables point at site/${file}, which does not exist.`, tpl, "Restore the page or remove the route.");
  }
  if (new Set(same).size !== same.length) fail(check, "Duplicate slug in the `same` table.", tpl, "Remove the duplicate.");
  for (const [from, to] of Object.entries(legacy)) {
    const dest = to.replace(/^\//, "");
    const ok = pages[dest] || Object.values(derived).includes(dest) || Object.values(derived).includes(dest + (dest.endsWith("/") ? "" : "/"));
    if (!ok) fail(check, `Legacy redirect ${from} -> ${to} does not land on an existing page.`, tpl, "Point it at a page that exists (its canonical URL).");
  }

  // Run the real function code against known cases.
  let handler;
  try { handler = require("vm").runInNewContext(code + "\n;handler"); } catch (e) { fail(check, `LegacyRedirectFunction does not evaluate: ${e.message}`, tpl, "Fix the syntax."); return; }
  const call = (uri, host) => handler({ request: { uri, method: "GET", headers: host ? { host: { value: host } } : {}, querystring: {}, cookies: {} } });
  const [aboutFile, aboutSlug] = Object.entries(derived).find(([f]) => f === "about.html") || [];
  const cases = [
    () => call(`/${aboutSlug}`).uri === `/${aboutFile}` && call(`/${aboutSlug}`, "sfrmotors.co.uk").uri === `/${aboutFile}`,
    () => { const r = call(`/${aboutFile}`); return r.statusCode === 301 && r.headers.location.value === `/${aboutSlug}`; },
    () => { const r = call("/x/", "www.sfrmotors.co.uk"); return r.statusCode === 301 && r.headers.location.value === "https://sfrmotors.co.uk/x/"; },
    () => { const r = call("/index.html"); return r.statusCode === 301 && r.headers.location.value === "/"; },
    () => call("/").uri === "/" && call("/constructor").uri === "/constructor" && call("/index.html/").uri === "/index.html/",
  ];
  cases.forEach((c, i) => { let ok = false; try { ok = c(); } catch (e) { /* falls through */ } if (!ok) fail(check, `LegacyRedirectFunction behaviour case ${i + 1} failed (pretty rewrite / .html 301 / www 301 / pass-through).`, tpl, "Restore the routing logic."); });

  // Error pages: a dedicated, noindex, root-relative 404 page
  const errors = matchAll(/ErrorCode: (\d+)\n\s+ResponseCode: (\d+)\n\s+ResponsePagePath: (\S+)/g, template);
  if (errors.length === 0 || errors.some((e) => e[3] !== "/404.html" || e[2] !== "404")) fail(check, "CloudFront custom error responses must return /404.html with status 404.", tpl, "Point every CustomErrorResponses entry at /404.html with ResponseCode 404.");
  const p404 = pages["404.html"];
  if (!p404) fail(check, "site/404.html is missing (CloudFront serves it for missing URLs).", "site/404.html", "Restore it.");
  else if (p404.indexable || /rel=["']canonical["']/i.test(p404.html)) fail(check, "site/404.html must be noindex and have no canonical.", "site/404.html", 'Use <meta name="robots" content="noindex, follow"> and no canonical.');
}

// ---------------------------------------------------------------------------
// Check 17: JSON-LD is valid and every URL in it is absolute and on the production domain
// ---------------------------------------------------------------------------
// Relative URLs in structured data are invalid schema.org and (when they name a redirecting .html
// path) point crawlers at the wrong URL. The `sameAs` list is deliberately excluded (external profiles).
function checkStructuredDataUrls(pages) {
  const check = "17. Structured data URLs";
  for (const [file, page] of Object.entries(pages)) {
    for (const [, body] of matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, page.html)) {
      let data;
      try { data = JSON.parse(body); } catch (e) { fail(check, `Invalid JSON-LD: ${e.message}`, `site/${file}`, "Fix the JSON syntax."); continue; }
      const walk = (node, key) => {
        if (Array.isArray(node)) return node.forEach((n) => walk(n, key));
        if (node && typeof node === "object") return Object.entries(node).forEach(([k, v]) => k !== "sameAs" && walk(v, k));
        if (typeof node === "string" && ["url", "item", "@id", "logo", "image", "contentUrl"].includes(key) && !node.startsWith(`${PROD_DOMAIN}/`) && !node.startsWith("#")) {
          fail(check, `JSON-LD "${key}" is not an absolute ${PROD_DOMAIN}/ URL: "${node}".`, `site/${file}`, `Use the page's full canonical URL under ${PROD_DOMAIN}/.`);
        }
      };
      walk(data, "");
    }
  }
}

// ---------------------------------------------------------------------------
// Check 18: owner-approved corrections that must not regress
// ---------------------------------------------------------------------------
// Self-hosted fonts, click-to-load map, robots policy, no placeholder social links, no street address,
// the company disclosure, and the values the owner fixed (rating, no priceRange, WhatsApp channel).
function checkOwnerApprovedCorrections(pages) {
  const check = "18. Approved corrections";
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
  const css = read("site/assets/css/main.css");
  const mainJs = read("site/assets/js/main.js");
  const template = read("infra/template.yaml").replace(/\r/g, "");
  const shipped = [...Object.values(pages).map((p) => p.html), css, mainJs, read("site/assets/js/analytics.js"), template].join("\n");

  // -- fonts: self-hosted, no Google Fonts anywhere ------------------------------
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(shipped)) fail(check, "Google Fonts is still referenced (HTML, CSS, JS or the CSP).", "site/", "Self-host the font (site/assets/fonts) and remove every fonts.googleapis.com / fonts.gstatic.com reference.");
  const faces = matchAll(/@font-face\s*\{([^}]*)\}/g, css).map((m) => m[1]);
  const fontFiles = new Set();
  if (faces.length === 0) fail(check, "No @font-face rule found; the site font is not self-hosted.", "site/assets/css/main.css", "Restore the Roboto @font-face rules.");
  for (const face of faces) {
    if (!/font-display:\s*swap/.test(face)) fail(check, "An @font-face rule lacks font-display: swap.", "site/assets/css/main.css", "Add font-display:swap.");
    const url = (face.match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
    if (!url || !fs.existsSync(path.join(SITE_DIR, url.replace(/^\//, "")))) fail(check, `@font-face points at a missing file: ${url}.`, "site/assets/css/main.css", "Add the WOFF2 file under site/assets/fonts/.");
    else fontFiles.add(url);
  }
  if (!fs.existsSync(path.join(SITE_DIR, "assets", "fonts", "OFL.txt"))) fail(check, "The font licence (site/assets/fonts/OFL.txt) is missing.", "site/assets/fonts/OFL.txt", "Ship the SIL OFL text next to the font.");
  for (const [file, page] of Object.entries(pages)) {
    const pre = matchAll(/<link\s+rel="preload"[^>]*>/g, page.html).map((m) => m[0]);
    if (pre.length !== 1 || ![...fontFiles].some((u) => pre[0].includes(`href="${u}"`)) || !/crossorigin/.test(pre[0]) || !/as="font"/.test(pre[0])) {
      fail(check, "Page must preload the self-hosted font exactly once (as=font, crossorigin).", `site/${file}`, 'Add <link rel="preload" href="/assets/fonts/roboto-latin-var.woff2" as="font" type="font/woff2" crossorigin>.');
    }
  }
  const csp = parseCsp();
  if (csp) {
    for (const dir of ["style-src", "font-src"]) {
      if (!(csp[dir] || []).length || !(csp[dir] || []).every((v) => v === "'self'")) fail(check, `CSP ${dir} must be 'self' only (fonts and CSS are self-hosted); found: ${(csp[dir] || []).join(" ")}.`, "infra/template.yaml", `Set ${dir} 'self'.`);
    }
  }

  // -- Google Map: nothing from Google before a deliberate click ------------------
  for (const [file, page] of Object.entries(pages)) {
    if (/<iframe\b/i.test(page.html)) fail(check, "Page contains an <iframe> at load time; the map must be created only after the visitor clicks.", `site/${file}`, "Use the click-to-load placeholder (data-sfr-map).");
    const stripped = page.html.replace(/<a\b[^>]*class="sfr-(?:map__directions|reviews__link)"[\s\S]*?<\/a>/g, "").replace(/data-src="[^"]*"/g, "");
    if (/google\.com\/maps|maps\.google\.com/.test(stripped)) fail(check, "Page references Google Maps outside the click-to-load button/link.", `site/${file}`, "Keep the map URL only in the button's data-src and the explicit 'View ... on Google Maps' / 'Read reviews' links.");
  }
  const contact = pages["contact.html"] ? pages["contact.html"].html : "";
  if (!/<button[^>]*data-sfr-map-load[^>]*data-src="https:\/\/maps\.google\.com\/maps\?q=Bathgate%2C\+West\+Lothian[^"]*"[^>]*>Load Google Map<\/button>/.test(contact)) {
    fail(check, 'Contact page needs the "Load Google Map" button whose data-src is the general Bathgate, West Lothian map.', "site/contact.html", "Restore the click-to-load placeholder.");
  }
  const clickAt = mainJs.indexOf('mapButton.addEventListener("click"');
  const frameAt = mainJs.indexOf('createElement("iframe")');
  if (clickAt === -1 || frameAt === -1 || frameAt < clickAt || mainJs.split('createElement("iframe")').length !== 2) fail(check, "main.js must create the map iframe once, inside the button's click handler.", "site/assets/js/main.js", "Create the iframe only in the click handler.");

  // -- robots.txt -----------------------------------------------------------------
  const robots = read("site/robots.txt");
  const group = (agent) => { const m = robots.match(new RegExp(`User-agent:\\s*${agent}\\s*\\n((?:(?!User-agent)[^\\n]*\\n?)*)`, "i")); return m ? m[1] : null; };
  const oai = group("OAI-SearchBot") || "", gpt = group("GPTBot") || "", any = group("\\*") || "";
  if (!/^Allow:\s*\/\s*$/m.test(oai) || /^Disallow:\s*\S/m.test(oai)) fail(check, "robots.txt must explicitly allow OAI-SearchBot.", "site/robots.txt", "Add a `User-agent: OAI-SearchBot` group with `Allow: /`.");
  if (!/^Disallow:\s*\/\s*$/m.test(gpt)) fail(check, "robots.txt must explicitly disallow GPTBot.", "site/robots.txt", "Add a `User-agent: GPTBot` group with `Disallow: /`.");
  if (!/^Allow:\s*\/\s*$/m.test(any) || /^Disallow:\s*\S/m.test(any)) fail(check, "robots.txt must keep general crawling (and rendering assets) allowed.", "site/robots.txt", "Keep `User-agent: *` with `Allow: /` and no Disallow rules.");
  if (!/^Sitemap:\s*https:\/\/sfrmotors\.co\.uk\/sitemap\.xml\s*$/m.test(robots)) fail(check, "robots.txt lost its Sitemap line.", "site/robots.txt", "Restore `Sitemap: https://sfrmotors.co.uk/sitemap.xml`.");

  // -- no street address; registered office only in the legal line ------------------
  const walk = (p) => (fs.statSync(path.join(ROOT, p)).isDirectory() ? fs.readdirSync(path.join(ROOT, p)).flatMap((f) => (f === "node_modules" ? [] : walk(path.posix.join(p, f)))) : [p]);
  for (const rel of ["site", "backend", "SFR_Website_Info.txt"].flatMap(walk)) {
    if (!/\.(html|js|css|txt|xml|yaml|json|md)$/.test(rel)) continue;
    if (/loch park|EH48|W932\+|streetAddress|postalCode/i.test(read(rel))) fail(check, "A street address / postcode / Plus Code for the working location appears in the source.", rel, "SFR Motors is a service-area business; the public location is Bathgate, West Lothian only.");
  }
  for (const [file, page] of Object.entries(pages)) {
    const footer = (page.html.match(/<footer[\s\S]*<\/footer>/) || [""])[0];
    if (!/<p class="sfr-footer__legal">SFR Motors Ltd\. Registered in England and Wales, company number 15819240\. Registered office: 143 Beverley Drive, Edgware, England, HA8 5NH\.<\/p>/.test(footer)) {
      fail(check, "Footer is missing the company disclosure line (name, England and Wales, company number, registered office).", `site/${file}`, "Restore the .sfr-footer__legal paragraph.");
    }
    const outsideLegal = page.html.replace(/<p class="sfr-footer__legal">[\s\S]*?<\/p>/g, "");
    if (/Beverley/.test(outsideLegal) && file !== "privacy-policy.html") fail(check, "The registered office appears outside the footer legal line (it must not read as a service location).", `site/${file}`, "Show it only in the legal line.");
    if (/<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*Beverley/.test(page.html) || /href="[^"]*Beverley/.test(page.html)) fail(check, "The registered office is used in structured data or a link.", `site/${file}`, "Never present it as a business location or map destination.");
    if (!/07448 427154/.test(footer) || !/wa\.me\/447448427154/.test(footer)) fail(check, "Footer must list the WhatsApp channel (07448 427154).", `site/${file}`, "Restore the WhatsApp contact line.");
    if (/priceRange/.test(page.html)) fail(check, "priceRange must not be present in structured data.", `site/${file}`, "Remove it (the owner has not approved a price classification).");
  }
  const home = pages["index.html"] ? pages["index.html"].html : "";
  if (!/"ratingValue": "4\.9"[\s\S]{0,60}"reviewCount": "282"/.test(home)) fail(check, "Home aggregateRating must stay 4.9 / 282.", "site/index.html", "Restore ratingValue 4.9 and reviewCount 282.");
  if (!/<a class="sfr-areas__pin" href="broxburn\/"/.test(home)) fail(check, "The Areas We Cover list must link to the existing /broxburn/ page.", "site/index.html", 'Restore the <a class="sfr-areas__pin" href="broxburn/"> entry.');
  if (!/"telephone": "\+447448427154"/.test(contact)) fail(check, "The Contact page structured data must list the WhatsApp channel.", "site/contact.html", "Restore the WhatsApp ContactPoint.");
}

// ---------------------------------------------------------------------------
// Check 19: Vercel Preview configuration routes exactly like the CloudFront Function
// ---------------------------------------------------------------------------
// vercel.json is generated from infra/template.yaml (scripts/vercel-config.js). This proves it is up to date and
// that, for every pretty path, .html URL, legacy WordPress URL, the Home page and unknown URLs, Vercel's
// order (redirects, files, rewrites, 404.html) gives the same result as the approved CloudFront routing.
function checkVercelConfig() {
  const check = "19. Vercel Preview config";
  const { buildConfig, loadRouting, simulateVercel, VERCEL_JSON } = require("./vercel-config");
  let expected, routing, config;
  try {
    expected = buildConfig();
    routing = loadRouting();
    config = JSON.parse(fs.readFileSync(VERCEL_JSON, "utf8"));
  } catch (e) {
    fail(check, `Could not build or read the Vercel configuration: ${e.message}`, "vercel.json", "Run `node scripts/vercel-config.js` to regenerate vercel.json.");
    return;
  }
  if (JSON.stringify(config) !== JSON.stringify(expected)) {
    fail(check, "vercel.json is out of date with infra/template.yaml (routing tables, CSP or security headers).", "vercel.json", "Run `node scripts/vercel-config.js` and commit the result.");
  }
  if (config.cleanUrls || config.trailingSlash !== undefined) {
    fail(check, "vercel.json sets cleanUrls/trailingSlash, which would change the approved URLs (.html 301s, pretty-path trailing slashes).", "vercel.json", "Remove cleanUrls / trailingSlash.");
  }
  // The review copy must never be indexed; that noindex must stay Vercel-only (never in the spec for the real hosting).
  const globalRule = (config.headers || []).find((rule) => rule.source === "/(.*)");
  const robotsHeaders = ((globalRule && globalRule.headers) || []).filter((h) => h.key.toLowerCase() === "x-robots-tag");
  if (robotsHeaders.length !== 1 || robotsHeaders[0].value !== "noindex, nofollow") {
    fail(check, 'vercel.json must send "X-Robots-Tag: noindex, nofollow" on every response (source "/(.*)") so the Vercel review copy is kept out of search engines.', "vercel.json", "Regenerate it with `node scripts/vercel-config.js`; the header is added in scripts/vercel-config.js.");
  }
  if ((config.headers || []).some((rule) => rule !== globalRule && rule.headers.some((h) => h.key.toLowerCase() === "x-robots-tag"))) {
    fail(check, "A second vercel.json rule sets X-Robots-Tag and could override the review-copy noindex.", "vercel.json", "Keep a single X-Robots-Tag in the global rule.");
  }
  if (/x-robots-tag/i.test(fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8"))) {
    fail(check, "infra/template.yaml (the spec for the real hosting) carries X-Robots-Tag; noindex belongs only to the Vercel review copy.", "infra/template.yaml", "Remove it; the real website must stay indexable.");
  }
  if (config.outputDirectory !== "dist" || config.buildCommand !== "npm run build") {
    fail(check, "vercel.json must build with `npm run build` and publish dist/.", "vercel.json", 'Set "buildCommand": "npm run build" and "outputDirectory": "dist".');
  }
  const distDir = path.join(ROOT, "dist");
  if (!fs.existsSync(path.join(distDir, "404.html"))) fail(check, "dist/404.html is missing; Vercel serves it (status 404) for unknown URLs.", "site/404.html", "Restore site/404.html.");
  const hasFile = (p) => { const f = path.join(distDir, p.replace(/^\//, "")); return !p.endsWith("/") && !p.includes("..") && fs.existsSync(f) && fs.statSync(f).isFile(); };

  const { special, same, legacy, edgeFunction } = routing;
  const slugs = [...Object.keys(special), ...same];
  const urls = ["/", "/index.html", "/services.html", "/privacy-policy.html", "/404.html", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/no-such-page", "/no-such-page/", "/assets/img/none.webp"];
  for (const [slug, file] of [...Object.entries(special), ...same.map((s) => [s, s])]) urls.push(`/${slug}`, `/${slug}/`, `/${file}.html`);
  for (const from of Object.keys(legacy)) urls.push(from, `${from}/`);
  for (const url of [...new Set(urls)]) {
    let edge;
    const out = edgeFunction({ request: { uri: url, method: "GET", headers: {}, querystring: {}, cookies: {} } });
    if (out.statusCode) edge = { redirect: out.headers.location.value };
    else { const f = out.uri === "/" ? "/index.html" : out.uri; edge = hasFile(f) ? { file: f } : { notFound: true }; }
    const vercel = simulateVercel(config, url, hasFile);
    if (JSON.stringify(edge) !== JSON.stringify(vercel)) {
      fail(check, `${url}: CloudFront gives ${JSON.stringify(edge)} but vercel.json gives ${JSON.stringify(vercel)}.`, "vercel.json", "Regenerate vercel.json (node scripts/vercel-config.js) or fix the routing tables.");
    }
    if (edge.file && !hasFile(edge.file)) fail(check, `${url} resolves to ${edge.file}, which is not in dist/.`, "infra/template.yaml", "Point the route at a page that exists.");
  }
  if (slugs.length === 0) fail(check, "No pretty-path routes were found.", "infra/template.yaml", "Restore the routing tables.");
}

// ---------------------------------------------------------------------------
// Check 20: production-hostname guards (Analytics and the WhatsApp form)
// ---------------------------------------------------------------------------
// Runs analytics.js and main.js in a sandbox on production, localhost, *.vercel.app and look-alike hostnames
// (scripts/host-guard-tests.js): Google Analytics and the WhatsApp enquiry work only on sfrmotors.co.uk /
// www.sfrmotors.co.uk, while the consent banner works everywhere.
function checkHostGuards() {
  for (const message of require("./host-guard-tests").runAll()) {
    fail("20. Hostname guards", message, "site/assets/js/analytics.js, site/assets/js/main.js", "Keep the production-hostname guard in both scripts (see scripts/host-guard-tests.js).");
  }
}

// ---------------------------------------------------------------------------
// Check 21: the deployed-headers checker behaves (mock tests, no network)
// ---------------------------------------------------------------------------
// scripts/check-vercel-deployment.js may only verify publicly reachable *.vercel.app responses: it must pass complete headers, fail a missing or
// weakened noindex, report a protected (login-redirect) deployment as "unverified" rather than pass/fail, never follow redirects or send
// credentials, and refuse the real domain. Its tests use a fake fetch, so nothing is sent to Vercel.
async function checkDeploymentChecker() {
  for (const message of await require("./check-vercel-deployment.test").runAll()) {
    fail("21. Deployment checker", message, "scripts/check-vercel-deployment.js", "Fix the checker or its mock tests (scripts/check-vercel-deployment.test.js).");
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
const TOTAL_CHECKS = 21;

async function main() {
  const buildOk = checkBuild();

  const pages = loadPages();
  checkLinksAndAnchors(pages);
  checkSingleH1(pages);
  checkTitleAndDescription(pages);
  checkCanonicals(pages);
  checkImages(pages);
  checkUnreferencedImages(pages);
  checkSitemap(pages);
  checkNoPlaceholders(pages);
  checkPrettyPathAssets(pages);
  checkRootFavicon();
  checkConsentAndAnalytics(pages);
  checkCloudFrontRouting(pages);
  checkStructuredDataUrls(pages);
  checkOwnerApprovedCorrections(pages);
  checkVercelConfig();
  checkHostGuards();
  await checkDeploymentChecker();
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

main().catch((err) => { console.error(err); process.exit(2); });
