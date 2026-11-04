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

// --- GA4 click events (bug found live on 28 Oct 2026: none of these reached GA4) ---------------------------
// The page's own gtag("event", ...) calls only reach GA4 when they name it with send_to, and they must also work
// when GTM's Google tag (gtag/js?id=GT-...) is already on the page before the visitor presses "Accept all".
const GA_ID = "G-B9TY4GMXYT";
function acceptedPage({ gtmTagAlreadyLoaded }) {
  const env = makeBrowser(HOST);
  const docListeners = {};
  env.document.addEventListener = (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); };
  if (gtmTagAlreadyLoaded) {
    env.document.querySelector = (sel) => (/googletagmanager\.com\/gtag\/js/.test(sel) ? { src: "https://www.googletagmanager.com/gtag/js?id=GT-K4V73S4J" } : null);
  }
  run("analytics.js", env);
  press(env, "granted");
  const fakeLink = (href, extra = {}) => ({ getAttribute: (a) => (a === "href" ? href : null), closest: () => null, textContent: "Get a quote", protocol: "https:", hostname: "", ...extra });
  const click = (link) => (docListeners.click || []).forEach((fn) => fn({ target: { closest: (s) => (s === "a" ? link : null) } }));
  const events = () => (env.window.dataLayer || []).filter((e) => e && e[0] === "event").map((e) => ({ name: e[1], params: { ...e[2] } }));
  return { env, docListeners, click, fakeLink, events };
}

for (const gtmTagAlreadyLoaded of [false, true]) {
  const when = gtmTagAlreadyLoaded ? "GTM's Google tag already on the page" : "no other Google tag yet";
  test(`after 'Accept all' (${when}) phone, WhatsApp and quote clicks are sent to GA4 by name`, () => {
    const p = acceptedPage({ gtmTagAlreadyLoaded });
    p.click(p.fakeLink("tel:+441312020289"));
    p.click(p.fakeLink("https://wa.me/447448427154", { hostname: "wa.me" }));
    p.click(p.fakeLink("/contact-us/#quote-form"));
    const ev = p.events();
    for (const name of ["phone_click", "whatsapp_click", "cta_click"]) {
      const e = ev.find((x) => x.name === name);
      assert.ok(e, `${name} was not sent (${when})`);
      assert.equal(e.params.send_to, GA_ID, `${name} has no send_to ${GA_ID}`);
      assert.equal(e.params.link_location, "page_content");
    }
    for (const fn of p.docListeners["sfr:quote-submitted"] || []) fn({});
    assert.ok(p.events().some((x) => x.name === "quote_request" && x.params.send_to === GA_ID), "quote_request was not sent");
  });
}

test("no GA4 click event is sent before 'Accept all' or after 'Reject all'", () => {
  for (const choice of [null, "denied"]) {
    const env = makeBrowser(HOST);
    const docListeners = {};
    env.document.addEventListener = (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); };
    run("analytics.js", env);
    if (choice) press(env, choice);
    const link = { getAttribute: () => "tel:+441312020289", closest: () => null, textContent: "", protocol: "tel:", hostname: "" };
    (docListeners.click || []).forEach((fn) => fn({ target: { closest: (s) => (s === "a" ? link : null) } }));
    assert.equal((env.window.dataLayer || []).filter((e) => e && e[0] === "event").length, 0, `events sent with choice ${choice}`);
  }
});

test("off the production host nothing from Google loads at all", () => {
  for (const host of ["localhost", "sfrmotors.co.uk.evil.example", "staging.sfrmotors.co.uk"]) {
    const env = makeBrowser(host, "sfr_consent=v2:analytics=granted|ads=granted");
    run("analytics.js", env);
    assert.equal(gaLoaded(env) || gtmLoaded(env), false, host);
  }
});
