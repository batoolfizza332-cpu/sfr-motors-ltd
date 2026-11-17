// Ahrefs Part A (request 12 Nov 2026, released with town-page batch 2): short meta descriptions on the town pages
// and in-text links between neighbouring towns.
//   node --test scripts/tests/town-links-descriptions.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "..", "site");
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8");
// Blog posts whose file names start like a town page.
const NOT_TOWN = new Set(["mobile-tyre-fitting-livingston-tyre-problems.html", "mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation.html"]);
const TOWN_PAGES = fs.readdirSync(SITE).filter((f) => (/^mobile-tyre-fitting-[a-z-]+\.html$/.test(f) && !NOT_TOWN.has(f)) || f === "broxburn.html");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const mainOf = (html) => (html.match(/<main id="main">([\s\S]*?)<\/main>/) || ["", ""])[1];

test("every town page has a meta description of 155 characters or fewer", () => {
  assert.equal(TOWN_PAGES.length, 22, TOWN_PAGES.join(", "));
  for (const f of TOWN_PAGES) {
    const html = read(f);
    const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    assert.ok(d, `${f} has no meta description`);
    assert.ok([...decode(d)].length <= 155, `${f}: ${[...decode(d)].length} characters`);
  }
});

// Neighbouring towns only (the source page's own text names the town it links to).
const LINKS = {
  "broxburn.html": ["/mobile-tyre-fitting-uphall/", "/mobile-tyre-fitting-winchburgh/"],
  "mobile-tyre-fitting-livingston.html": ["/mobile-tyre-fitting-uphall/", "/mobile-tyre-fitting-mid-calder/", "/mobile-tyre-fitting-east-calder/"],
};

test("neighbouring-town links are in the main text, with the town name as the link text", () => {
  for (const [page, targets] of Object.entries(LINKS)) {
    const main = mainOf(read(page));
    for (const href of targets) {
      const m = main.match(new RegExp(`<a href="${href}">([^<]+)</a>`));
      assert.ok(m, `${page} has no in-text link to ${href}`);
      assert.ok(fs.existsSync(path.join(SITE, href.slice(1, -1) + ".html")), `${href} has no page`);
      assert.ok(!/click here|read more|here$/i.test(m[1]), `${page} -> ${href}: link text "${m[1]}" is not descriptive`);
    }
  }
});
