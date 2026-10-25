// Unit tests for the WhatsApp quote form in site/assets/js/main.js, run unchanged in the fake browser of
// scripts/host-guard-tests.js on the production hostname. Nothing is sent: window.open is captured.
//   node --test scripts/tests/quote-form.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { makeBrowser, element, run } = require("../host-guard-tests");

const BASE = { name: "Test Reviewer", phone: "07700 900123", service: "Puncture repair", location: "Bathgate" };

function submit(data, { host = "sfrmotors.co.uk", fillMs = 10000 } = {}) {
  const env = makeBrowser(host);
  const form = element("form");
  const status = element("p");
  form.elements = new Proxy({}, {
    get: (_, name) => { const input = element("input"); input.name = name; input.parentNode = element("label"); return input; },
  });
  let current = { ...data };
  form.reset = () => { current = {}; };
  env.document.getElementById = (id) => (id === "quote-form-el" ? form : id === "quote-form-status" ? status : null);
  env.sandbox.FormData = function () { return { entries: () => Object.entries(current) }; };
  run("main.js", env);
  env.advance(fillMs);
  form.listeners.submit[0]({ preventDefault() {} });
  const url = env.opened.length ? String(env.opened[0][0]) : null;
  const text = url ? new URL(url).searchParams.get("text") : null;
  return { env, status, url, text, opened: env.opened.length };
}

test("a normal enquiry opens WhatsApp once with every field in the message", () => {
  const r = submit(BASE);
  assert.equal(r.opened, 1);
  assert.match(r.url, /^https:\/\/wa\.me\/447448427154\?text=/);
  for (const v of Object.values(BASE)) assert.ok(r.text.includes(v), `message lacks ${v}`);
});

test("special characters survive encoding and cannot add URL parameters", () => {
  const tricky = "O'Brien & Sons #1 <script>alert(1)</script> 100% \"quoted\" ünïcødé 🚗 ?x=1&text=hacked\nsecond line";
  const r = submit({ ...BASE, name: tricky, message: tricky });
  assert.equal(r.opened, 1);
  const u = new URL(r.url);
  assert.deepEqual([...u.searchParams.keys()], ["text"], "extra query parameters were injected");
  assert.ok(r.text.includes(tricky.trim()), "the visitor's text was altered");
  assert.equal(u.host, "wa.me");
});

test("very long text is handled without throwing", (t) => {
  const long = "A".repeat(20000);
  const r = submit({ ...BASE, message: long });
  assert.equal(r.opened, 1);
  assert.ok(r.text.includes(long));
  // Report-only observation: the URL length the browser receives (no limit is applied in main.js).
  t.diagnostic(`long message URL length: ${r.url.length}`);
});

test("empty optional fields are shown as 'Not specified'", () => {
  const r = submit(BASE);
  assert.match(r.text, /Vehicle: Not specified/);
  assert.match(r.text, /Additional Information:\nNot specified/);
});

test("empty or blank required fields block sending and explain why", () => {
  for (const field of ["name", "phone", "service", "location"]) {
    const r = submit({ ...BASE, [field]: "   " });
    assert.equal(r.opened, 0, `${field} blank still opened WhatsApp`);
    assert.equal(r.status.dataset.state, "error");
    assert.match(r.status.textContent, /Please fill in/);
  }
});

test("an invalid phone number blocks sending", () => {
  const r = submit({ ...BASE, phone: "abc" });
  assert.equal(r.opened, 0);
  assert.match(r.status.textContent, /valid phone number/);
});

test("bots (honeypot or instant submit) never open WhatsApp", () => {
  assert.equal(submit({ ...BASE, company: "spam" }).opened, 0);
  assert.equal(submit(BASE, { fillMs: 100 }).opened, 0);
});
