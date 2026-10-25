// Tests for the production .htaccess (node:test, no dependencies): sensitive files that could end up in the document
// root by accident (a Git deploy, a backup, a stray script) must never be served, while every real page, redirect and
// crawler file keeps working. Requests run through simulateApache() against the built dist/ plus a set of sensitive
// files pretended to exist on the server, so a missing rule shows up as a 200.
//   npm run build && node --test scripts/htaccess-block.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildHtaccess, simulateApache } = require("./htaccess-config");
const { loadRouting } = require("./routing");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const HOST = "sfrmotors.co.uk";
const production = buildHtaccess("production");

// Files and folders as they appeared in public_html after the 23 Oct 2026 Git deploy, plus other common leaks.
const LEAKED_FILES = [
  ".git/config", ".git/HEAD", ".env", ".gitignore", ".claude/launch.json", ".github/workflows/deploy-hostinger.yml",
  "README.md", "CLAUDE.md", "PROJECT-HANDOVER.md", "pending-blog-posts/README.md",
  "package.json", "package-lock.json", "scripts/verify.js", "node_modules/x/index.js", "infra/template.yaml",
  "site/index.html", "image-originals/hero.jpg",
  "dump.sql", "backup.gz", "site.tar.gz", "oct backup.wpress", "error.log", "index.html.bak",
];
const LEAKED_DIRS = [".git", ".claude", ".github", "scripts", "node_modules", "infra", "site", "pending-blog-posts", "image-originals"];

const distHas = (p) => { try { return fs.statSync(path.join(DIST, p)).isFile(); } catch { return false; } };
const distDir = (p) => { try { return fs.statSync(path.join(DIST, p)).isDirectory(); } catch { return false; } };
const fsInfo = {
  hasFile: (p) => LEAKED_FILES.includes(p) || distHas(p),
  isDir: (p) => LEAKED_DIRS.includes(p.replace(/\/$/, "")) || distDir(p.replace(/\/$/, "")),
};

// Apache URL-decodes the path, resolves "." / ".." segments and merges repeated slashes before mod_rewrite sees it
// in per-directory context.
function request(uri, query = "") {
  const normalised = path.posix.normalize(decodeURIComponent(uri).replace(/\/{2,}/g, "/"));
  return simulateApache(production, { host: HOST, https: true, uri: normalised, query }, fsInfo);
}
const status = (r) => (r.redirect ? 301 : r.file ? 200 : r.forbidden ? 403 : 404);

test("sensitive files and folders are never served (403 or 404)", () => {
  const urls = [
    "/.git/", "/.git/config", "/.git/HEAD", "/.env", "/.gitignore", "/.claude/launch.json", "/.github/workflows/deploy-hostinger.yml",
    "/README.md", "/CLAUDE.md", "/PROJECT-HANDOVER.md", "/pending-blog-posts/README.md",
    "/package.json", "/package-lock.json", "/scripts/", "/scripts/verify.js", "/node_modules/", "/node_modules/x/index.js",
    "/infra/template.yaml", "/site/index.html", "/image-originals/hero.jpg",
    "/dump.sql", "/backup.gz", "/site.tar.gz", "/oct%20backup.wpress", "/error.log", "/index.html.bak",
  ];
  for (const url of urls) {
    const s = status(request(url));
    assert.ok(s === 403 || s === 404, `${url} returned ${s}`);
  }
});

test("bypass attempts are blocked too (encoding, case, double slashes)", () => {
  for (const url of ["/%2egit/config", "/%2Egit/HEAD", "//.git/config", "/.GIT/config", "/README.MD", "/Package.json", "/DUMP.SQL", "/scripts//verify.js", "/x/../.env"]) {
    const s = status(request(url));
    assert.ok(s === 403 || s === 404, `${url} returned ${s}`);
  }
});

test("every sitemap page still returns 200", () => {
  const xml = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
  const urls = [...xml.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.equal(urls.length, 78);
  for (const url of urls) assert.equal(status(request(url)), 200, url);
});

test("legacy and .html redirects still return a single 301", () => {
  const { legacy } = loadRouting();
  for (const [from, to] of Object.entries(legacy)) {
    const r = request(from);
    assert.equal(r.redirect, `https://${HOST}${to}`, from);
  }
  assert.equal(request("/about.html").redirect, `https://${HOST}/about-us/`);
  assert.equal(request("/index.html").redirect, `https://${HOST}/`);
});

test("robots.txt, sitemap.xml, favicon and assets still return 200", () => {
  for (const url of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/"]) assert.equal(status(request(url)), 200, url);
  const css = fs.readdirSync(path.join(DIST, "assets", "css"))[0];
  assert.equal(status(request(`/assets/css/${css}`)), 200);
});

test("the ACME challenge path (.well-known) is not blocked", () => {
  const r = simulateApache(production, { host: HOST, https: true, uri: "/.well-known/acme-challenge/abc", query: "" },
    { hasFile: (p) => p === ".well-known/acme-challenge/abc", isDir: () => false });
  assert.equal(status(r), 200);
});

test("no noindex anywhere in the production rules or the pages", () => {
  assert.ok(!/^\s*Header\b.*(X-Robots-Tag|noindex)/im.test(production), "production .htaccess sends noindex");
  for (const f of fs.readdirSync(DIST).filter((n) => n.endsWith(".html") && n !== "404.html")) {
    assert.ok(!/<meta name="robots" content="[^"]*noindex/i.test(fs.readFileSync(path.join(DIST, f), "utf8")), f);
  }
});
