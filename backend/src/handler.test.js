"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { clean, isValidEmail, isPlausiblePhone, escapeHtml } = require("./handler");

test("clean strips angle brackets", () => {
  assert.equal(clean("<script>alert(1)</script>", 100), "scriptalert(1)/script");
});

test("clean trims whitespace", () => {
  assert.equal(clean("  Jane Doe  ", 100), "Jane Doe");
});

test("clean truncates to the given max length", () => {
  assert.equal(clean("abcdefgh", 5), "abcde");
});

test("clean returns empty string for non-string input", () => {
  assert.equal(clean(undefined, 100), "");
  assert.equal(clean(null, 100), "");
  assert.equal(clean(42, 100), "");
});

test("isValidEmail accepts well-formed addresses", () => {
  assert.equal(isValidEmail("info@sfrmotors.co.uk"), true);
  assert.equal(isValidEmail("a@b.co"), true);
});

test("isValidEmail rejects malformed addresses", () => {
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("missing@domain"), false);
  assert.equal(isValidEmail("@no-local-part.com"), false);
  assert.equal(isValidEmail("spaces in@email.com"), false);
});

test("isPlausiblePhone accepts common UK formats", () => {
  assert.equal(isPlausiblePhone("0131 202 0289"), true);
  assert.equal(isPlausiblePhone("+447448427154"), true);
  assert.equal(isPlausiblePhone("(01312) 020-289"), true);
});

test("isPlausiblePhone rejects too few or too many digits", () => {
  assert.equal(isPlausiblePhone("12345"), false);
  assert.equal(isPlausiblePhone("1".repeat(17)), false);
});

test("isPlausiblePhone rejects letters", () => {
  assert.equal(isPlausiblePhone("call-me-maybe"), false);
});

test("escapeHtml escapes ampersands only", () => {
  assert.equal(escapeHtml("Tyres & Wheels"), "Tyres &amp; Wheels");
  assert.equal(escapeHtml("<b>bold</b>"), "<b>bold</b>");
});
