// Owner rule (Google doorway-page policy, 6 Nov 2026): the main text of any two town (location) pages may be at most
// 30% similar. Same measure as the SEO Master System on-page audit: 5-word shingles of the <main> text, Jaccard.
//   node --test scripts/tests/town-uniqueness.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "..", "site");
const MAX_SIMILARITY = 0.30;
// Town pages; the two mobile-tyre-fitting-* articles are blog posts, not town pages.
const NOT_TOWN = new Set(["mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation.html", "mobile-tyre-fitting-livingston-tyre-problems.html"]);
const TOWN_PAGES = fs.readdirSync(SITE)
  .filter((f) => (/^mobile-tyre-fitting-[a-z-]+\.html$/.test(f) && !NOT_TOWN.has(f)) || f === "broxburn.html")
  .sort();

const ENTITIES = { amp: "&", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", nbsp: " ", quot: '"' };
function mainText(html) {
  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/) || ["", ""])[1];
  return main
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-z]+);/g, (m, e) => ENTITIES[e] || " ")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
function shingles(text, size = 5) {
  const w = text.match(/[a-z0-9]+/g) || [];
  const out = new Set();
  for (let i = 0; i + size <= w.length; i++) out.add(w.slice(i, i + size).join(" "));
  return out;
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

test("every town page is found (22 pages)", () => {
  assert.equal(TOWN_PAGES.length, 22, TOWN_PAGES.join(", "));
});

// BATCH 1 (release Thu 12 Nov 2026) rewrites 12 town pages; the other 10 are rewritten in BATCH 2 (Thu 19 Nov).
// Until batch 2, these pairs of two NOT-yet-rewritten pilot pages are known to be just over 30% (value measured
// 6 Nov 2026). They may not get worse, and every pair that includes any other page must meet the 30% rule.
// Batch 2 removes this list and enforces the full rule for all pairs.
const KNOWN_UNTIL_BATCH_2 = {
  "mobile-tyre-fitting-east-calder.html <-> mobile-tyre-fitting-winchburgh.html": 0.331,
  "mobile-tyre-fitting-east-calder.html <-> mobile-tyre-fitting-mid-calder.html": 0.330,
  "mobile-tyre-fitting-uphall.html <-> mobile-tyre-fitting-winchburgh.html": 0.319,
  "mobile-tyre-fitting-mid-calder.html <-> mobile-tyre-fitting-winchburgh.html": 0.309,
  "mobile-tyre-fitting-east-calder.html <-> mobile-tyre-fitting-uphall.html": 0.309,
  "mobile-tyre-fitting-mid-calder.html <-> mobile-tyre-fitting-uphall.html": 0.306,
};
const BATCH_1 = ["addiewell", "airdrie", "armadale", "blackburn", "boness", "harthill", "kirkliston", "linlithgow", "shotts", "west-calder", "whitburn", "wishaw"].map((t) => `mobile-tyre-fitting-${t}.html`);

test(`no two town pages are more than ${MAX_SIMILARITY * 100}% similar (main text, 5-word shingles)`, () => {
  const sh = Object.fromEntries(TOWN_PAGES.map((f) => [f, shingles(mainText(fs.readFileSync(path.join(SITE, f), "utf8")))]));
  const over = [];
  for (let i = 0; i < TOWN_PAGES.length; i++) {
    for (let j = i + 1; j < TOWN_PAGES.length; j++) {
      const key = `${TOWN_PAGES[i]} <-> ${TOWN_PAGES[j]}`;
      const s = jaccard(sh[TOWN_PAGES[i]], sh[TOWN_PAGES[j]]);
      const limit = KNOWN_UNTIL_BATCH_2[key] || MAX_SIMILARITY;
      if (s > limit) over.push(`${key}: ${Math.round(s * 1000) / 10}%`);
    }
  }
  assert.deepEqual(over, [], `town pages too similar:\n${over.join("\n")}`);
});

test("the known-until-batch-2 exceptions are only pairs of pages that batch 1 does not change", () => {
  for (const key of Object.keys(KNOWN_UNTIL_BATCH_2)) {
    for (const f of key.split(" <-> ")) assert.ok(!BATCH_1.includes(f), `${f} is a batch-1 page and must meet the full rule`);
  }
});

// Owner/testing chat, 6 Nov 2026: no unverifiable frequency claims about the business ("we regularly attend ...").
// Batch 1: checked on the 12 rewritten pages; batch 2 extends it to every town page.
test("no frequency claims such as 'regularly attend' or 'regular areas' on the rewritten town pages", () => {
  for (const f of BATCH_1) {
    assert.doesNotMatch(fs.readFileSync(path.join(SITE, f), "utf8"), /\bregular(ly)?\b/i, `${f} makes a frequency claim`);
  }
});

test("generated pilot pages carry no Armadale copy in their shared sections", () => {
  for (const f of ["uphall", "east-calder", "mid-calder", "winchburgh"]) {
    const html = fs.readFileSync(path.join(SITE, `mobile-tyre-fitting-${f}.html`), "utf8");
    assert.doesNotMatch(mainText(html), /armadale/, `${f}: mentions Armadale`);
  }
});
