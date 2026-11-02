// Tests for the pilot town pages generated from data/locations-pilot.json (owner decision 1 Nov 2026).
//   node --test scripts/tests/location-pilot.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { build, PHOTO_W } = require("../generate-location-pages");

const ROOT = path.join(__dirname, "..", "..");
const SITE = path.join(ROOT, "site");
const pages = build();
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8");
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const mainText = (html) => text((html.match(/<main id="main">([\s\S]*?)<\/main>/) || ["", ""])[1]);

test("exactly the four approved pilot towns, and the 17 existing town pages are not generated", () => {
  assert.deepEqual(pages.map((p) => p.town.town), ["Uphall", "East Calder", "Mid Calder", "Winchburgh"]);
  for (const p of pages) assert.ok(!["armadale", "whitburn", "blackburn", "livingston", "linlithgow", "fauldhouse", "broxburn"].includes(p.town.slug));
});

test("committed pages are in sync with the data (run node scripts/generate-location-pages.js)", () => {
  for (const { file, html } of pages) assert.equal(read(file), html, `site/${file} is out of date`);
});

test("one H1, unique title, description and canonical on each page", () => {
  const seen = { title: new Set(), desc: new Set(), canon: new Set() };
  for (const { file, html, town } of pages) {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, file);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/)[1];
    assert.equal(canon, `https://sfrmotors.co.uk/mobile-tyre-fitting-${town.slug}/`);
    assert.ok(title.includes(town.town) && desc.includes(town.town), file);
    assert.ok(desc.length >= 120 && desc.length <= 170, `${file} description length ${desc.length}`);
    for (const [k, v] of [["title", title], ["desc", desc], ["canon", canon]]) { assert.ok(!seen[k].has(v), `${file}: duplicate ${k}`); seen[k].add(v); }
  }
});

test("JSON-LD is valid; FAQPage questions match the visible FAQ", () => {
  for (const { file, html } of pages) {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    assert.deepEqual(blocks.map((b) => b["@type"]), ["BreadcrumbList", "Service", "FAQPage"], file);
    const visible = [...html.matchAll(/<span class="sfr-faq__q">([^<]*)<\/span>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    assert.deepEqual(blocks[2].mainEntity.map((q) => q.name), visible, file);
    assert.ok(!JSON.stringify(blocks).match(/aggregateRating|priceRange|reviewCount/), `${file}: rating/price schema`);
  }
});

test("owner rules: 40-60 minutes, no prices, no home street/postcode, no invented claims", () => {
  for (const { file, html } of pages) {
    const t = text(html);
    assert.match(t, /40 60 minutes|40–60 minutes|40-60 minutes/, `${file}: missing 40-60 minutes`);
    assert.doesNotMatch(t, /20[–-]30 min|20 to 30 min|within 30 min/i, `${file}: wrong arrival time`);
    assert.doesNotMatch(t, /£\s?\d|\bprice from\b|\bfrom £/i, `${file}: price`);
    // No full postcode and no street address anywhere (the business address is never published; verify.js also checks this).
    assert.doesNotMatch(html, /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|streetAddress/, `${file}: postcode or street address`);
    assert.doesNotMatch(t, /\b\d{2,4} (Google )?reviews\b|★|4\.9/i, `${file}: review count / rating`);
  }
});

// Owner rule (2 Nov 2026, permanent): SFR offers "wheel balancing" only. Never describe the equipment as digital, laser,
// computerised or similar, on any page or in the pilot data.
test("no unconfirmed equipment adjectives on wheel balancing anywhere on the site", () => {
  const banned = /(digital|laser|computeri[sz]ed|electronic|high-tech|state-of-the-art|precision)[\s-]+(wheel[\s-]+)?balanc/i;
  const files = fs.readdirSync(SITE).filter((f) => f.endsWith(".html")).map((f) => path.join(SITE, f)).concat(path.join(ROOT, "data", "locations-pilot.json"));
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, "utf8"), banned, `${path.relative(ROOT, f)} describes the wheel balancing equipment`);
  for (const { file, html } of pages) assert.doesNotMatch(html, /digital/i, `${file} says "digital"`);
});

test("town-specific copy is not a near-duplicate between pilot pages, and no page is thin (doorway-page guard)", () => {
  const shingles = (s, n = 5) => { const w = s.toLowerCase().split(" "); const out = new Set(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" ")); return out; };
  // Only the town-specific copy counts: the shared services/why/CTA blocks are identical on every location page by design.
  const unique = (p) => text([p.town.intro, ...p.town.scenarios.flat(), p.town.areasText, ...p.town.faqs.flat()].join(" "));
  const sim = (a, b) => { const A = shingles(a), B = shingles(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / Math.min(A.size, B.size); };
  for (let i = 0; i < pages.length; i++) for (let j = i + 1; j < pages.length; j++) {
    const s = sim(unique(pages[i]), unique(pages[j]));
    assert.ok(s < 0.6, `${pages[i].town.town} vs ${pages[j].town.town}: town copy ${Math.round(s * 100)}% similar`);
  }
  for (const p of pages) assert.ok(mainText(p.html).split(" ").length > 700, `${p.file}: thin page`);
});

test("job photos exist in every size, have real alt text, never claim a town, and keep layout stable", () => {
  for (const { file, html, town } of pages) {
    assert.equal(town.photos.length, 2, file);
    for (const ph of town.photos) {
      for (const w of PHOTO_W) for (const ext of ["avif", "webp"]) {
        const f = path.join(SITE, "assets", "img", `${ph.file}-${w}.${ext}`);
        assert.ok(fs.existsSync(f), `missing ${f}`);
        assert.ok(fs.statSync(f).size < 160 * 1024, `${ph.file}-${w}.${ext} too heavy`);
      }
      assert.ok(ph.alt.length > 40, `${ph.file}: alt too short`);
      for (const t of ["Uphall", "East Calder", "Mid Calder", "Winchburgh", "West Lothian", "Livingston", "Broxburn"]) assert.ok(!ph.alt.includes(t), `${ph.file}: alt names ${t}, but where the photo was taken is unknown`);
      assert.ok(html.includes(`src="/assets/img/${ph.file}-1200.webp"`) && /loading="lazy"/.test(html) && /width="1200"\s+height="675"/.test(html), `${file}: photo markup`);
    }
  }
});

test("every pilot page is routed, listed in the sitemap once, and links only to existing pages", () => {
  const sitemap = read("sitemap.xml");
  const yaml = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8");
  for (const { file, html, town } of pages) {
    const url = `https://sfrmotors.co.uk/mobile-tyre-fitting-${town.slug}/`;
    assert.equal(sitemap.split(`<loc>${url}</loc>`).length - 1, 1, `${url} in sitemap`);
    assert.ok(yaml.includes(`mobile-tyre-fitting-${town.slug} `) || yaml.includes(`mobile-tyre-fitting-${town.slug}'`), `${file} not in routing`);
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)/g)) {
      if (/^\/assets\//.test(href) || href === "/") continue;
      const p = href.replace(/^\//, "");
      const candidates = [p, p.replace(/\/$/, ".html"), p.replace(/\/$/, "") + ".html"];
      const alias = { "broxburn/": "broxburn.html", "mobile-tyre-puncture-repair/": "mobile-puncture-repair.html", "about-us/": "about.html", "contact-us/": "contact.html", "privacy-policy/": "privacy.html" };
      const ok = candidates.some((c) => fs.existsSync(path.join(SITE, c))) || alias[p] || /^(24-7-mobile-tyre-replacement|mobile-locking-wheel-nut-removal|van-tyre-replacement-services|trade-fleet-tyre-services|mobile-trailer-and-caravan-tyre-fitting|tyre-pressure-monitoring-system)\/$/.test(p);
      assert.ok(ok, `${file}: link ${href} has no page`);
    }
  }
});
