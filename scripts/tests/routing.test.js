// Unit tests for the URL rules in infra/template.yaml (read through scripts/routing.js), on both hosts that
// serve them: the CloudFront-style edge function (local preview) and the generated Hostinger .htaccess.
//   npm run build && node --test scripts/tests/routing.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadRouting, routeTable } = require("../routing");
const { buildHtaccess, simulateApache } = require("../htaccess-config");

const DIST = path.join(__dirname, "..", "..", "dist");
const HOST = "sfrmotors.co.uk";
const { edgeFunction, legacy } = loadRouting();
const { redirects, prettyPaths } = routeTable();
const production = buildHtaccess("production");

const isFile = (p) => { try { return fs.statSync(path.join(DIST, p)).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(path.join(DIST, p)).isDirectory(); } catch { return false; } };
const edge = (uri) => edgeFunction({ request: { uri, method: "GET", headers: { host: { value: HOST } }, querystring: {}, cookies: {} } });
const apache = (uri) => simulateApache(production, { host: HOST, https: true, uri, query: "" }, { hasFile: isFile, isDir });

test("clean URLs open the right .html file (edge function and .htaccess)", () => {
  assert.ok(prettyPaths.length > 100);
  for (const p of prettyPaths) {
    const out = edge(p);
    assert.ok(!out.statusCode, `${p} redirected on the edge`);
    assert.ok(isFile(out.uri.replace(/^\//, "")), `${p} -> ${out.uri} is not a built file`);
    const a = apache(p);
    assert.ok(a.file && isFile(a.file.slice(1)), `${p} not served by .htaccess (${JSON.stringify(a)})`);
    assert.equal(a.file, out.uri, `${p}: edge and .htaccess serve different files`);
  }
});

test("old WordPress links 301 in one hop to a URL that answers 200", () => {
  assert.ok(Object.keys(legacy).length > 0);
  for (const [from, to] of Object.entries(legacy)) {
    for (const src of [from, `${from}/`]) {
      const out = edge(src);
      assert.equal(out.statusCode, 301, `${src} on the edge`);
      assert.equal(new URL(out.headers.location.value, `https://${HOST}`).pathname, to, `${src} on the edge`);
      assert.equal(apache(src).redirect, `https://${HOST}${to}`, `${src} in .htaccess`);
      const final = edge(to);
      assert.ok(!final.statusCode, `${to} (target of ${src}) redirects again: two hops`);
    }
  }
});

test(".html URLs go to the slash URL, and /index.html goes to /", () => {
  const htmlRedirects = redirects.filter((r) => r.source.endsWith(".html"));
  assert.ok(htmlRedirects.length > 70);
  for (const { source, destination } of htmlRedirects) {
    const out = edge(source);
    assert.equal(out.statusCode, 301, source);
    assert.equal(new URL(out.headers.location.value, `https://${HOST}`).pathname, destination, source);
    assert.equal(apache(source).redirect, `https://${HOST}${destination}`, `${source} in .htaccess`);
  }
});
