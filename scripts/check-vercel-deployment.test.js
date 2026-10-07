#!/usr/bin/env node
// Mock tests for scripts/check-vercel-deployment.js. No network: the checker is given a fake fetch, so nothing is sent to Vercel.
// Run by `npm run verify` (check 21) and alone:  node scripts/check-vercel-deployment.test.js

"use strict";

const { buildConfig } = require("./vercel-config");
const { checkDeployment, FIXED_PATHS, PROTECTED_MESSAGE } = require("./check-vercel-deployment");

const URL_OK = "https://mock-preview.vercel.app";
const expected = buildConfig().headers.find((rule) => rule.source === "/(.*)").headers;
const CSS = "assets/css/main.abc12345.css";
const HOME_HTML = `<!doctype html><link rel=stylesheet href=${CSS}><h1>Home</h1>`;

const goodHeaders = (mutate) => {
  const h = Object.fromEntries(expected.map((x) => [x.key, x.value]));
  if (mutate) mutate(h);
  return h;
};
const respond = (path, headers) => new Response(path === "/" ? HOME_HTML : "x", { status: path === "/does-not-exist/" ? 404 : 200, headers });
function mock(handler) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return handler(new URL(url).pathname, opts); };
  fn.calls = calls;
  return fn;
}
const redirectTo = (location) => new Response(null, { status: 302, headers: { location, "x-robots-tag": "noindex", "strict-transport-security": "max-age=63072000", "x-frame-options": "DENY" } });

async function runAll() {
  const failures = [];
  const t = (ok, msg) => { if (!ok) failures.push(msg); };

  // a) every required header present -> ok, ten GET requests, redirects not followed, nothing extra sent
  {
    const f = mock((p) => respond(p, goodHeaders()));
    const r = await checkDeployment(URL_OK, { fetchFn: f });
    t(r.outcome === "ok" && r.problems.length === 0, `a) all headers present should pass (got ${r.outcome}: ${r.problems.join("; ")})`);
    t(JSON.stringify(r.urls) === JSON.stringify([...FIXED_PATHS, "/" + CSS]) && r.urls.length === 10, "a) exactly the ten approved URLs must be checked");
    t(f.calls.length === 10 && f.calls.every((c) => c.opts.method === "GET" && c.opts.redirect === "manual"), "a) every request must be a GET with redirects NOT followed");
    t(f.calls.every((c) => Object.keys(c.opts.headers).every((k) => k.toLowerCase() === "accept-encoding")), "a) no cookie, token or other header may be sent");
    t(r.checks === 10 * expected.length, "a) every header must be compared on every URL");
    t(expected.some((h) => h.key === "X-Robots-Tag" && h.value === "noindex, nofollow"), "a) the expected headers must include X-Robots-Tag: noindex, nofollow");
  }

  // b) missing / weakened noindex, or another header wrong -> failed
  for (const [label, mutate, needle] of [
    ["missing noindex", (h) => { delete h["X-Robots-Tag"]; }, /X-Robots-Tag is MISSING/],
    ["weakened noindex", (h) => { h["X-Robots-Tag"] = "noindex"; }, /X-Robots-Tag is "noindex"/],
    ["different CSP", (h) => { h["Content-Security-Policy"] = "default-src *"; }, /Content-Security-Policy is "default-src \*"/],
    ["missing HSTS", (h) => { delete h["Strict-Transport-Security"]; }, /Strict-Transport-Security is MISSING/],
  ]) {
    const r = await checkDeployment(URL_OK, { fetchFn: mock((p) => respond(p, goodHeaders(mutate))) });
    t(r.outcome === "failed" && r.problems.some((p) => needle.test(p)), `b) ${label} must fail (got ${r.outcome})`);
  }

  // c) Vercel Authentication (login redirect) or 401 -> "protected", never a pass and never a header failure
  for (const [label, response] of [
    ["login redirect", () => redirectTo("https://vercel.com/sso-api?url=https%3A%2F%2Fmock-preview.vercel.app%2F&nonce=abc")],
    ["login redirect (relative to vercel.com host)", () => redirectTo("https://vercel.com/login?next=/x")],
    ["401", () => new Response("Authentication Required", { status: 401 })],
  ]) {
    const f = mock(() => response());
    const r = await checkDeployment(URL_OK, { fetchFn: f });
    t(r.outcome === "protected" && r.message === PROTECTED_MESSAGE && r.message === "Deployment is protected; application headers remain unverified.", `c) ${label} must report "protected; application headers remain unverified" (got ${r.outcome})`);
    t(r.problems.length === 0 && r.checks === 0, `c) ${label} must not count as a header pass or failure`);
    t(f.calls.length === 1 && f.calls[0].opts.redirect === "manual", `c) ${label}: the login redirect must not be followed and no further URL may be requested`);
  }
  {
    const r = await checkDeployment(URL_OK, { fetchFn: mock((p) => (p === "/contact-us/" ? redirectTo("https://vercel.com/sso-api?x=1") : respond(p, goodHeaders()))) });
    t(r.outcome === "protected", `c) protection appearing on a later URL must still report protected (got ${r.outcome})`);
  }

  // d) anything that is not an https *.vercel.app review copy is refused before any request
  for (const bad of ["https://sfrmotors.co.uk", "https://www.sfrmotors.co.uk", "https://example.com", "http://mock-preview.vercel.app", "https://vercel.app", "https://evilvercel.app",
    "https://mock-preview.vercel.app.evil.example", "https://user:secret@mock-preview.vercel.app", "https://mock-preview.vercel.app:8443", "not a url", ""]) {
    const f = mock(() => respond("/", goodHeaders()));
    const r = await checkDeployment(bad, { fetchFn: f });
    t(r.outcome === "refused" && f.calls.length === 0, `d) "${bad}" must be refused without any request (got ${r.outcome}, ${f.calls.length} requests)`);
  }

  // e) unexpected responses are failures, not passes
  {
    const r = await checkDeployment(URL_OK, { fetchFn: mock((p) => (p === "/about-us/" ? new Response(null, { status: 302, headers: { location: "/elsewhere" } }) : respond(p, goodHeaders()))) });
    t(r.outcome === "failed" && r.problems.some((p) => /\/about-us\/: status 302.*not followed/.test(p)), "e) an application redirect must fail and must not be followed");
    const r2 = await checkDeployment(URL_OK, { fetchFn: mock((p) => new Response(p === "/" ? HOME_HTML : "x", { status: 200, headers: goodHeaders() })) });
    t(r2.outcome === "failed" && r2.problems.some((p) => /does-not-exist.*expected 404/.test(p)), "e) a missing URL that answers 200 instead of 404 must fail");
  }
  return failures;
}

module.exports = { runAll };

if (require.main === module) {
  runAll().then((failures) => {
    if (failures.length) { failures.forEach((f) => console.error("FAIL " + f)); process.exit(1); }
    console.log("check-vercel-deployment mock tests OK (pass, missing/weakened noindex, protected, refused hosts, unexpected responses)");
  });
}
