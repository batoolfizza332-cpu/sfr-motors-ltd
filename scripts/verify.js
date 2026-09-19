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
  for (const [file, page] of Object.entries(pages)) {
    const hrefs = matchAll(/<a\s[^>]*href=["']([^"']+)["']/g, page.html).map((m) => m[1]);
    for (const href of hrefs) {
      if (href === "#") continue; // intentional no-op placeholder (social icons)
      if (/^(https?:|tel:|mailto:)/i.test(href)) continue; // external, out of scope

      const [targetFileRaw, fragment] = href.split("#");
      // A leading "/" makes the link root-relative rather than relative to
      // the current page — required on pages served at a pretty path (e.g.
      // /broxburn/), where a plain relative href would otherwise resolve
      // underneath that path instead of at the site root. Every physical
      // file already lives at the root of site/, so stripping it resolves
      // to the same filename a same-directory relative link would use.
      let targetFile = targetFileRaw === "" ? file : targetFileRaw.replace(/^\//, "").split("?")[0];

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
// Check 13: pretty-path pages never use document-relative local assets
// ---------------------------------------------------------------------------
// A page served at a pretty path (e.g. /blog/) resolves a plain
// href="assets/..." to /blog/assets/..., which doesn't exist. The routing
// source of truth is the `rewrites` map in the CloudFront Function in
// infra/template.yaml, unioned with CANONICAL_URL_OVERRIDES.
function prettyPathFiles() {
  const template = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8");
  const block = template.match(/var rewrites = \{([\s\S]*?)\n\s*\};/);
  const routed = block ? matchAll(/'\/[^']*':\s*'\/([^']+\.html)'/g, block[1]).map((m) => m[1]) : [];
  if (routed.length === 0) {
    fail(
      "13. Pretty-path assets",
      "Could not find any pretty-path rewrites in infra/template.yaml (LegacyRedirectFunction `var rewrites`).",
      "infra/template.yaml",
      "Restore the `rewrites` map, or update prettyPathFiles() in scripts/verify.js to match the new routing."
    );
  }
  return [...new Set([...routed, ...Object.keys(CANONICAL_URL_OVERRIDES)])].sort();
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
const TOTAL_CHECKS = 15;

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
  checkPrettyPathAssets(pages);
  checkRootFavicon();
  checkConsentAndAnalytics(pages);
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
