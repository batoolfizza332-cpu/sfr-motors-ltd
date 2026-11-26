// PPC landing-page request (17 Nov 2026, release Thu 26 Nov): the puncture message first on /mobile-tyre-repair/,
// plus the owner-confirmed spare-wheel / customer's own tyres line (owner, 17 Nov 2026). The banner position on short
// phones is checked in scripts/browser-tests/test-banner.js.
//   node --test scripts/tests/ppc-landing.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "site", "mobile-tyre-repair.html"), "utf8");
const hero = (html.match(/<section class="sfr-page-hero"[\s\S]*?<\/section>/) || [""])[0];
const text = (s) => s.replace(/<[^>]+>/g, " ").replace(/&ndash;/g, "–").replace(/\s+/g, " ").trim();

test("the hero leads with the puncture message, the true 40–60 minute line and Call + WhatsApp", () => {
  assert.match(text(hero), /Puncture or Flat Tyre\?/);
  assert.match(text(hero), /Usually with you in 40–60 minutes/);
  assert.match(hero, /href="tel:\+441312020289"/);
  assert.match(hero, /href="https:\/\/wa\.me\/447448427154/);
  assert.match(text(hero), /if it's safe to repair, or replace it/, "never promise that every puncture can be repaired");
});

test("H1 and title are unchanged (no SEO shift on the ad landing page)", () => {
  assert.match(hero, /<h1 class="sfr-page-hero__title" id="sfr-mtr-h1">Mobile Tyre Repair, At Your Location<\/h1>/);
  assert.match(html, /<title>Mobile Tyre Repair \| SFR Motors Ltd<\/title>/);
});

test("the owner-confirmed spare-wheel line appears once, with no prices or extra conditions", () => {
  const line = "We can also fit your spare wheel, or tyres you've bought yourself.";
  assert.equal(html.split(line).length - 1, 1);
  assert.doesNotMatch(text(html), /£\s?\d/);
});
