// The site's URL rules and security headers, read from infra/template.yaml (the single source for both).
//
//   loadRouting()         the routing function and its three tables (special / same / legacy)
//   loadSecurityHeaders() CSP, HSTS, framing, referrer and permissions headers
//   routeTable()          every 301 redirect and every pretty URL, as plain lists
//
// scripts/htaccess-config.js turns these into the Hostinger .htaccess; scripts/live-compare.js checks the live
// site against routeTable(); scripts/verify.js proves the .htaccess routes every URL the same way.
// Zero dependencies, read-only.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TEMPLATE = path.join(__dirname, "..", "infra", "template.yaml");

const readTemplate = () => fs.readFileSync(TEMPLATE, "utf8").replace(/\r/g, "");

// The routing function source and its three routing tables (special / same / legacy).
function loadRouting(template = readTemplate()) {
  const code = (template.match(/FunctionCode: \|\n([\s\S]*?)\n\n  Distribution:/) || [])[1];
  if (!code) throw new Error("Could not find the LegacyRedirectFunction code in infra/template.yaml");
  const pairs = (block) => Object.fromEntries([...block.matchAll(/'([^']*)':\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
  const special = pairs((code.match(/var special = \{([\s\S]*?)\n\s*\};/) || [])[1] || "");
  const legacy = pairs((code.match(/var legacy = \{([\s\S]*?)\n\s*\};/) || [])[1] || "");
  const sameBlock = (code.match(/var same = \(([\s\S]*?)\)\.split\(' '\);/) || [])[1] || "";
  const same = [...sameBlock.matchAll(/'([^']*)'/g)].map((m) => m[1]).join("").split(" ").filter(Boolean);
  if (!Object.keys(special).length || !Object.keys(legacy).length || !same.length) {
    throw new Error("Could not read the special / same / legacy routing tables from infra/template.yaml");
  }
  const edgeFunction = vm.runInNewContext(code + "\n;handler");
  return { special, same, legacy, edgeFunction };
}

// The security headers, read from the ResponseHeadersPolicy in infra/template.yaml.
function loadSecurityHeaders(template = readTemplate()) {
  const take = (re, what) => {
    const m = template.match(re);
    if (!m) throw new Error(`Could not read ${what} from infra/template.yaml`);
    return m[1];
  };
  const csp = take(/ContentSecurityPolicy: >-\n([\s\S]*?)\n\s*Override: true/, "the Content-Security-Policy")
    .split("\n").map((line) => line.trim()).join(" ");
  const hsts = `max-age=${take(/AccessControlMaxAgeSec: (\d+)/, "the HSTS max-age")}; includeSubDomains; preload`;
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: hsts },
    { key: "X-Frame-Options", value: take(/FrameOption: (\w+)/, "the frame option") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: take(/ReferrerPolicy: ([\w-]+)/, "the referrer policy") },
    { key: "Permissions-Policy", value: take(/Header: Permissions-Policy\n\s+Value: "([^"]*)"/, "the permissions policy") },
  ];
}

// Every 301 ({source, destination}) and every pretty URL path that must answer 200.
function routeTable() {
  const { special, same, legacy } = loadRouting();
  const pages = [...Object.entries(special), ...same.map((slug) => [slug, slug])]; // public slug -> file (no .html)

  const redirects = [{ source: "/index.html", destination: "/" }];
  for (const [slug, file] of pages) redirects.push({ source: `/${file}.html`, destination: `/${slug}/` });
  for (const [from, to] of Object.entries(legacy)) redirects.push({ source: from, destination: to }, { source: `${from}/`, destination: to });

  const prettyPaths = pages.flatMap(([slug]) => [`/${slug}`, `/${slug}/`]);
  return { redirects, prettyPaths };
}

module.exports = { loadRouting, loadSecurityHeaders, routeTable };
