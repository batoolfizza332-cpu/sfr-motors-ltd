#!/usr/bin/env node
// Phase 4B Batch F — full 80-page pre-launch audit.
//
// This is a DATA-GATHERING tool, not a pass/fail gate (see
// scripts/phase4b-batchF-test.js for that). It crawls every built page,
// records everything Batch F Part 2/3/4/6 asks for, and writes a
// machine-readable report to PRELAUNCH_PAGE_AUDIT.json so the result can
// be reviewed later without re-running the crawl.
//
// Run: `node scripts/batchF-audit.js` (after `npm run build`).

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const DIST_DIR = path.join(ROOT, "dist");
const PORT = 8960;
const BASE = `http://127.0.0.1:${PORT}`;
const DOMAIN = "https://sfrmotors.co.uk";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const redirectMap = new Map(vercelConfig.redirects.map((r) => [r.source, r.destination]));

function contentTypeFor(file) {
  const ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let p = decodeURIComponent(url.pathname);
  if (redirectMap.has(p)) {
    res.writeHead(301, { Location: redirectMap.get(p) });
    return res.end();
  }
  if (p !== "/" && !p.endsWith("/") && !path.extname(p)) {
    res.writeHead(301, { Location: p + "/" });
    return res.end();
  }
  const filePath = p.endsWith("/") ? path.join(DIST_DIR, p, "index.html") : path.join(DIST_DIR, p);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFoundPath = path.join(DIST_DIR, "index.html");
      fs.readFile(notFoundPath, (err2, data2) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(err2 ? "404" : data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
});

function get(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on("error", reject);
  });
}

function walkPages(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPages(full));
    else if (entry.name === "index.html") out.push(full);
  }
  return out;
}

function extractJsonLd(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    try { blocks.push(JSON.parse(m[1])); }
    catch (e) { blocks.push({ __parseError: e.message, __raw: m[1].slice(0, 200) }); }
  }
  return blocks;
}

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /todo:?\s/i,
  /\[insert/i,
  /placeholder text/i,
  /\bTBD\b/,
  /\bTBC\b/,
];
// Very rough Devanagari-script detector, for "no Hindi/placeholder text" check.
const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;
const NATIONWIDE_PATTERN = /nationwide/i;
const UNSUPPORTED_ARRIVAL_PATTERN = /within \d+\s*minutes?|arrival time\b.{0,20}\d+\s*minutes?/i;
const UNSUPPORTED_PRICE_PATTERN = /£\d(?!,?500\b)/; // £2,500 is the verified GOV.UK penalty figure, not a price
const STALE_COMPANY_NAME_PATTERN = /sfr mobile tyres ltd/i;
const PREVIEW_DOMAIN_PATTERN = /vercel\.app|localhost|127\.0\.0\.1|\.pages\.dev|staging\./i;
const AMERICAN_SPELLING_PATTERN = /\btire(s)?\b/i;

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));

  const files = walkPages(DIST_DIR);
  console.log(`Auditing ${files.length} built pages...\n`);

  const sitemapXml = fs.readFileSync(path.join(DIST_DIR, "sitemap.xml"), "utf8");
  const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk(\/[a-z0-9\-\/]*)<\/loc>/gi)].map((m) => m[1]));

  const pages = [];
  const titles = new Map();
  const descs = new Map();

  for (const file of files) {
    const relDir = path.relative(DIST_DIR, path.dirname(file));
    const urlPath = relDir === "" ? "/" : "/" + relDir.replace(/\\/g, "/") + "/";
    const res = await get(urlPath);
    const html = res.body;

    const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || null;
    const desc = html.match(/name="description" content="([^"]*)"/)?.[1] || null;
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1] || null;
    const ogUrl = html.match(/property="og:url" content="([^"]+)"/)?.[1] || null;
    const robotsMeta = html.match(/name="robots" content="([^"]+)"/)?.[1] || null;
    const jsonLd = extractJsonLd(html);

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);

    const internalHrefs = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"));
    const brokenInternalLinks = [];
    for (const href of internalHrefs) {
      const clean = href.split("#")[0].split("?")[0];
      if (clean === "" || clean === "/") continue;
      const slug = clean.replace(/^\/|\/$/g, "");
      const target = clean.endsWith("/") || clean === "" ? path.join(DIST_DIR, slug, "index.html") : path.join(DIST_DIR, clean);
      const isRedirectSource = redirectMap.has(clean);
      const isRealFile = fs.existsSync(target) || (clean.endsWith("/") && fs.existsSync(path.join(DIST_DIR, slug, "index.html")));
      if (!isRealFile && !isRedirectSource) brokenInternalLinks.push(href);
    }

    const staleSlugLinks = internalHrefs.filter((h) => redirectMap.has(h.split("#")[0].split("?")[0]));
    const htmlExtLinks = hrefs.filter((h) => /\.html(?:[?#]|$)/i.test(h));
    const previewDomainLinks = [...hrefs, ...srcs].filter((h) => PREVIEW_DOMAIN_PATTERN.test(h));

    const localAssetSrcs = srcs.filter((s) => s.startsWith("/assets/"));
    const brokenAssets = [];
    for (const s of localAssetSrcs) {
      const clean = s.split("?")[0];
      if (!fs.existsSync(path.join(DIST_DIR, clean.replace(/^\//, "")))) brokenAssets.push(s);
    }
    const cssHrefs = hrefs.filter((h) => h.startsWith("/assets/css/"));
    for (const h of cssHrefs) {
      if (!fs.existsSync(path.join(DIST_DIR, h.replace(/^\//, "")))) brokenAssets.push(h);
    }

    const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const finding = {
      url: urlPath,
      httpStatus: res.status,
      h1Count: h1Matches.length,
      h1Text: h1Matches.map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
      title,
      metaDescription: desc,
      canonical,
      canonicalSelfMatch: canonical === `${DOMAIN}${urlPath}`,
      ogUrl,
      ogUrlMatchesCanonical: ogUrl === canonical,
      robotsMeta,
      jsonLdBlockCount: jsonLd.length,
      jsonLdParseErrors: jsonLd.filter((b) => b.__parseError).map((b) => b.__parseError),
      jsonLdTypes: jsonLd.filter((b) => b["@type"]).map((b) => b["@type"]),
      hasAggregateRating: html.includes('"aggregateRating"') || html.includes('"AggregateRating"'),
      jsonLdUrlFields: jsonLd.flatMap((b) => [b.url, b.mainEntityOfPage, b["@id"]]).filter(Boolean),
      jsonLdUrlsUseCorrectDomain: jsonLd.flatMap((b) => [b.url, b.mainEntityOfPage, b["@id"]]).filter(Boolean).every((u) => typeof u === "string" && u.startsWith(DOMAIN)),
      inSitemap: sitemapUrls.has(urlPath),
      brokenInternalLinks,
      staleRedirectSourceLinks: staleSlugLinks,
      htmlExtensionLinks: htmlExtLinks,
      previewOrLocalhostLinks: previewDomainLinks,
      brokenLocalAssets: brokenAssets,
      hasPhoneLink: html.includes('href="tel:01312020289"'),
      hasWhatsAppLink: html.includes('href="https://wa.me/447448427154"'),
      hasCorrectCompanyName: /sfr motors ltd/i.test(textOnly),
      hasStaleCompanyName: STALE_COMPANY_NAME_PATTERN.test(textOnly),
      hasNationwideClaim: NATIONWIDE_PATTERN.test(textOnly),
      hasUnsupportedArrivalTimeClaim: UNSUPPORTED_ARRIVAL_PATTERN.test(textOnly),
      hasUnsupportedPriceClaim: UNSUPPORTED_PRICE_PATTERN.test(textOnly),
      hasPlaceholderText: PLACEHOLDER_PATTERNS.some((re) => re.test(textOnly)),
      hasDevanagariText: DEVANAGARI_PATTERN.test(textOnly),
      hasAmericanSpelling: AMERICAN_SPELLING_PATTERN.test(textOnly),
      americanSpellingIsUrlException: urlPath === "/michelin-radial-tire-history-innovation/",
    };
    pages.push(finding);

    if (title) {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(urlPath);
    }
    if (desc) {
      if (!descs.has(desc)) descs.set(desc, []);
      descs.get(desc).push(urlPath);
    }
  }

  // orphan check: every page (except homepage) should be linked from at least one other page
  const allHtml = files.map((f) => ({ file: f, html: fs.readFileSync(f, "utf8") }));
  for (const p of pages) {
    if (p.url === "/") { p.isOrphan = false; continue; }
    p.isOrphan = !allHtml.some(({ file, html }) => {
      const relDir = path.relative(DIST_DIR, path.dirname(file));
      const thisUrl = relDir === "" ? "/" : "/" + relDir.replace(/\\/g, "/") + "/";
      if (thisUrl === p.url) return false;
      return html.includes(`href="${p.url}"`);
    });
  }

  const duplicateTitles = [...titles.entries()].filter(([, urls]) => urls.length > 1);
  const duplicateDescs = [...descs.entries()].filter(([, urls]) => urls.length > 1);

  const report = {
    generatedAt: new Date().toISOString(),
    totalPagesAudited: pages.length,
    duplicateTitles: duplicateTitles.map(([title, urls]) => ({ title, urls })),
    duplicateMetaDescriptions: duplicateDescs.map(([desc, urls]) => ({ desc, urls })),
    pages,
  };

  fs.writeFileSync(path.join(ROOT, "PRELAUNCH_PAGE_AUDIT.json"), JSON.stringify(report, null, 1));

  // console summary
  const summarize = (label, filterFn) => {
    const hits = pages.filter(filterFn);
    console.log(`${label}: ${hits.length}`);
    for (const h of hits.slice(0, 10)) console.log(`    ${h.url}`);
  };
  console.log("=== Summary ===");
  console.log(`Total pages: ${pages.length}`);
  console.log(`Duplicate titles: ${duplicateTitles.length}`);
  console.log(`Duplicate meta descriptions: ${duplicateDescs.length}`);
  summarize("Pages with H1 count != 1", (p) => p.h1Count !== 1);
  summarize("Pages with canonical mismatch", (p) => !p.canonicalSelfMatch);
  summarize("Pages with OG url mismatch", (p) => p.ogUrl && !p.ogUrlMatchesCanonical);
  summarize("Pages with JSON-LD parse errors", (p) => p.jsonLdParseErrors.length > 0);
  summarize("Pages with AggregateRating", (p) => p.hasAggregateRating);
  summarize("Pages not in sitemap", (p) => !p.inSitemap);
  summarize("Pages with broken internal links", (p) => p.brokenInternalLinks.length > 0);
  summarize("Pages with stale-slug links", (p) => p.staleRedirectSourceLinks.length > 0);
  summarize("Pages with .html links", (p) => p.htmlExtensionLinks.length > 0);
  summarize("Pages with preview/localhost links", (p) => p.previewOrLocalhostLinks.length > 0);
  summarize("Pages with broken local assets", (p) => p.brokenLocalAssets.length > 0);
  summarize("Pages missing phone link", (p) => !p.hasPhoneLink);
  summarize("Pages missing WhatsApp link", (p) => !p.hasWhatsAppLink);
  summarize("Pages with stale company name", (p) => p.hasStaleCompanyName);
  summarize("Pages with nationwide claim", (p) => p.hasNationwideClaim);
  summarize("Pages with unsupported arrival-time claim", (p) => p.hasUnsupportedArrivalTimeClaim);
  summarize("Pages with unsupported price claim", (p) => p.hasUnsupportedPriceClaim);
  summarize("Pages with placeholder text", (p) => p.hasPlaceholderText);
  summarize("Pages with Devanagari text", (p) => p.hasDevanagariText);
  summarize("Pages with American spelling (excl. Michelin URL)", (p) => p.hasAmericanSpelling && !p.americanSpellingIsUrlException);
  summarize("Orphan pages", (p) => p.isOrphan);
  summarize("Non-200 status", (p) => p.httpStatus !== 200);

  server.close();
  console.log("\nWritten: PRELAUNCH_PAGE_AUDIT.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
