#!/usr/bin/env node
// Behavioural tests for the production-hostname guards in site/assets/js/analytics.js and main.js.
//
// Both scripts are executed unchanged inside a Node `vm` sandbox with a minimal fake browser, once per
// hostname, and the tests assert what they would do there:
//   - Google Analytics (gtag.js) may load only on sfrmotors.co.uk and www.sfrmotors.co.uk, even after the visitor
//     accepts analytics; on localhost, *.vercel.app previews and look-alike hosts nothing is requested.
//   - The quote form may open WhatsApp only on those two hostnames; on any other host it shows a preview notice.
// No network is used and nothing can reach Google or WhatsApp. It is run by `npm run verify` (check 20) and can be
// run alone:  node scripts/host-guard-tests.js

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_DIR = path.join(__dirname, "..", "site", "assets", "js");
const source = (name) => fs.readFileSync(path.join(JS_DIR, name), "utf8");

const PRODUCTION_HOSTS = ["sfrmotors.co.uk", "www.sfrmotors.co.uk"];
const OTHER_HOSTS = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "sfr-motors-preview.vercel.app",
  "sfr-motors-preview-git-feature-seo-safe-migration-batoolfizza332-cpu.vercel.app",
  "sfr-motors-preview-abc123.vercel.app",
  "sfrmotors.co.uk.evil.example",
  "evilsfrmotors.co.uk",
  "sfrmotors.com",
  "staging.sfrmotors.co.uk",
  "d111111abcdef8.cloudfront.net",
];

// -- a tiny fake browser --------------------------------------------------------------------------------
function element(tag) {
  const el = {
    tagName: tag,
    style: {},
    dataset: {},
    listeners: {},
    parentNode: null,
    textContent: "",
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    hasAttribute() { return false; },
    appendChild(child) { child.parentNode = el; return child; },
    removeChild() {},
    querySelector() { return element("div"); },
    querySelectorAll() { return []; },
    focus() {},
    reset() {},
  };
  return el;
}

function makeBrowser(hostname, initialCookie) {
  const jar = new Map();
  if (initialCookie) jar.set(initialCookie.slice(0, initialCookie.indexOf("=")), initialCookie.slice(initialCookie.indexOf("=") + 1));
  const appendedToHead = [];
  const documentListeners = {};
  const body = element("body");
  const head = element("head");
  head.appendChild = (child) => { appendedToHead.push(child); return child; };
  body.insertBefore = (child) => { child.parentNode = body; body.inserted = child; return child; };
  body.contains = () => true;
  const dispatched = [];
  const opened = [];
  const document = {
    body,
    head,
    createElement: element,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener(type, fn) { (documentListeners[type] = documentListeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(event) { dispatched.push(event); },
  };
  Object.defineProperty(document, "cookie", {
    get: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    set: (raw) => {
      const [pair, ...attrs] = raw.split("; ");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      if (attrs.some((a) => /^Max-Age=0$/i.test(a))) jar.delete(name);
      else jar.set(name, pair.slice(eq + 1));
    },
  });
  let clock = 1000;
  const window = {
    location: { hostname, pathname: "/", protocol: "https:" },
    console: { info() {}, log() {} },
    setTimeout: () => 0,
    open: (...args) => { opened.push(args); },
  };
  const FakeDate = function () { return new Date(); }; // `new Date()` still works in analytics.js
  FakeDate.now = () => clock; // main.js measures the form fill time with Date.now()
  return { window, document, appendedToHead, dispatched, opened, jar, advance: (ms) => { clock += ms; }, sandbox: { window, document, CustomEvent: function (name) { this.type = name; }, Date: FakeDate } };
}

function run(file, env) {
  vm.runInNewContext(source(file), { ...env.sandbox, console: env.window.console });
}

// -- analytics --------------------------------------------------------------------------------------------
function analyticsLoaded(env) {
  return env.appendedToHead.some((s) => /googletagmanager\.com\/gtag\/js/.test(s.src || "")) || typeof env.window.dataLayer !== "undefined" || typeof env.window.gtag !== "undefined";
}

function testAnalytics(failures) {
  for (const host of [...PRODUCTION_HOSTS, ...OTHER_HOSTS]) {
    const expected = PRODUCTION_HOSTS.includes(host);

    // 1. Consent was granted earlier (cookie remembered): start-up path.
    const remembered = makeBrowser(host, "sfr_consent=v1:analytics=granted");
    run("analytics.js", remembered);
    if (analyticsLoaded(remembered) !== expected) {
      failures.push(`analytics.js with a remembered "granted" choice on ${host}: gtag.js ${expected ? "should load" : "must NOT load"} but ${expected ? "did not" : "did"}.`);
    }

    // 2. First visit: the banner is shown and the visitor presses "Accept analytics".
    const fresh = makeBrowser(host);
    run("analytics.js", fresh);
    if (analyticsLoaded(fresh)) failures.push(`analytics.js loaded Google before any choice on ${host}.`);
    const panel = fresh.document.body.inserted; // the banner is inserted first into <body>
    if (!panel) {
      failures.push(`analytics.js did not show the consent banner on ${host} (the consent UI must work on every host).`);
      continue;
    }
    panel.listeners.click[0]({ target: { closest: () => ({ hasAttribute: (a) => a === "data-sfr-consent", getAttribute: () => "granted" }) } });
    if (analyticsLoaded(fresh) !== expected) {
      failures.push(`analytics.js after pressing "Accept analytics" on ${host}: gtag.js ${expected ? "should load" : "must NOT load"} but ${expected ? "did not" : "did"}.`);
    }
    if (!/sfr_consent=v1:analytics=granted/.test(fresh.document.cookie)) {
      failures.push(`analytics.js did not remember the accepted choice on ${host} (the consent UI must work on every host).`);
    }
  }
}

// -- quote form -------------------------------------------------------------------------------------------
function testForm(failures) {
  for (const host of [...PRODUCTION_HOSTS, ...OTHER_HOSTS]) {
    const expected = PRODUCTION_HOSTS.includes(host);
    const env = makeBrowser(host);
    const form = element("form");
    const status = element("p");
    let data = { name: "Test Reviewer", phone: "07000000000", service: "Puncture repair", location: "Bathgate" };
    form.reset = () => { data = {}; };
    env.document.getElementById = (id) => (id === "quote-form-el" ? form : id === "quote-form-status" ? status : null);
    env.sandbox.FormData = function () { return { entries: () => Object.entries(data) }; };
    run("main.js", env);
    env.advance(10000); // a human-plausible fill time, so the bot-timing shortcut is not taken
    form.listeners.submit[0]({ preventDefault() {} });

    const opened = env.opened.length;
    const waUrl = opened ? String(env.opened[0][0]) : "";
    if (expected) {
      if (opened !== 1 || !waUrl.startsWith("https://wa.me/447448427154?text=")) failures.push(`main.js on ${host}: the form should open the WhatsApp enquiry once (opened ${opened}).`);
      if (!env.dispatched.some((e) => e.type === "sfr:quote-submitted")) failures.push(`main.js on ${host}: the form should announce sfr:quote-submitted.`);
    } else {
      if (opened !== 0) failures.push(`main.js on ${host}: the form must NOT open WhatsApp on a non-production host (opened ${opened}).`);
      if (env.dispatched.length !== 0) failures.push(`main.js on ${host}: the form must NOT announce a submission on a non-production host.`);
      if (status.dataset.state !== "error" || !/Preview copy/.test(status.textContent)) failures.push(`main.js on ${host}: the form must explain that nothing was sent (got "${status.textContent}").`);
      if (Object.keys(data).length === 0) failures.push(`main.js on ${host}: the form must keep the visitor's entries when it does not send them.`);
    }
  }
}

function runAll() {
  const failures = [];
  const pattern = /(?:IS_PRODUCTION_HOST|PRODUCTION_HOST)\s*=\s*(\/\^[^\n]*?\$\/)\.test\(window\.location\.hostname\)/;
  const patterns = ["analytics.js", "main.js"].map((f) => (source(f).match(pattern) || [])[1]);
  const approved = String(/^(www\.)?sfrmotors\.co\.uk$/);
  if (patterns.some((p) => p !== approved)) failures.push(`The production-hostname pattern in analytics.js / main.js must be exactly ${approved} in both files (found ${patterns.join(" and ")}).`);
  testAnalytics(failures);
  testForm(failures);
  return failures;
}

module.exports = { runAll };

if (require.main === module) {
  const failures = runAll();
  const hosts = PRODUCTION_HOSTS.length + OTHER_HOSTS.length;
  if (failures.length) {
    failures.forEach((f) => console.error("FAIL " + f));
    process.exit(1);
  }
  console.log(`Host guards OK: Analytics and the WhatsApp form behave correctly on ${hosts} hostnames (2 production, ${OTHER_HOSTS.length} others).`);
}
