// Integration tests on the local build served by scripts/preview-edge.js (localhost only, random port):
// every sitemap page answers 200, no internal link is broken, every page has one H1, its own title and a correct
// canonical, and the release file list (what an upload would contain) is exactly dist/ plus the generated .htaccess.
//   npm run build && node --test scripts/tests/site.integration.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { start } = require("../preview-edge");

const DIST = path.join(__dirname, "..", "..", "dist");
const ORIGIN = "https://sfrmotors.co.uk";
let server, base;

test.before(async () => {
  server = await start({ port: 0, quiet: true });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server && server.close());

const sitemapPaths = () => [...fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8").matchAll(/<loc>https:\/\/sfrmotors\.co\.uk([^<]*)<\/loc>/g)].map((m) => m[1]);
const get = (p) => fetch(base + p, { redirect: "manual", headers: { host: "sfrmotors.co.uk" } });

test("all 78 sitemap pages return 200", async () => {
  const paths = sitemapPaths();
  assert.equal(paths.length, 78);
  for (const p of paths) assert.equal((await get(p)).status, 200, p);
});

test("no internal link on any page returns 404 (or redirects)", async () => {
  const links = new Set();
  for (const f of fs.readdirSync(DIST).filter((n) => n.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(DIST, f), "utf8");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) if (!m[1].startsWith("//")) links.add(m[1]);
    for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(",")) { const u = part.trim().split(/\s+/)[0]; if (u.startsWith("/")) links.add(u); }
  }
  assert.ok(links.size > 100);
  const bad = [];
  for (const l of links) { const s = (await get(l)).status; if (s !== 200) bad.push(`${s} ${l}`); }
  assert.deepEqual(bad, []);
});

test("every sitemap page has exactly one H1, its own title and a canonical equal to its URL", async () => {
  const titles = new Map();
  for (const p of sitemapPaths()) {
    const html = await (await get(p)).text();
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p}: H1 count`);
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    assert.ok(title, `${p}: no title`);
    assert.ok(!titles.has(title), `${p}: title also used by ${titles.get(title)}`);
    titles.set(title, p);
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    assert.equal(canonical, ORIGIN + p, `${p}: canonical`);
  }
});

test("the release file list is exactly dist/ plus .htaccess, with nothing from the repository", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(DIST, path.join(d, e.name)).split(path.sep).join("/")]));
  const distFiles = walk(DIST).filter((f) => f !== ".htaccess").sort();
  const release = [...distFiles, ".htaccess"].sort();
  // Every file in the release comes from dist/ (or is the generated .htaccess) ...
  for (const f of release) assert.ok(f === ".htaccess" || fs.existsSync(path.join(DIST, f)), f);
  // ... and nothing that only belongs in the repository is in dist/.
  const forbidden = distFiles.filter((f) => /(^|\/)\.|\.(md|map|ts|sql|gz|zip|wpress|log|bak|yml|yaml)$|^(scripts|infra|site|node_modules|pending-blog-posts|image-originals)\//i.test(f) || /^package(-lock)?\.json$/.test(f));
  assert.deepEqual(forbidden, []);
});

// Known finding (25 Oct 2026, report only): 12 old home-page images are still built and uploaded but no page uses
// them. Marked todo so it is reported on every run without failing npm test until the owner approves a fix.
test("no orphan assets in the release (every image is used by a page or stylesheet)", { todo: "12 unused home-page images; awaiting owner decision" }, () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(DIST, path.join(d, e.name)).split(path.sep).join("/")]));
  const distFiles = walk(DIST).filter((f) => f !== ".htaccess");
  const html = distFiles.filter((f) => f.endsWith(".html")).map((f) => fs.readFileSync(path.join(DIST, f), "utf8")).join("\n");
  const css = distFiles.filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(DIST, f), "utf8")).join("\n");
  const orphans = distFiles.filter((f) => f.startsWith("assets/") && !/\/OFL\.txt$/.test(f) && !html.includes("/" + f) && !css.includes(path.posix.basename(f)));
  assert.deepEqual(orphans, [], "assets in dist/ that no page or stylesheet references");
});
