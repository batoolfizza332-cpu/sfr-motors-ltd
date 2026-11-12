// Google Search Console HTML-tag verification for the owner's own property (owner request 12 Nov 2026).
//   node --test scripts/tests/gsc-verification.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TAG = '<meta name="google-site-verification" content="1uWLUI37FSoQpC8Y0zwLL39LXqeyWsNcObaxvhtrCGA" />';
const head = (html) => (html.match(/<head>([\s\S]*?)<\/head>/) || ["", ""])[1];

for (const dir of ["site", "dist"]) {
  const file = path.join(ROOT, dir, "index.html");
  test(`${dir}/index.html has the owner's verification tag exactly once, inside <head>`, { skip: !fs.existsSync(file) }, () => {
    const html = fs.readFileSync(file, "utf8");
    // The HTML minifier writes "/>" instead of " />"; both are the same tag to Google.
    const tag = dir === "dist" ? TAG.replace(" />", "/>") : TAG;
    assert.equal(html.split(tag).length - 1, 1);
    assert.ok(head(html).includes(tag));
    assert.equal((html.match(/google-site-verification/g) || []).length, 1, "no other verification tag added");
  });
}
