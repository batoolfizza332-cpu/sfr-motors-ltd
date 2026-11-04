// Pre-release tests for the GA4 event fix (c4b7a29): exact names/parameters, privacy, duplicates, consent changes.
//   node --test scripts/tests/ga4-events.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeBrowser, run } = require("../host-guard-tests");

const HOST = "sfrmotors.co.uk";
const GA_ID = "G-B9TY4GMXYT";
const press = (env, choice) => env.document.body.inserted.listeners.click[0]({
  target: { closest: () => ({ hasAttribute: (a) => a === "data-sfr-consent-all", getAttribute: () => choice }) },
});

function page({ gtmTagAlreadyLoaded = true, pathname = "/", search = "", cookie } = {}) {
  const env = makeBrowser(HOST, cookie);
  env.window.location.pathname = pathname;
  env.window.location.search = search;
  env.window.location.href = "https://" + HOST + pathname + search;
  const listeners = {};
  env.document.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  if (gtmTagAlreadyLoaded) {
    env.document.querySelector = (sel) => (/googletagmanager\.com\/gtag\/js/.test(sel) ? { src: "https://www.googletagmanager.com/gtag/js?id=GT-K4V73S4J" } : null);
  }
  run("analytics.js", env);
  const link = (href, extra = {}) => ({ getAttribute: (a) => (a === "href" ? href : null), closest: () => null, textContent: "", protocol: href.split(":")[0] + ":", hostname: "", ...extra });
  const click = (l) => (listeners.click || []).forEach((fn) => fn({ target: { closest: (s) => (s === "a" ? l : null) } }));
  const dl = () => env.window.dataLayer || [];
  const events = () => dl().filter((e) => e && e[0] === "event").map((e) => ({ name: e[1], params: { ...e[2] } }));
  return { env, listeners, link, click, dl, events };
}

test("each event fires exactly once per click, with exactly the expected parameters", () => {
  const p = page();
  press(p.env, "granted");
  const cases = [
    [p.link("tel:+441312020289"), "phone_click", ["link_location", "page_path", "page_type", "send_to"]],
    [p.link("https://wa.me/447448427154", { hostname: "wa.me" }), "whatsapp_click", ["link_location", "page_path", "page_type", "send_to"]],
    [p.link("/contact-us/#quote-form", { textContent: "  Get a free quote  " }), "cta_click", ["link_location", "link_text", "page_path", "page_type", "send_to"]],
  ];
  for (const [l, name, keys] of cases) {
    const before = p.events().length;
    p.click(l);
    const added = p.events().slice(before);
    assert.equal(added.length, 1, `${name}: expected 1 event, got ${added.length}`);
    assert.equal(added[0].name, name);
    assert.deepEqual(Object.keys(added[0].params).sort(), keys, `${name} parameters`);
    assert.equal(added[0].params.send_to, GA_ID);
  }
  assert.equal(p.events().find((e) => e.name === "cta_click").params.link_text, "Get a free quote");
});

test("quote submit sends quote_request once and carries no form content", () => {
  const p = page();
  press(p.env, "granted");
  (p.listeners["sfr:quote-submitted"] || []).forEach((fn) => fn({ detail: { name: "Test Person", phone: "07000000000" } }));
  const q = p.events().filter((e) => e.name === "quote_request");
  assert.equal(q.length, 1);
  assert.deepEqual(Object.keys(q[0].params).sort(), ["page_path", "page_type", "send_to"]);
});

test("privacy: no phone number, WhatsApp text, query string or full URL in any event", () => {
  const p = page({ pathname: "/contact-us/", search: "?name=Jane+Doe&email=jane%40example.com&postcode=EH1+1AA&gclid=abc" });
  press(p.env, "granted");
  p.click(p.link("tel:+447000000000"));
  p.click(p.link("https://wa.me/447000000000?text=My%20name%20is%20Jane%20EH1%201AA", { hostname: "wa.me" }));
  (p.listeners["sfr:quote-submitted"] || []).forEach((fn) => fn({}));
  const all = JSON.stringify(p.events());
  for (const bad of ["7000000000", "Jane", "jane", "EH1", "example.com", "gclid", "?", "wa.me", "tel:"]) {
    assert.ok(!all.includes(bad), `event data contains "${bad}": ${all}`);
  }
  assert.ok(p.events().every((e) => e.params.page_path === "/contact-us/"));
});

test("pressing Accept twice (or re-saving settings) does not double the listeners", () => {
  const p = page();
  press(p.env, "granted");
  press(p.env, "granted");
  p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().filter((e) => e.name === "phone_click").length, 1);
  assert.equal((p.listeners.click || []).length, 1, "click listener attached more than once");
});

test("GTM's Google tag already present: the page sends no second GA config / page_view", () => {
  const p = page({ gtmTagAlreadyLoaded: true });
  press(p.env, "granted");
  const configs = p.dl().filter((e) => e && e[0] === "config" && e[1] === GA_ID);
  assert.equal(configs.length, 0, "page sent its own GA4 config while GTM's tag already sends page_view");
  assert.equal(p.events().filter((e) => e.name === "page_view").length, 0);
});

test("no GTM tag yet: exactly one GA config (one automatic page_view)", () => {
  const p = page({ gtmTagAlreadyLoaded: false });
  press(p.env, "granted");
  assert.equal(p.dl().filter((e) => e && e[0] === "config" && e[1] === GA_ID).length, 1);
});

test("returning visitor who already accepted: events work on page load without pressing anything", () => {
  const p = page({ cookie: "sfr_consent=v2:analytics=granted|ads=granted" });
  p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().filter((e) => e.name === "phone_click").length, 1);
});

test("Analytics only (Ads refused): GA4 events still sent; Ads refused stays refused", () => {
  const p = page({ cookie: "sfr_consent=v2:analytics=granted|ads=denied" });
  p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().filter((e) => e.name === "phone_click").length, 1);
  const adsGranted = p.dl().some((e) => e && e[0] === "consent" && e[1] === "update" && e[2] && e[2].ad_storage === "granted");
  assert.equal(adsGranted, false);
});

test("Ads only (Analytics refused): no GA4 event", () => {
  const p = page({ cookie: "sfr_consent=v2:analytics=denied|ads=granted" });
  p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().length, 0);
});

test("rapid taps: one event per real tap (no throttle) — documents current behaviour", () => {
  const p = page();
  press(p.env, "granted");
  for (let i = 0; i < 5; i++) p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().filter((e) => e.name === "phone_click").length, 5);
});

// page_type segments GA4 reports. Live pages are served on pretty paths (/mobile-tyre-fitting-uphall/), so the
// location list must match those as well as the .html file names (until 4 Nov every location page reported "core").
test("page_type: location pages (incl. the 4 pilot towns) are 'location' on pretty, no-slash and .html paths", () => {
  const towns = ["uphall", "east-calder", "mid-calder", "winchburgh", "bathgate", "edinburgh"];
  for (const t of towns) {
    for (const pathname of [`/mobile-tyre-fitting-${t}/`, `/mobile-tyre-fitting-${t}`, `/mobile-tyre-fitting-${t}.html`]) {
      const p = page({ pathname });
      press(p.env, "granted");
      p.click(p.link("tel:+441312020289"));
      assert.equal(p.events().find((e) => e.name === "phone_click").params.page_type, "location", pathname);
    }
  }
});

test("page_type: home, contact and service pages keep their old values", () => {
  const cases = [["/", "core"], ["/contact-us/", "core"], ["/mobile-tyre-fitting/", "service"], ["/mobile-tyre-replacement.html", "service"], ["/blog/", "core"]];
  for (const [pathname, want] of cases) {
    const p = page({ pathname });
    press(p.env, "granted");
    p.click(p.link("tel:+441312020289"));
    assert.equal(p.events().find((e) => e.name === "phone_click").params.page_type, want, pathname);
  }
});

test("a gtag error inside the click handler does not break later clicks", () => {
  const p = page();
  press(p.env, "granted");
  const real = p.env.window.gtag;
  p.env.window.gtag = () => { throw new Error("blocked"); };
  assert.throws(() => p.click(p.link("tel:+441312020289")));
  p.env.window.gtag = real;
  p.click(p.link("tel:+441312020289"));
  assert.equal(p.events().filter((e) => e.name === "phone_click").length, 1);
});
