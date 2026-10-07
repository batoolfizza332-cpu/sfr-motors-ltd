#!/usr/bin/env node
// Generates vercel.json (the Vercel Preview configuration) from infra/template.yaml, so the
// routing, security headers and CSP can never drift from the approved CloudFront definition.
//
//   node scripts/vercel-config.js           write vercel.json
//   node scripts/vercel-config.js --check   exit 1 if vercel.json differs from what would be generated
//
// It also exports simulateVercel(), a small model of Vercel's request order (redirects, then files, then
// rewrites, then 404.html) that scripts/verify.js uses to prove Vercel routes every URL the same way the
// CloudFront Function does. The real Vercel behaviour is checked separately against the deployed Preview.
// Zero dependencies; read-only apart from writing vercel.json when run without --check.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(ROOT, "infra", "template.yaml");
const VERCEL_JSON = path.join(ROOT, "vercel.json");

// A Vercel deployment is a review copy: keep it out of search engines. Not used by any real (Hostinger/AWS) hosting.
const REVIEW_COPY_ROBOTS_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" };

const readTemplate = () => fs.readFileSync(TEMPLATE, "utf8").replace(/\r/g, "");

// The CloudFront Function source and its three routing tables (special / same / legacy).
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

// The security headers, read from the CloudFront ResponseHeadersPolicy so both hosts send the same ones.
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

function buildConfig() {
  const template = readTemplate();
  const { special, same, legacy } = loadRouting(template);

  // Pretty-path pages: public slug -> file (no .html). Same order as the CloudFront tables.
  const pages = [...Object.entries(special), ...same.map((slug) => [slug, slug])];

  const redirects = [{ source: "/index.html", destination: "/", statusCode: 301 }];
  for (const [slug, file] of pages) redirects.push({ source: `/${file}.html`, destination: `/${slug}/`, statusCode: 301 });
  for (const [from, to] of Object.entries(legacy)) {
    redirects.push({ source: from, destination: to, statusCode: 301 }, { source: `${from}/`, destination: to, statusCode: 301 });
  }

  const rewrites = [];
  for (const [slug, file] of pages) rewrites.push({ source: `/${slug}`, destination: `/${file}.html` }, { source: `/${slug}/`, destination: `/${file}.html` });

  const cache = (source, value) => ({ source, headers: [{ key: "Cache-Control", value }] });
  const headers = [
    // Security headers (identical to CloudFront's) plus the review-copy noindex. The noindex exists ONLY here: infra/template.yaml
    // (the spec for the real hosting) must never carry it, and verify check 19 enforces both sides.
    { source: "/(.*)", headers: [...loadSecurityHeaders(template), REVIEW_COPY_ROBOTS_HEADER] },
    // The same policy infra/deploy-site.sh applies on S3: css/img/fonts and the content-hashed scripts never change
    // under the same name (the calculator script is content-hashed like main and analytics).
    cache("/assets/(css|img|fonts)/(.*)", "public, max-age=31536000, immutable"),
    cache("/assets/js/(main|analytics|tyre-calculator)\\.([0-9a-f]+)\\.js", "public, max-age=31536000, immutable"),
    cache("/robots.txt", "public, max-age=3600"),
    cache("/sitemap.xml", "public, max-age=3600"),
    cache("/favicon.ico", "public, max-age=3600"),
  ];

  return {
    $schema: "https://openapi.vercel.sh/vercel.json",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    framework: null,
    redirects,
    rewrites,
    headers,
  };
}

// Vercel's order: redirects, then real files, then rewrites, then 404.html (status 404). Sources here are literal paths.
// hasFile(pathname) says whether dist/ contains that file. Returns {redirect} | {file} | {notFound: true}.
function simulateVercel(config, pathname, hasFile) {
  const hit = (list) => list.find((rule) => rule.source === pathname);
  const redirect = hit(config.redirects || []);
  if (redirect) return { redirect: redirect.destination };
  const asFile = pathname === "/" ? "/index.html" : pathname;
  if (hasFile(asFile)) return { file: asFile };
  const rewrite = hit(config.rewrites || []);
  if (rewrite) return { file: rewrite.destination };
  return { notFound: true };
}

module.exports = { buildConfig, loadRouting, loadSecurityHeaders, simulateVercel, VERCEL_JSON, REVIEW_COPY_ROBOTS_HEADER };

if (require.main === module) {
  const generated = JSON.stringify(buildConfig(), null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(VERCEL_JSON) ? fs.readFileSync(VERCEL_JSON, "utf8").replace(/\r/g, "") : "";
    if (current !== generated) {
      console.error("vercel.json is out of date with infra/template.yaml. Run: node scripts/vercel-config.js");
      process.exit(1);
    }
    console.log("vercel.json is in sync with infra/template.yaml");
  } else {
    fs.writeFileSync(VERCEL_JSON, generated);
    console.log(`Wrote vercel.json (${JSON.parse(generated).redirects.length} redirects, ${JSON.parse(generated).rewrites.length} rewrites)`);
  }
}
