#!/usr/bin/env node
// Read-only daily drift check: compares the LIVE https://sfrmotors.co.uk with the dist/ this repository builds.
//
//   npm run build && node scripts/live-compare.js            (npm run check:live; the daily-seo workflow runs it)
//   node scripts/live-compare.js --base https://sfrmotors.co.uk
//
// Checks (any difference -> exit code 1, so the GitHub Actions job fails):
//   1. robots.txt is identical.
//   2. sitemap.xml lists exactly the same URLs.
//   3. Every sitemap page answers 200 directly (no redirect) and has the same title, meta description, canonical,
//      meta robots, H1, JSON-LD @types and <main> text as the repo build. No page may be noindex.
//   4. Every 301 in vercel.json answers 301 with the same destination; every pretty path in vercel.json answers 200.
//   5. The homepage carries the production security headers of the generated Hostinger .htaccess and no X-Robots-Tag.
//   6. www -> apex is a single 301; an unknown URL is a real 404.
//
// Only plain GET requests, no cookies, no secrets; nothing is changed anywhere. Zero dependencies (Node 18+ fetch).

"use strict";

const fs = require("fs");
const path = require("path");
const { buildHtaccess } = require("./htaccess-config");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const argBase = process.argv.indexOf("--base");
const BASE = (argBase === -1 ? "https://sfrmotors.co.uk" : process.argv[argBase + 1]).replace(/\/$/, "");
const CANONICAL_ORIGIN = "https://sfrmotors.co.uk";
const CONCURRENCY = 6;
const UA = "Mozilla/5.0 (compatible; SFR-daily-seo-check; +https://github.com/batoolfizza332-cpu/sfr-motors-ltd)";

const problems = [];
const fail = (msg) => problems.push(msg);

// ---------- HTML field extraction (works on minified HTML with or without quoted attributes) ----------

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g)) {
    out[m[1].toLowerCase()] = m[2] ? decode(m[2].replace(/^["']|["']$/g, "")) : "";
  }
  return out;
}

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => attrs(m[1]));
const text = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function pageInfo(html) {
  const meta = (n) => (tags(html, "meta").find((a) => (a.name || "").toLowerCase() === n) || {}).content ?? null;
  const link = tags(html, "link").find((a) => (a.rel || "").toLowerCase() === "canonical");
  const noScripts = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, "");
  const main = noScripts.match(/<main\b[^>]*>([\s\S]*)<\/main>/i);
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const ld = new Set();
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) ld.add(t[1]);
  }
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  return {
    title: title ? text(title[1]) : null,
    description: meta("description"),
    canonical: link ? link.href : null,
    robots: meta("robots"),
    h1: h1 ? text(h1[1]) : null,
    jsonLdTypes: [...ld].sort().join(", "),
    mainText: main ? text(main[1]) : "",
  };
}

const sitemapUrls = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).sort();
const normalise = (s) => s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
const toLive = (url) => BASE + url.slice(CANONICAL_ORIGIN.length);

// ---------- HTTP ----------

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      return { status: res.status, location: res.headers.get("location"), headers: res.headers, body: await res.text() };
    } catch (err) {
      if (i >= tries) return { status: 0, error: String(err && err.cause ? err.cause : err), headers: new Headers(), body: "" };
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function pool(items, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

const shown = (r) => (r.status === 0 ? `network error (${r.error})` : `${r.status}${r.location ? " -> " + r.location : ""}`);
const clip = (s, n = 160) => (s == null ? "(missing)" : s.length > n ? s.slice(0, n) + "..." : s);

// ---------- checks ----------

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("dist/ is missing. Run `npm run build` (or `npm run verify`) first.");
    process.exit(2);
  }
  console.log(`Comparing ${BASE} with ${path.relative(ROOT, DIST)}/\n`);

  // Repo pages, keyed by canonical URL.
  const repo = new Map();
  for (const f of fs.readdirSync(DIST).filter((f) => f.endsWith(".html"))) {
    const info = pageInfo(fs.readFileSync(path.join(DIST, f), "utf8"));
    if (info.canonical) repo.set(info.canonical, { file: f, ...info });
  }

  // 1. robots.txt
  const robots = await get(`${BASE}/robots.txt`);
  if (robots.status !== 200) fail(`robots.txt: expected 200, got ${shown(robots)}`);
  else if (normalise(robots.body) !== normalise(fs.readFileSync(path.join(DIST, "robots.txt"), "utf8"))) {
    fail("robots.txt: live file differs from the repo");
  }

  // 2. sitemap.xml
  const repoUrls = sitemapUrls(fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8"));
  const sm = await get(`${BASE}/sitemap.xml`);
  if (sm.status !== 200) fail(`sitemap.xml: expected 200, got ${shown(sm)}`);
  else {
    const liveUrls = new Set(sitemapUrls(sm.body));
    const repoSet = new Set(repoUrls);
    for (const u of repoUrls) if (!liveUrls.has(u)) fail(`sitemap.xml: ${u} is in the repo but not live`);
    for (const u of liveUrls) if (!repoSet.has(u)) fail(`sitemap.xml: ${u} is live but not in the repo`);
  }

  // 3. every sitemap page
  await pool(repoUrls, async (url) => {
    const r = repo.get(url);
    if (!r) return fail(`${url}: no page in dist/ has this canonical URL`);
    const res = await get(toLive(url));
    if (res.status !== 200) return fail(`${url}: expected 200, got ${shown(res)}`);
    const live = pageInfo(res.body);
    if (/noindex/i.test(live.robots || "") || /noindex/i.test(res.headers.get("x-robots-tag") || "")) {
      fail(`${url}: live page is NOINDEX`);
    }
    for (const k of ["title", "description", "canonical", "robots", "h1", "jsonLdTypes"]) {
      if (live[k] !== r[k]) fail(`${url}: ${k} differs\n      live: ${clip(live[k])}\n      repo: ${clip(r[k])}  (${r.file})`);
    }
    if (live.mainText !== r.mainText) {
      const n = (s) => s.split(" ").length;
      fail(`${url}: page text differs (live ${n(live.mainText)} words, repo ${n(r.mainText)} words, ${r.file})`);
    }
  });

  // 4. redirects and pretty paths from vercel.json (generated from infra/template.yaml, same rules as the .htaccess)
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  await pool(vercel.redirects, async ({ source, destination, statusCode }) => {
    const res = await get(BASE + source);
    const want = new URL(destination, CANONICAL_ORIGIN + "/").href;
    const got = res.location ? new URL(res.location, BASE + source).href.replace(BASE, CANONICAL_ORIGIN) : null;
    if (res.status !== (statusCode || 308) || got !== want) {
      fail(`redirect ${source}: expected ${statusCode} -> ${want}, got ${shown(res)}`);
    }
  });
  await pool(vercel.rewrites.map((r) => r.source), async (source) => {
    const res = await get(BASE + source);
    if (res.status !== 200) fail(`pretty URL ${source}: expected 200, got ${shown(res)}`);
  });

  // 5. security headers (production profile of the generated Hostinger .htaccess)
  const expected = [...buildHtaccess("production").matchAll(/^\s*Header always set (\S+) "(.*)"$/gm)].map((m) => [m[1], m[2]]);
  const home = await get(`${BASE}/`);
  if (home.status !== 200) fail(`/: expected 200, got ${shown(home)}`);
  for (const [name, value] of expected) {
    const got = home.headers.get(name);
    if (got !== value) fail(`header ${name}: expected "${clip(value, 80)}", got "${clip(got, 80)}"`);
  }
  if (home.headers.get("x-robots-tag")) fail(`header X-Robots-Tag must not be sent on live, got "${home.headers.get("x-robots-tag")}"`);

  // 6. www -> apex and a real 404
  if (BASE === CANONICAL_ORIGIN) {
    const www = await get("https://www.sfrmotors.co.uk/about-us/");
    if (www.status !== 301 || www.location !== `${CANONICAL_ORIGIN}/about-us/`) fail(`www -> apex: expected 301 -> ${CANONICAL_ORIGIN}/about-us/, got ${shown(www)}`);
  }
  const missing = await get(`${BASE}/daily-seo-check-should-not-exist-${Date.now()}/`);
  if (missing.status !== 404) fail(`unknown URL: expected 404, got ${shown(missing)}`);

  // ---------- report ----------
  const checked = `${repoUrls.length} pages, ${vercel.redirects.length} redirects, ${vercel.rewrites.length} pretty URLs`;
  const lines = problems.length
    ? [`LIVE SITE CHECK: FAILED (${problems.length} difference${problems.length === 1 ? "" : "s"}; checked ${checked})`, "", ...problems.map((p) => `- ${p}`)]
    : [`LIVE SITE CHECK: PASSED (live matches the repo; checked ${checked})`];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Daily SEO: live site vs repo\n\n${lines.join("\n")}\n`);
  }
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
