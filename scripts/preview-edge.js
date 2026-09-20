#!/usr/bin/env node
// Local production preview that MODELS CloudFront + private S3, for checking dist/ before any deployment.
//
//   npm run build && node scripts/preview-edge.js [port]      (default port 4174, http://127.0.0.1:<port>/)
//
// It serves dist/ and applies, read live from infra/template.yaml so it can never drift from the real config:
//   - the LegacyRedirectFunction (301 redirects, pretty-path rewrites, /index.html -> /, www -> apex when the Host header says so)
//   - the ResponseHeadersPolicy security headers, including the exact Content-Security-Policy
//   - brotli/gzip compression of text files (CloudFront "Compress: true")
//   - CloudFront's custom error response: any missing URL returns /404.html with status 404
// Zero dependencies, read-only, binds to 127.0.0.1 only. It never talks to AWS.
//
// Notes: Google Analytics is never loaded on localhost / 127.0.0.1 (see assets/js/analytics.js), so pressing "Accept analytics"
// here cannot send data to the live GA4 property.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.argv[2] || process.env.PORT || 4174);

const template = fs.readFileSync(path.join(ROOT, "infra", "template.yaml"), "utf8").replace(/\r/g, "");
const fnCode = template
  .match(/FunctionCode: \|\n([\s\S]*?)\n\n  Distribution:/)[1]
  .split("\n")
  .map((line) => line.replace(/^ {8}/, ""))
  .join("\n");
const edgeFunction = vm.runInNewContext(fnCode + "\n;handler");
const csp = template
  .match(/ContentSecurityPolicy: >-\n([\s\S]*?)\n\s*Override: true/)[1]
  .split("\n")
  .map((line) => line.trim())
  .join(" ");

const SECURITY_HEADERS = {
  "content-security-policy": csp,
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
};
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".ico": "image/vnd.microsoft.icon", ".woff2": "font/woff2",
};

function s3Object(uri) {
  const key = (uri === "/" ? "/index.html" : uri).replace(/^\//, ""); // DefaultRootObject
  if (!key || key.endsWith("/") || key.includes("..")) return null;
  const file = path.join(DIST, key);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://x").pathname;
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    const send = (status, type, body, extra = {}) => {
      res.statusCode = status;
      res.setHeader("content-type", type);
      res.setHeader("cache-control", "no-store");
      for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.setHeader(k, v);
      const accept = req.headers["accept-encoding"] || "";
      if (/^(text\/|application\/(javascript|xml)|image\/svg)/.test(type) && body.length >= 1000) {
        if (/\bbr\b/.test(accept)) { body = zlib.brotliCompressSync(body); res.setHeader("content-encoding", "br"); }
        else if (/gzip/.test(accept)) { body = zlib.gzipSync(body); res.setHeader("content-encoding", "gzip"); }
        res.setHeader("vary", "Accept-Encoding");
      }
      res.end(body);
    };

    let uri = pathname;
    if (!/^\/assets\/./.test(pathname)) { // the function is attached to the default behaviour only, not /assets/*
      const out = edgeFunction({ request: { uri: pathname, method: req.method, headers: host ? { host: { value: host } } : {}, querystring: {}, cookies: {} } });
      if (out.statusCode) return send(out.statusCode, "text/plain", Buffer.alloc(0), { location: out.headers.location.value });
      uri = out.uri;
    }
    const file = s3Object(uri);
    if (file) return send(200, TYPES[path.extname(file)] || "application/octet-stream", fs.readFileSync(file));
    const notFound = path.join(DIST, "404.html"); // CustomErrorResponses: 403/404 -> /404.html with status 404
    return send(404, TYPES[".html"], fs.readFileSync(fs.existsSync(notFound) ? notFound : path.join(DIST, "index.html")));
  })
  .listen(PORT, "127.0.0.1", () => console.log(`CloudFront/CSP preview of dist/ on http://127.0.0.1:${PORT}/`));
