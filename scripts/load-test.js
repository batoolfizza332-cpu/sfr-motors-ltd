#!/usr/bin/env node
// Local load test: N simulated visitors at once, each opening the home page, a service page, a blog post and the
// quote page, against the LOCAL preview server (scripts/preview-edge.js on 127.0.0.1) only. Built-in fetch, no
// dependencies. It refuses any target that is not localhost, so it can never hit sfrmotors.co.uk.
//   npm run build && node scripts/load-test.js            (100, 500 and 1000 visitors)
//   node scripts/load-test.js 50 200                      (custom stages)
// Note: this measures the Node preview server on this PC, not Hostinger's LiteSpeed server.
"use strict";

const { spawn } = require("child_process");
const path = require("path");

const PAGES = ["/", "/mobile-tyre-fitting/", "/puncture-repair-at-home-edinburgh/", "/contact-us/"];
const STAGES = process.argv.slice(2).map(Number).filter((n) => n > 0);
const stages = STAGES.length ? STAGES : [100, 500, 1000];
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;

function assertLocal(url) {
  const { hostname } = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) throw new Error(`Refusing to load-test a non-local URL: ${url}`);
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function visitor(times, errors) {
  for (const p of PAGES) {
    const url = BASE + p;
    assertLocal(url);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: { host: "sfrmotors.co.uk" } });
      await res.arrayBuffer();
      if (res.status !== 200) errors.push(`${res.status} ${p}`);
    } catch (e) {
      errors.push(`${e.cause ? e.cause.code || e.cause.message : e.message} ${p}`);
    }
    times.push(performance.now() - t0);
  }
}

async function stage(n) {
  const times = [], errors = [];
  const t0 = performance.now();
  await Promise.all(Array.from({ length: n }, () => visitor(times, errors)));
  const total = (performance.now() - t0) / 1000;
  times.sort((a, b) => a - b);
  const kinds = {};
  for (const e of errors) { const k = e.split(" ")[0]; kinds[k] = (kinds[k] || 0) + 1; }
  console.log(`${String(n).padStart(5)} visitors | ${times.length} requests in ${total.toFixed(1)} s (${(times.length / total).toFixed(0)} req/s) | ` +
    `p50 ${pct(times, 50).toFixed(0)} ms, p95 ${pct(times, 95).toFixed(0)} ms, max ${times[times.length - 1].toFixed(0)} ms | errors ${errors.length}` +
    (errors.length ? ` ${JSON.stringify(kinds)}` : ""));
}

(async () => {
  assertLocal(BASE);
  const server = spawn(process.execPath, [path.join(__dirname, "preview-edge.js"), String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => { if (/Local preview/.test(String(d))) resolve(); });
    server.on("exit", (c) => reject(new Error(`preview server exited (${c})`)));
  });
  try {
    console.log(`Load test against ${BASE} (local preview of dist/), pages: ${PAGES.join(", ")}`);
    for (const n of stages) await stage(n);
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
