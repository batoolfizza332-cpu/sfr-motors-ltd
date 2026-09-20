# SFR Motors static website — project handover

This document lets a new developer (or a new AI assistant) continue the project **without any chat history**. It contains no
passwords, tokens or credentials, and none must ever be added to the repository.

**Merging this branch and deploying it each need the owner's separate, explicit approval. Nothing has been merged or deployed.**

Companion documents: [`README.md`](README.md) (build, verify, hosting, analytics detail) and
[`infra/CUTOVER-RUNBOOK.md`](infra/CUTOVER-RUNBOOK.md) (backup, Route 53 cutover, rollback, post-deployment checks).

---

## 1. At a glance

| Item | Value |
|---|---|
| Project | Static replacement website for **SFR Motors Ltd**, a mobile tyre-fitting business (service-area business, Bathgate, West Lothian) |
| Live site today | `https://sfrmotors.co.uk` — **WordPress on Hostinger** (unchanged, still live) |
| Target | Static site on **AWS S3 + CloudFront** (not Cloudflare, not Vercel), DNS on **AWS Route 53** |
| Local path (Windows) | `C:\Users\batoo\Desktop\SFR Motors Website` |
| Repository | `batoolfizza332-cpu/sfr-motors-ltd` on GitHub (**public** repository) |
| Working branch | `feature/seo-safe-migration` (not merged into `main`) |
| Baseline before this checkpoint | `27bf898` |
| Checkpoint content commit | **`4412584`** — all owner-approved corrections and this document. The commit right after it only records this hash; the branch tip (`git rev-parse HEAD`) is the final commit of this checkpoint. |
| GA4 Measurement ID | `G-B9TY4GMXYT` (public by design; confirmed active by the owner) |
| Migration status | **Build finished and audited; NOT merged; NOT deployed; no DNS or AWS resource changed.** |

## 2. Architecture: live WordPress vs future static site

**Today:** visitors -> `sfrmotors.co.uk` -> Hostinger (LiteSpeed/PHP, WordPress, IP `82.29.191.9`). DNS is at Hostinger DNS
(`pixel.dns-parking.com`, `byte.dns-parking.com`). **E-mail (`info@sfrmotors.co.uk`) is hosted at Hostinger** (MX
`mx1.hostinger.com`, `mx2.hostinger.com`). `www` is a CNAME to the apex and 301s to the apex.

**Future:** visitors -> Route 53 (Alias) -> CloudFront (HTTPS, compression, security headers, edge redirect function) -> private S3
bucket (Origin Access Control, Block Public Access). GitHub Actions can deploy with an OIDC role (no stored keys).

> **HOSTINGER E-MAIL WARNING.** Moving DNS to Route 53 will silently break company e-mail if any MX / SPF / DKIM / DMARC / TXT
> record is missed. Export and copy **every** record first, prove them identical with `dig` against both zones, and test e-mail before and
> after every change. Never edit the Hostinger DNS zone or cancel Hostinger hosting/e-mail. See the runbook, sections A, C, D, G.

## 3. What has been done (summary)

* Static site built from the approved WordPress audit: **57 sitemap pages** (32 on pretty paths) + a dedicated `404.html`.
* All pretty-path pages use root-relative assets; all 1,817 internal links resolve; no local asset 404s; no nested asset paths.
* Root `/favicon.ico` from the approved logo; multi-size ICO.
* Accessibility: contrast fixes, keyboard focus, closed mobile menu no longer focusable, 44 px mobile targets, breadcrumb targets.
* Approved photographs only (no gallery/carousel); customer registrations unreadable (section 9).
* **Cookie consent + GA4** (section 6) with equal Accept / Reject and withdrawal.
* Home "Stranded With a Tyre Problem?" and "About SFR Motors" sections repaired (scoped `--photo` / `--framed` modifiers).
* Pre-deployment audit fixes: CloudFront Function shrunk under the AWS 10 KB / 128-character limits, real `404.html`, `www` -> apex, watermark removed
  from seven pages' van photo, JSON-LD URLs made absolute, deploy script no longer deletes old assets mid-deploy, unused API origin removed from CSP.
* `priceRange` removed from structured data (no price classification is approved). `aggregateRating` 4.9 / 282 is kept.
* **Owner-approved corrections (this checkpoint):** placeholder Facebook/Instagram links removed; click-to-load Google Map; self-hosted Roboto;
  `robots.txt` (OAI-SearchBot allowed, GPTBot disallowed); `/index.html` -> `/` 301; `/broxburn/` linked from Areas We Cover; service-area address
  policy (no street address anywhere); company disclosure in the footer; WhatsApp 07448 427154 as a contact channel; rewritten Privacy Policy; Route 53 runbook.

## 4. URLs and routing rules (do not change without the owner)

* **Pretty paths** (32 pages, served from differently named or same-named `.html` files) and their canonicals are defined once in the CloudFront
  Function tables in `infra/template.yaml` (`special` = slug -> file where names differ, `same` = slug equals file name, `legacy` = old WordPress URLs),
  and mirrored by `CANONICAL_URL_OVERRIDES` in `scripts/verify.js`. Check 16 keeps them in sync.
  Examples: `/about-us/` -> `about.html`, `/contact-us/` -> `contact.html`, `/24-7-mobile-tyre-replacement/` -> `emergency-tyre-change.html`,
  `/broxburn/` -> `broxburn.html`, and 25 pages where slug = file name (`/blog/`, `/how-to-change-a-tyre/`, ...).
* **Redirects (301):** every `/<file>.html` of a pretty page -> its pretty URL; 15 legacy WordPress URLs (with/without trailing slash) -> their new pages;
  **`/index.html` -> `/`**; `www.<domain>` -> apex (single hop, path and query kept). Four internal links to blog `.html` posts intentionally still
  redirect (safe; could be normalised later).
* **Home is `/`.** Nothing may link to `/index.html` (verify check 2). Flat pages (e.g. `/services.html`, `/privacy-policy.html`) keep their `.html` URL.
* **404:** CloudFront serves `/404.html` with status 404 for any missing URL (it is `noindex`, has no canonical, uses root-relative assets).
* The CloudFront Function must stay **under 10,240 bytes** and its comment **under 128 characters** (AWS hard limits) — check 16 enforces this.
* Sitemap: `site/sitemap.xml` lists the 57 indexable pages using canonical URLs.

## 5. Commands

Requires Node 18+ (developed on Node 26). Do not install new dependencies without the owner's approval (`clean-css`, `html-minifier-terser`, `terser` are the only ones).

```bash
npm install                          # only if node_modules is missing
npm run build                        # site/ -> dist/ (minified, content-hashed CSS/JS)
npm run verify                       # build + 18 quality checks; must print QUALITY GATE: PASSED
git diff --check                     # whitespace / conflict markers
node scripts/preview-edge.js 4174    # local production preview that models CloudFront redirects, 404, compression and the exact CSP
```

`npm run verify` (see `scripts/verify.js`) covers: build; internal links/anchors (and no `/index.html` links, no `href="#"`, no orphan pages); one H1;
titles/descriptions; canonicals; images (alt, size, no unreferenced files); sitemap; placeholder text; pretty-path asset paths; favicon;
consent + Analytics (15); CloudFront Function limits/routing/404 (16); JSON-LD URLs (17); the owner-approved corrections (18).
Browser-level testing was done in a Chrome DevTools-Protocol harness kept **outside** the repo (session scratchpad); it is not part of the project.

## 6. Analytics and cookie consent

* Central implementation: `site/assets/js/analytics.js` (one file, loaded on every page). Measurement ID `G-B9TY4GMXYT` is defined once there.
* **Before consent nothing Google-related loads** (no `gtag.js`, no `dataLayer`, no `_ga` cookie). A fixed banner offers equal **Accept analytics** /
  **Reject analytics**; scrolling, Escape or ignoring is not consent. A footer **Cookie settings** button reopens the choice on every page.
* Consent is stored in one essential first-party cookie `sfr_consent` (`v1:analytics=granted|denied`, 180 days, `Path=/`, `SameSite=Lax`, `Secure` on HTTPS).
* Accept -> `gtag.js` loads once (`https://www.googletagmanager.com/gtag/js?id=G-B9TY4GMXYT`), one `page_view`, Google signals and ad personalisation
  off, advertising storage denied. Withdraw -> tag stopped, `_ga*` cookies removed, page reloads.
* Events (only while consent is granted): `phone_click`, `whatsapp_click`, `quote_request`, `contact_form_submit`, `cta_click`, `nav_click`;
  phone/WhatsApp events carry only `page_path`, `page_type`, `link_location` (never the number, text or URL).
* GA4 "Enhanced measurement" is enabled in the property; its automatic outbound-click `click` event is a **separate** event from `whatsapp_click`
  (the Privacy Policy says so).
* On `localhost` / `127.0.0.1` Google Analytics is never loaded, so local testing cannot pollute the live property.
* CSP for analytics: `script-src https://www.googletagmanager.com`; `connect-src`/`img-src` `https://www.google-analytics.com` and
  `https://region1.google-analytics.com` (exact hosts, no wildcards). If data from another region is missing after launch, look for a CSP
  violation naming another regional `*.google-analytics.com` host.

## 7. Google Map (click-to-load), fonts, other third parties

* **Map:** `contact.html` shows a placeholder and a **Load Google Map** button. **No iframe, request or cookie exists until the visitor presses it**
  (`assets/js/main.js` creates the iframe once, in the click handler). It shows the general **Bathgate, West Lothian** area
  (`https://maps.google.com/maps?q=Bathgate%2C+West+Lothian&z=12&output=embed`), never a business pin or street address. A plain
  "View Bathgate area on Google Maps" link is also provided. CSP `frame-src https://maps.google.com https://www.google.com` is needed only after the click.
* **Fonts:** Roboto (latin subset, one variable WOFF2, 43,136 bytes) is self-hosted at `site/assets/fonts/roboto-latin-var.woff2` with its
  **SIL Open Font License 1.1** (`OFL.txt`, Roboto Project Authors). Four `@font-face` rules (400/500/700/900) share the one file; `font-display: swap`;
  system fallbacks remain; one `<link rel="preload">` per page. **No request goes to fonts.googleapis.com or fonts.gstatic.com**; CSP `style-src` and
  `font-src` are `'self'` only (check 18 enforces this).
* The only other external link a visitor can trigger is the Google reviews link on Home ("See More Google Reviews") and `wa.me` (WhatsApp) links.

## 8. Business information rules

* **Service-area business.** The only public location is **Bathgate, West Lothian**. **No street address, postcode or Plus Code appears anywhere**
  in `site/`, `backend/` or the info file (check 18). The address `39 S Loch Park` was removed on the owner's instruction — **do not add it back.**
  (It still exists in old git history of this public repository — see section 13.)
* **Contact channels:** phone **0131 202 0289**; WhatsApp **07448 427154** (`https://wa.me/447448427154`); email **info@sfrmotors.co.uk**.
* **Company disclosure** (footer, every page): SFR Motors Ltd, registered in England and Wales, company number **15819240**, **Registered office:
  143 Beverley Drive, Edgware, England, HA8 5NH** — shown only in the footer legal line and the Privacy Policy, never as a service location, in
  structured data, or as a map destination.
* No placeholder social links: Facebook/Instagram icons were removed. Add them back only when the owner supplies confirmed URLs.
* **Never invent** prices, response times, review counts, certifications, guarantees, service or safety claims, or business details.
  `priceRange` must stay absent. Home `aggregateRating` stays **ratingValue 4.9 / reviewCount 282** (owner-verified); change only with a new owner-verified figure.
* Structured data: `AutomotiveBusiness` with `address` limited to locality/region/country (no street), `areaServed` list, 24/7 hours as already approved;
  the Contact page also lists the phone and WhatsApp `ContactPoint`s. Every URL in JSON-LD must be absolute and on `https://sfrmotors.co.uk/` (check 17).

## 9. Images and privacy

* Only owner-approved photographs are used (approved archive `SFR-website-gallery-updated.zip` plus photographs already in the repository). **No gallery or
  carousel. Never generate or fabricate photographs.**
* **Customer vehicle registrations must be unreadable.** SFR's own company-van registration (LN19 UHR) may be visible. Any background plate is blurred
  before export. Check every new photo before committing.
* The orange SFR van photograph was confirmed by the owner to be a genuine company-van photo. Its source copies carried a small four-point "sparkle" mark;
  the site uses cropped versions without it (`about-van-clean-*`, `home-about-van-*`). Do not reintroduce the source files as-is.
* Images are AVIF + WebP (`<picture>`), explicit width/height, lazy below the fold; the LCP hero image uses `fetchpriority="high"`.
  `verify` fails if an image file is not referenced anywhere.

## 10. SEO, GEO and robots decisions

* One H1 per page, unique titles/descriptions, canonical URLs on the production domain, Open Graph tags, sitemap, JSON-LD.
* `robots.txt`: `User-agent: *` **Allow: /** (normal search crawling and rendering assets allowed); **`OAI-SearchBot` explicitly allowed** (ChatGPT Search
  discovery); **`GPTBot` explicitly `Disallow: /`** (model training; independent of ChatGPT Search). CloudFront has no WAF/bot rule that blocks crawlers.
* Important information is plain HTML (not JavaScript dependent). Do not add fake reviews, keyword stuffing or "AI optimisation" copy.
* `/broxburn/` and `mobile-tyre-fitting-broxburn.html` are two different approved pages; both are linked from Home -> Areas We Cover and both are in the sitemap.

## 11. AWS design (nothing has been created)

Defined in `infra/template.yaml` (CloudFormation); deploy script `infra/deploy-site.sh`; OIDC role `infra/github-oidc.yaml`; workflow `.github/workflows/deploy.yml`.

* **S3:** private, Block Public Access on, SSE-S3, **versioning on** (90-day noncurrent expiry), Origin Access Control only.
* **CloudFront:** HTTPS only (TLS 1.2+), HTTP/2 + 3, `Compress: true`, `DefaultRootObject index.html`, viewer-request **LegacyRedirectFunction**
  (redirects, pretty-path rewrites, `/index.html` -> `/`, www -> apex), response headers policy (HSTS, nosniff, DENY framing, referrer policy, permissions policy,
  CSP), custom 403/404 -> `/404.html` (status 404), cache policies (HTML 5 min; `/assets/*` 1 year immutable; content-hashed CSS/JS).
* **ACM:** certificate in **us-east-1** covering the apex **and** `www`. Parameters: `DomainName`, `AcmCertificateArn`, `IncludeWww` (default `true`).
* **Route 53 (approved):** domain **registration stays at Hostinger**; DNS management moves to Route 53 at deployment time; Alias records for apex and `www`;
  every existing record (especially e-mail) copied and verified first; exact nameserver/traffic rollback in the runbook. Nothing has been changed yet.
* **Deploy script:** builds, syncs `assets/` (no `--delete`, so cached pages never lose their old hashed CSS/JS), syncs `*.html` (incl. `404.html`),
  robots/sitemap/favicon, then invalidates `/`, `/*.html`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`. Check `content-type` of `.woff2`, `.avif`, `.webp` after the first deploy.
* **GitHub Actions warning:** **a push/merge to `main` that touches `site/**` auto-deploys to S3.** Do not merge until the AWS stacks and repo variables exist and
  the owner has approved deployment.

## 12. Deployment authorisation rules

1. **Do not merge** `feature/seo-safe-migration` into `main` without the owner's explicit approval. Merging can trigger a deployment.
2. **Do not deploy** (no `aws`/`cloudformation`/`deploy-site.sh` commands, no DNS or nameserver change, no registrar change) without a **separate**, explicit approval
   for that action. One approval never covers the next.
3. No destructive git operations (`reset`, `clean`, force-push, rebase, amend) unless explicitly authorised. Do not open a Pull Request unless asked.
4. Never request or store credentials, tokens, customer IDs or personal data in the repository or in chat.
5. Preserve approved URLs, content, business details, SEO structure and structured data; do not redesign.

## 13. Known limitations and open items

* **The public repository's git history still contains the removed street address** (`39 S Loch Park`, `EH48 2QZ`, Plus Code) in earlier commits and in
  `SFR_Website_Info.txt` history. Removing it from history requires a history rewrite, which is destructive and needs the owner's decision.
* **Google Business Profile** may still show the address if it is configured that way; that is outside this repository (set it as a service-area business / hide the address there).
* Two Broxburn pages have the same H1 ("Mobile Tyre Fitting Broxburn") and near-identical purpose — a duplicate-content risk (owner decision).
* `aggregateRating` 4.9 / 282 is owner-supplied and not verified by the code; keep it truthful and current (Google may not show self-served review rich results).
* The "See More Google Reviews" link on Home searches the business name in Google Maps; the Google listing itself controls what address (if any) it shows.
* The CTA background photo is 1,920 px wide; it is upscaled about 1.33x on screens wider than about 2,500 px.
* `backend/` (SES email Lambda) is unused legacy code; its test needs `@aws-sdk/client-ses`, which is not installed. Root-level `*-section.html` files are legacy WordPress snippets.
* Privacy Policy "Effective Date" is a manual date; it does not state fixed retention periods (none were confirmed) and does not name a Data Protection Officer.
* Lab performance numbers only (no Lighthouse installed, no field data). Real-user Core Web Vitals exist only after live traffic.
* Page titles over 60 characters on some blog posts were left as approved.
* Sitemap `lastmod` dates are not automatically updated.

## 14. Tasks remaining before merge and deployment

- [ ] Owner decisions: history rewrite yes/no; duplicate Broxburn page; whether to apply the Home photo-frame style to the seven other `about` frames.
- [ ] Google Business Profile set as service-area business (outside the repo).
- [ ] Prepare AWS: ACM certificate (apex + www, us-east-1), stacks, repo variables, Route 53 zone with **all** records copied and verified (runbook C).
- [ ] Take the backups in runbook section A (WordPress, DNS export, e-mail baseline, Search Console verification method, DNSSEC check).
- [ ] Rehearse on the real hostname with `curl --resolve` (runbook B.4) and run the section F checks.
- [ ] Owner approval to merge; then separate owner approval to deploy; then Route 53 nameserver change; then website cutover (separate approval each).
- [ ] After go-live: post-deployment checks, Search Console sitemap submission, GA4 Realtime check, keep WordPress + Hostinger e-mail for at least 30 days.

## 15. Repository map

```
site/                     the website source (edit here)
  *.html                  57 pages + 404.html (identical header/footer blocks; footer holds the company disclosure and Cookie settings button)
  assets/css/main.css     one stylesheet; assets/js/main.js (nav, click-to-load map, quote form), analytics.js (consent + GA4), tyre-calculator.js
  assets/fonts/           roboto-latin-var.woff2 + OFL.txt
  assets/img/             AVIF/WebP images; robots.txt, sitemap.xml, favicon.ico
scripts/build.js          site/ -> dist/ (minify, content-hash CSS/JS)
scripts/verify.js         the 18-check quality gate
scripts/preview-edge.js   local CloudFront/CSP-modelling preview of dist/
infra/template.yaml       S3 + CloudFront + function + headers (CloudFormation)
infra/github-oidc.yaml    GitHub Actions deploy role;  infra/deploy-site.sh  manual/CI deploy script
infra/CUTOVER-RUNBOOK.md  backup / Route 53 cutover / rollback / post-deploy checks
.github/workflows/        deploy.yml (auto-deploys on push to main), quality-gate.yml (runs verify on push)
backend/, *-section.html, vercel.json, SFR_Website_Info.txt   legacy / reference material (not deployed)
dist/                     generated by the build (gitignored)
```

---

Checkpoint reference: content commit `4412584` on `feature/seo-safe-migration` (baseline `27bf898`). Nothing merged, deployed or changed in DNS.
