// Unit tests for scripts/htaccess-config.js profiles: the production file is the live one, so it must say so,
// never send noindex, and route every page listed in the sitemap.
//   npm run build && node --test scripts/tests/htaccess-generator.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildHtaccess, simulateApache, PROFILES } = require("../htaccess-config");

const DIST = path.join(__dirname, "..", "..", "dist");
const HOST = "sfrmotors.co.uk";
const isFile = (p) => { try { return fs.statSync(path.join(DIST, p)).isFile(); } catch { return false; } };

test("production profile is labelled and has the production HSTS", () => {
  const ht = buildHtaccess("production");
  assert.equal(ht.split("\n")[2], "# Profile: production");
  assert.match(ht, /Header always set Strict-Transport-Security "max-age=31536000"/);
});

test("production never sends noindex; staging always does", () => {
  assert.doesNotMatch(buildHtaccess("production"), /^\s*Header\b.*(X-Robots-Tag|noindex)/im);
  assert.match(buildHtaccess("staging"), /Header always set X-Robots-Tag "noindex, nofollow"/);
});

test("unknown profiles are rejected", () => {
  assert.deepEqual(PROFILES, ["staging", "production"]);
  assert.throws(() => buildHtaccess("live"), /Unknown profile/);
});

test("every sitemap page is served by the production rules", () => {
  const ht = buildHtaccess("production");
  const xml = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
  const urls = [...xml.matchAll(/<loc>https:\/\/sfrmotors\.co\.uk([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.equal(urls.length, 78);
  for (const u of urls) {
    const r = simulateApache(ht, { host: HOST, https: true, uri: u, query: "" }, { hasFile: isFile, isDir: () => false });
    assert.ok(r.file, `${u} -> ${JSON.stringify(r)}`);
  }
});
