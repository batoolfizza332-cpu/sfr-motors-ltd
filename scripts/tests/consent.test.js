// Unit tests for cookie consent in site/assets/js/analytics.js (run unchanged in the fake browser of
// scripts/host-guard-tests.js). Owner decision: Consent Mode v2 "advanced" — GTM may load on the production host
// before a choice, but only after every consent signal is declared "denied"; Google Analytics (gtag.js) never loads
// before the visitor accepts Analytics, and never after "Reject all".
//   node --test scripts/tests/consent.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeBrowser, run } = require("../host-guard-tests");

const HOST = "sfrmotors.co.uk";
const gaLoaded = (env) => env.appendedToHead.some((s) => /googletagmanager\.com\/gtag\/js/.test(s.src || ""));
const gtmLoaded = (env) => env.appendedToHead.some((s) => /googletagmanager\.com\/gtm\.js/.test(s.src || ""));
const press = (env, choice) => env.document.body.inserted.listeners.click[0]({
  target: { closest: () => ({ hasAttribute: (a) => a === "data-sfr-consent-all", getAttribute: () => choice }) },
});

test("first visit: Google Analytics does not load before a choice", () => {
  const env = makeBrowser(HOST);
  run("analytics.js", env);
  assert.equal(gaLoaded(env), false);
  assert.ok(env.document.body.inserted, "the consent banner was not shown");
});

test("every consent signal is 'denied' before GTM can run", () => {
  const env = makeBrowser(HOST);
  run("analytics.js", env);
  const dl = env.window.dataLayer || [];
  const first = dl.findIndex((e) => e && e[0] === "consent" && e[1] === "default");
  const gtmStart = dl.findIndex((e) => e && e.event === "gtm.js");
  assert.ok(first >= 0, "no consent default in dataLayer");
  assert.deepEqual({ ...dl[first][2] }, { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (gtmStart >= 0) assert.ok(first < gtmStart, "GTM was started before the consent defaults");
  assert.equal(gtmLoaded(env), true, "Consent Mode v2: GTM is expected to load on the production host");
});

test("'Reject all' keeps Google Analytics off and remembers the choice", () => {
  const env = makeBrowser(HOST);
  run("analytics.js", env);
  press(env, "denied");
  assert.equal(gaLoaded(env), false);
  assert.match(env.document.cookie, /sfr_consent=v2:analytics=denied\|ads=denied/);
});

test("a remembered 'denied' choice keeps Google Analytics off on the next visit", () => {
  const env = makeBrowser(HOST, "sfr_consent=v2:analytics=denied|ads=denied");
  run("analytics.js", env);
  assert.equal(gaLoaded(env), false);
});

test("'Accept all' loads Google Analytics only then", () => {
  const env = makeBrowser(HOST);
  run("analytics.js", env);
  assert.equal(gaLoaded(env), false);
  press(env, "granted");
  assert.equal(gaLoaded(env), true);
});

test("off the production host nothing from Google loads at all", () => {
  for (const host of ["localhost", "sfrmotors.co.uk.evil.example", "staging.sfrmotors.co.uk"]) {
    const env = makeBrowser(host, "sfr_consent=v2:analytics=granted|ads=granted");
    run("analytics.js", env);
    assert.equal(gaLoaded(env) || gtmLoaded(env), false, host);
  }
});
