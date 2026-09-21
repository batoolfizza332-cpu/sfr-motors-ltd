# SFR Motors static website — project handover

This document lets a new developer (or a new AI assistant) continue the project **without any chat history**. It contains no
passwords, tokens or credentials, and none must ever be added to the repository.

**Merging this branch and deploying it to the live domain each need the owner's separate, explicit approval. Nothing has been merged or deployed to the live domain.** (A Vercel *Preview* for review exists; see section 2A.)

Companion documents: [`README.md`](README.md) (build, verify, hosting, analytics detail) and
[`infra/CUTOVER-RUNBOOK.md`](infra/CUTOVER-RUNBOOK.md) (backup, Route 53 cutover, rollback, post-deployment checks).

---

## 1. At a glance

| Item | Value |
|---|---|
| Project | Static replacement website for **SFR Motors Ltd**, a mobile tyre-fitting business (service-area business, Bathgate, West Lothian) |
| Live site today | `https://sfrmotors.co.uk` — **WordPress on Hostinger** (unchanged, still live) |
| Hosting plan (current, owner decision) | **Vercel** (one protected review Preview, for visual review only; state in section 2A) and **Hostinger** (the owner's existing hosting) as the intended **Production** host. See section 2A. |
| Previous plan (reference only) | Static site on **AWS S3 + CloudFront**, DNS on **AWS Route 53**. No usable AWS account exists; nothing was created. The AWS files stay in the repository as reference and must not be deleted without a later, explicit task. |
| Local path (Windows) | `C:\Users\batoo\Desktop\SFR Motors Website` |
| Repository | `batoolfizza332-cpu/sfr-motors-ltd` on GitHub (**Private** repository; confirmed by the owner and by `gh repo view`) |
| Working branch | `feature/seo-safe-migration` (not merged into `main`) |
| Checkpoint history | `27bf898` baseline -> `4412584` owner-approved corrections + this document -> `45107ba` records that hash -> `60de141` Vercel Preview checkpoint -> `e4e61b0` noindex hardening + deployment checker -> the Vercel documentation update (branch tip; `git rev-parse HEAD` is authoritative) |
| GA4 Measurement ID | `G-B9TY4GMXYT` (public by design; confirmed active by the owner) |
| Migration status | **Build finished and audited; NOT merged; NOT deployed to the live domain; no DNS, Hostinger or AWS change.** One protected Vercel **Preview** exists for review only (section 2A); no custom domain, no Production deployment, live site still WordPress. |

## 2. Architecture: live WordPress vs future static site

**Today:** visitors -> `sfrmotors.co.uk` -> Hostinger (LiteSpeed/PHP, WordPress, IP `82.29.191.9`). DNS is at Hostinger DNS
(`pixel.dns-parking.com`, `byte.dns-parking.com`). **E-mail (`info@sfrmotors.co.uk`) is hosted at Hostinger** (MX
`mx1.hostinger.com`, `mx2.hostinger.com`). `www` is a CNAME to the apex and 301s to the apex.

**Previous plan (AWS, reference only — see 2A for the current plan):** visitors -> Route 53 (Alias) -> CloudFront (HTTPS, compression, security headers, edge redirect function) -> private S3
bucket (Origin Access Control, Block Public Access). GitHub Actions can deploy with an OIDC role (no stored keys).

> **HOSTINGER E-MAIL WARNING.** Moving DNS to Route 53 will silently break company e-mail if any MX / SPF / DKIM / DMARC / TXT
> record is missed. Export and copy **every** record first, prove them identical with `dig` against both zones, and test e-mail before and
> after every change. Never edit the Hostinger DNS zone or cancel Hostinger hosting/e-mail. See the runbook, sections A, C, D, G.

## 2A. Current hosting plan: Vercel Preview + Hostinger Production

* **Vercel Preview (review only).** One Vercel project remains: `sfr-motors-preview` (Project ID `prj_GXRf5TeUa7jJk9PaF2gsy5DMWqMz`, personal/Hobby team `batoolfizza332-cpu`). It hosts a single review
  deployment of this branch so the owner and trusted reviewers can look at the site. It is **not** the launch. **No custom domain is attached to Vercel** (owner-stated): `sfrmotors.co.uk` and
  `www.sfrmotors.co.uk` must never be attached to it, and no Production deployment (`vercel --prod`) may be created from it. The live `sfrmotors.co.uk` is still the old WordPress site on Hostinger;
  DNS, the `main` branch and the live website have not been changed.
  **Current Vercel state (owner-reported from the Vercel Dashboard, 2026-09-20; the repository tooling has not re-checked it):**
  1. **The only deployment — a protected Preview:** `https://sfr-motors-preview-i1xangr2b-batoolfizza332-cpu.vercel.app`, Deployment ID `dpl_6YRuZrLQC7pcahxbZJT8dSeespys`, target `preview` (confirmed earlier with
     `vercel inspect`), status Ready, **Vercel Authentication enabled**. Unauthenticated requests get a 302 to the Vercel login, and that login response carries Vercel's own `X-Robots-Tag: noindex`.
     The **application response headers of this deployment (CSP, security headers, `X-Robots-Tag: noindex, nofollow`) are still UNVERIFIED** — they have never been read, because reading them needs an authenticated request.
  2. **Deleted by the owner in the Vercel Dashboard (permanent):**
     * The first, **accidental Production deployment** `dpl_J5w1LKoeiLP7CR31kJFfTA1i7AhR` at `https://sfr-motors-preview.vercel.app`. Vercel had assigned it to Production automatically because it was the project's first
       deployment (`--prod` was never requested). While it existed it was public and, when checked, carried no `X-Robots-Tag`; whether any search engine fetched it in that window is unknown.
     * The older, **separate Vercel project `sfr-motors-ltd`** (not the GitHub repository of the same name). Deleting it removed only its Vercel deployments, its `*.vercel.app` domains and its project settings;
       the GitHub repository and the live WordPress website were **not** affected.
  3. **Not done and not authorised:** no further Preview deployment and no redeploy has been made or approved. When one is authorised, pass `--target=preview` explicitly (a project's first deployment is otherwise
     assigned to Production automatically, which is what happened before).
  **Sharing:** the Preview is behind Vercel login, so reviewers need Vercel access granted by the owner; any shareable link or protection exception needs explicit owner approval each time.
  **Warning — `npx vercel curl` is NOT a read-only check.** On a protected deployment it calls `PATCH /v1/projects/<id>/protection-bypass` and generates a project-level *Protection Bypass for Automation* secret. This happened once
  (2026-09-20) for `sfr-motors-preview`; the owner then **removed that secret in the Vercel Dashboard** (the section is empty again). Vercel may expose such a secret to deployments as the system environment value
  `VERCEL_AUTOMATION_BYPASS_SECRET`; whether the remaining Preview holds a value is **unverified**, and any such value could remain until a redeploy replaces that deployment. **No redeploy is authorised yet.**
  **Never create a protection-bypass secret, a shareable link or any protection exception without explicit owner approval**, and never use `vercel curl` (or `--protection-bypass`) to get around Vercel Authentication.
* **Configuration:** `vercel.json` is **generated** from `infra/template.yaml` by `node scripts/vercel-config.js` (never edit it by hand): 301 redirects for every
  `/<file>.html` of a pretty page, the legacy WordPress URLs (15 original plus 17 historical location/page URLs, below) and `/mobile-tyre-fitting` (with/without trailing slash, the latter -> `/mobile-tyre-fitting.html`, its only indexable URL) and `/index.html` -> `/`; internal rewrites for the 32 pretty paths;
  the exact security headers and CSP of the CloudFront policy; 1-year immutable caching for `assets/` css/img/fonts and the hashed scripts, 1 hour for `robots.txt`,
  `sitemap.xml`, `favicon.ico`; `dist/404.html` for missing URLs (Vercel serves it with status 404). Vercel builds with `npm run build` and publishes `dist/`.
  `npm run verify` check 19 fails if `vercel.json` drifts from the template or routes any URL differently from the CloudFront Function. `www` -> apex does not apply
  on a `*.vercel.app` Preview (there is no domain), so it is not modelled.
* **The review copy is kept out of search engines and never talks to production services.** `vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every response; it is added only in
  `scripts/vercel-config.js`, and `infra/template.yaml` / the real hosting must **never** carry it (verify check 19 enforces both). For a **publicly reachable** review copy,
  `node scripts/check-vercel-deployment.js https://<name>.vercel.app` (plain GETs on 10 URLs, redirects not followed, no cookies/tokens/secrets; refuses everything that is not an https `*.vercel.app` address) verifies the
  application response headers. On a **protected** deployment it prints "Deployment is protected; application headers remain unverified." and exits 3 — that is neither a pass nor a failure, and it must not be worked
  around with a bypass. The current Preview was built with this header configured, but it is protected, so its application headers (including this one) are unverified. Google Analytics loads only on `sfrmotors.co.uk` / `www.sfrmotors.co.uk`, and the quote form
  opens WhatsApp only there (sections 6 and 8A). Canonical URLs, the sitemap and `robots.txt` are unchanged and keep pointing at `https://sfrmotors.co.uk/`.
* **Hostinger (intended Production).** The Hostinger deployment steps (how the static `dist/` replaces WordPress, how redirects/rewrites/headers/404 are reproduced there,
  what happens to `www`, e-mail and rollback) are **not written yet** and no Hostinger detail may be assumed or invented. That is a separate task; the redirect/route/header tables in
  `infra/template.yaml` and `vercel.json` are the specification to reproduce. **Do not touch DNS, Hostinger or WordPress without separate explicit owner permission.**
* **Git pushes and Vercel:** the Preview project is **not** linked to GitHub (linking would make every push deploy, and a later merge to `main` would create a Production deployment on
  the `*.vercel.app` address). Preview deployments are created deliberately from a pushed commit.

## 3. What has been done (summary)

* Static site built from the approved WordPress audit: **56 sitemap pages** (32 on pretty paths) + a dedicated `404.html`.
* All pretty-path pages use root-relative assets; all 1,817 internal links resolve; no local asset 404s; no nested asset paths.
* Root `/favicon.ico` from the approved logo; multi-size ICO.
* Accessibility: contrast fixes, keyboard focus, closed mobile menu no longer focusable, 44 px mobile targets, breadcrumb targets.
* Approved photographs only (no gallery/carousel); customer registrations unreadable (section 9).
* **Cookie consent + GA4** (section 6) with equal Accept / Reject and withdrawal.
* Home "Stranded With a Tyre Problem?" and "About SFR Motors" sections repaired (scoped `--photo` / `--framed` modifiers).
* Pre-deployment audit fixes: CloudFront Function shrunk under the AWS 10 KB / 128-character limits, real `404.html`, `www` -> apex, watermark removed
  from seven pages' van photo, JSON-LD URLs made absolute, deploy script no longer deletes old assets mid-deploy, unused API origin removed from CSP.
* `priceRange` removed from structured data (no price classification is approved). `aggregateRating` 4.9 / 282 is kept.
* **Vercel Preview checkpoint:** generated `vercel.json` (section 2A); Analytics and the WhatsApp form restricted to the production hostnames (sections 6 and 8A); browser test suite
  brought into the repo (`scripts/browser-tests/`) with the stale Map/robots expectations corrected; documentation drift fixed (Private repository, current hosting plan).
* **Owner review corrections (after viewing the protected Preview):** new Home hero photo (Audi + SFR van, no "NEXT DAY SERVICE" wording; the old van hero was removed);
  a real photo in the Trailer & Caravan hero; one shared framed-photo component for every `sfr-about` image (the image now fills its frame exactly);
  a larger header logo/name lockup (the menu collapses to a button below 1000px); all repeated "Get A Quote" / "Get A Free Quote" buttons replaced by **Call Now**
  or **WhatsApp Us** using the existing verified links (the quote form and its own submit button are unchanged; `verify` check 18 fails if a quote button returns);
  the incorrect London registered-office address removed (section 8).
* **Owner-approved corrections (earlier checkpoint):** placeholder Facebook/Instagram links removed; click-to-load Google Map; self-hosted Roboto;
  `robots.txt` (OAI-SearchBot allowed, GPTBot disallowed); `/index.html` -> `/` 301; `/broxburn/` linked from Areas We Cover; service-area address
  policy (no street address anywhere); company disclosure in the footer; WhatsApp 07448 427154 as a contact channel; rewritten Privacy Policy; Route 53 runbook.

## 4. URLs and routing rules (do not change without the owner)

* **Pretty paths** (32 pages, served from differently named or same-named `.html` files) and their canonicals are defined once in the CloudFront
  Function tables in `infra/template.yaml` (`special` = slug -> file where names differ, `same` = slug equals file name, `legacy` = old WordPress URLs),
  and mirrored by `CANONICAL_URL_OVERRIDES` in `scripts/verify.js`. Check 16 keeps them in sync.
  Examples: `/about-us/` -> `about.html`, `/contact-us/` -> `contact.html`, `/24-7-mobile-tyre-replacement/` -> `emergency-tyre-change.html`,
  `/broxburn/` -> `broxburn.html`, and 25 pages where slug = file name (`/blog/`, `/how-to-change-a-tyre/`, ...).
* **Redirects (301):** every `/<file>.html` of a pretty page -> its pretty URL; 15 legacy WordPress URLs (with/without trailing slash) -> their new pages; 17 historical WordPress URLs that the migration audit keeps ("Keep / Recreate at exact URL") but whose page is a flat `.html` here -> 301 -> that page's `.html` canonical: `/mobile-tyre-fitting-<town>/` for airdrie, bathgate, boness, edinburgh, falkirk, harthill, linlithgow, livingston, shotts, west-calder, west-lothian, whitburn, wishaw, plus `/mobile-tyre-fitting-in-addiewell/` -> `/mobile-tyre-fitting-addiewell.html`, `/mobile-locking-wheel-nut-removal/`, `/privacy-policy/`, `/trade-fleet-tyre-services/` (one hop, also from `www`; verify check 26). **Not redirected, owner decision needed:** `/our-tyre-range/` (no page on this branch) and the audit's blog URLs that were never built here; `/mobile-tyre-fitting` and `/mobile-tyre-fitting/` -> `/mobile-tyre-fitting.html` (one hop; verify check 23); `/mobile-tyre-fitting-broxburn.html` -> `/broxburn/` (owner decision: `/broxburn/` is the only Broxburn page; the duplicate `.html` location page was deleted; one hop, also from `www`; verify check 24);
  **`/index.html` -> `/`**; `www.<domain>` -> apex (single hop, path and query kept). No internal link points at a redirecting URL (the four links to blog `.html` posts were normalised to their canonical pretty URLs; verify check 2 now fails on a link to a pretty page's `.html` form).
* **Home is `/`.** Nothing may link to `/index.html` (verify check 2). Flat pages (e.g. `/services.html`, `/privacy-policy.html`) keep their `.html` URL.
* **404:** CloudFront serves `/404.html` with status 404 for any missing URL (it is `noindex`, has no canonical, uses root-relative assets).
* The CloudFront Function must stay **under 10,240 bytes** and its comment **under 128 characters** (AWS hard limits) — check 16 enforces this.
* Sitemap: `site/sitemap.xml` lists the 56 indexable pages using canonical URLs.

## 5. Commands

Requires Node 18+ (developed on Node 26). Do not install new dependencies without the owner's approval (`clean-css`, `html-minifier-terser`, `terser` are the only ones).

```bash
npm install                          # only if node_modules is missing
npm run build                        # site/ -> dist/ (minified, content-hashed CSS/JS)
npm run verify                       # build + 25 quality checks; must print QUALITY GATE: PASSED
git diff --check                     # whitespace / conflict markers
node scripts/preview-edge.js 4174    # local production preview that models CloudFront redirects, 404, compression and the exact CSP
node scripts/vercel-config.js        # regenerate vercel.json from infra/template.yaml (--check verifies it is in sync)
node scripts/check-vercel-deployment.js https://<name>.vercel.app   # plain GETs, publicly reachable *.vercel.app only; a protected deployment reports "unverified" (exit 3), never a pass
npm run test:browser                 # real-browser suite (Chrome/Edge, Node 22+): all pages at 1280x720 + 375x812, consent/Analytics, Map, forms, 404, redirects
```

`npm run verify` (see `scripts/verify.js`) covers: build; internal links/anchors (and no `/index.html` links, no `href="#"`, no orphan pages); one H1;
titles/descriptions; canonicals; images (alt, size, no unreferenced files); sitemap; placeholder text; pretty-path asset paths; favicon;
consent + Analytics (15); CloudFront Function limits/routing/404 (16); JSON-LD URLs (17); the owner-approved corrections (18); `vercel.json` in sync and routing-equivalent to CloudFront (19);
production-hostname guards for Analytics and the WhatsApp form, run in a sandbox on production, localhost, `*.vercel.app` and look-alike hosts (20, `scripts/host-guard-tests.js`); the deployed-headers checker's mock tests
(21, `scripts/check-vercel-deployment.test.js`: complete headers pass, missing/weakened noindex fail, a login redirect is "protected/unverified", non-`*.vercel.app` hosts are refused; no network).
Browser-level testing (`npm run test:browser`, `scripts/browser-tests/`) is a zero-dependency Chrome DevTools-Protocol harness; it is **not** part of `verify`. Google is stubbed/blocked inside the browser and
`https://sfrmotors.co.uk` is answered from the local server, so nothing reaches Google, WhatsApp or the live domain. Last full run (before the Broxburn consolidation, when the sitemap had 57 pages): sweep 57/57 pages x 2 viewports, consent 156/156, functional 57/57, approved 76/76.

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
* **Google Analytics loads only on `sfrmotors.co.uk` and `www.sfrmotors.co.uk`** (`IS_PRODUCTION_HOST` in `analytics.js`). On `localhost`, every `*.vercel.app` Preview and any other host it is never loaded, **even after the
  visitor presses Accept**; the consent banner, the stored `sfr_consent` choice and withdrawal still work there, so the consent UI can be reviewed on a Preview without touching the live GA4 property.
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
  (It still exists in old git history of this Private repository — see section 13.)
* **Contact channels:** phone **0131 202 0289**; WhatsApp **07448 427154** (`https://wa.me/447448427154`); email **info@sfrmotors.co.uk**.
* **Company line** (footer, every page): "SFR Motors Ltd. Registered in England and Wales, company number **15819240**." — **no address.** The London
  registered-office address (Beverley Drive, Edgware) that used to follow it was **removed from all 58 pages and the Privacy Policy on the owner's
  instruction** (2026-09-20: the owner said it is incorrect); `verify` check 18 fails if `Beverley` / `Edgware` / `HA8 5NH` reappears anywhere in `site/`.
  Open point for the owner: a company website is normally expected to state the registered office address; provide the correct one and it can be shown again.
* No placeholder social links: Facebook/Instagram icons were removed. Add them back only when the owner supplies confirmed URLs.
* **Never invent** prices, response times, review counts, certifications, guarantees, service or safety claims, or business details.
  `priceRange` must stay absent. Home `aggregateRating` stays **ratingValue 4.9 / reviewCount 282** (owner-verified); change only with a new owner-verified figure.
* Structured data: `AutomotiveBusiness` with `address` limited to locality/region/country (no street), `areaServed` list, 24/7 hours as already approved;
  the Contact page also lists the phone and WhatsApp `ContactPoint`s. Every URL in JSON-LD must be absolute and on `https://sfrmotors.co.uk/` (check 17).

## 8A. Forms

* There are only two forms: the **tyre-size calculator** (client-side arithmetic, nothing is sent) and the **quote / contact form** (`#quote-form-el`, on Home and Contact). There is **no backend, API, e-mail or database
  endpoint**: a valid quote form builds a message and opens `https://wa.me/447448427154?text=...` in a new tab, and the visitor must still press Send in WhatsApp.
* **Only the production hostnames open WhatsApp** (`PRODUCTION_HOST` in `main.js`, identical to the Analytics pattern; `verify` check 20 enforces the match). On a Vercel Preview, `localhost` or any other host the form validates as usual
  but shows "Preview copy: nothing was sent and WhatsApp was not opened...", keeps the entries, does not open WhatsApp and fires no analytics event. Limitation: reviewers cannot see the WhatsApp hand-off on a Preview;
  it behaves as designed only on the live hostnames.
* The honeypot / 1.5-second bot check is unchanged. `mailto:` and `tel:` links are ordinary user-initiated links.

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
* `/broxburn/` is the only Broxburn page (owner decision): the original WordPress URL, linked once from Home -> Areas We Cover and listed once in the sitemap. The duplicate `mobile-tyre-fitting-broxburn.html` was deleted and 301-redirects to it (verify check 24).
* **Location-to-location links (owner-approved, Medium Issue #3):** 22 plain-town-name links inside the "Across <town> And The Surrounding Area" paragraph (`sfr-loc-areas-heading`) of the West Lothian hub, Bathgate, Whitburn, Armadale, Blackburn, Harthill, Shotts, Wishaw, West Calder, Addiewell and Kirkliston, each on a neighbouring town that the existing copy already names. No wording was changed; Broxburn is only ever linked as `/broxburn/`. Airdrie, Bo'ness and Kirkliston still have only the Home link as an inbound body link (no honest existing sentence; new wording needs owner approval). Verify check 25 protects the link map and rejects keyword-phrase anchors.

## 11. AWS design (previous plan, reference only — nothing has been created)

This is the earlier plan, superseded by section 2A; it is kept so the redirect/route/header specification is not lost (`vercel.json` is generated from it). Do **not** delete these files without a later, explicit task. Defined in `infra/template.yaml` (CloudFormation); deploy script `infra/deploy-site.sh`; OIDC role `infra/github-oidc.yaml`; workflow `.github/workflows/deploy.yml`.

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
6. Vercel: Preview deployments only, always with an explicit `--target=preview`. Never `vercel --prod`, never a Production target, never attach `sfrmotors.co.uk` / `www.sfrmotors.co.uk`, never change Deployment Protection to public without the owner, never link the Preview project to GitHub without the owner, never create a protection-bypass secret / shareable link / protection exception without explicit owner approval, and never run `vercel curl` against a protected deployment (it creates a bypass secret).

## 13. Known limitations and open items

* **The repository is Private, but its git history still contains the removed street address** (`39 S Loch Park`, `EH48 2QZ`, Plus Code) in earlier commits and in
  `SFR_Website_Info.txt` history. Anyone with repository access (and any Vercel/GitHub integration given access) can read it. Removing it from history requires a history rewrite, which is destructive and needs the owner's decision.
* **Google Business Profile** may still show the address if it is configured that way; that is outside this repository (set it as a service-area business / hide the address there).
* `aggregateRating` 4.9 / 282 is owner-supplied and not verified by the code; keep it truthful and current (Google may not show self-served review rich results).
* The "See More Google Reviews" link on Home searches the business name in Google Maps; the Google listing itself controls what address (if any) it shows.
* The CTA background photo is 1,920 px wide; it is upscaled about 1.33x on screens wider than about 2,500 px.
* `backend/` (SES email Lambda) is unused legacy code; its test needs `@aws-sdk/client-ses`, which is not installed. Root-level `*-section.html` files are legacy WordPress snippets.
* Privacy Policy "Effective Date" is a manual date; it does not state fixed retention periods (none were confirmed) and does not name a Data Protection Officer.
* Lab performance numbers only (no Lighthouse installed, no field data). Real-user Core Web Vitals exist only after live traffic.
* Page titles over 60 characters on some blog posts were left as approved.
* **Article dates are deferred (owner decision).** The 22 Article JSON-LD entries carry no `datePublished` / `dateModified` and the pages show no dates. The WordPress export does hold dates for all 22, but they belong to the original WordPress text, which has been substantially rewritten (only 0-4% of the current wording is shared with it), and 20 of the WordPress `post_modified` values are one bulk save on 2026-08-25. Git commit dates are migration dates, not publication dates. Add Article dates only once reliable dates for the current content exist; do not use WordPress or Git dates as a substitute.
* Sitemap `lastmod` dates are not automatically updated.

## 14. Tasks remaining before merge and deployment

- [ ] Owner decisions: history rewrite yes/no; whether to apply the Home photo-frame style to the seven other `about` frames.
- [ ] Google Business Profile set as service-area business (outside the repo).
- [ ] Review the history-rewrite question (owner decision above).
- [ ] Owner review of the protected Vercel Preview (visual check on desktop and phone). The next Preview deployment is not yet authorised; its application headers are still unverified.
- [ ] Write the **Hostinger** deployment documentation (how `dist/` replaces WordPress; redirects, rewrites, headers/CSP and 404 on Hostinger; `www`; e-mail; backup and rollback). Do not assume Hostinger capabilities: verify them with the owner first.
- [ ] Take the backups in runbook section A (WordPress, e-mail baseline, Search Console verification method); the AWS/Route 53 steps in the runbook are the previous plan.
- [ ] Owner approval to merge; then separate owner approval to deploy to the live domain (each separately).
- [ ] After go-live: post-deployment checks, Search Console sitemap submission, GA4 Realtime check, keep WordPress + Hostinger e-mail for at least 30 days.

## 15. Repository map

```
site/                     the website source (edit here)
  *.html                  56 pages + 404.html (identical header/footer blocks; footer holds the company disclosure and Cookie settings button)
  assets/css/main.css     one stylesheet; assets/js/main.js (nav, click-to-load map, quote form), analytics.js (consent + GA4), tyre-calculator.js
  assets/fonts/           roboto-latin-var.woff2 + OFL.txt
  assets/img/             AVIF/WebP images; robots.txt, sitemap.xml, favicon.ico
scripts/build.js          site/ -> dist/ (minify, content-hash CSS/JS)
scripts/verify.js         the 21-check quality gate
scripts/preview-edge.js   local CloudFront/CSP-modelling preview of dist/ (also exports start() for the browser tests)
scripts/vercel-config.js  generates vercel.json from infra/template.yaml (+ a model of Vercel's routing order used by verify check 19)
scripts/host-guard-tests.js  sandbox tests for the production-hostname guards (verify check 20)
scripts/check-vercel-deployment.js (+ .test.js)  headers checker for a PUBLIC *.vercel.app copy; mock tests are verify check 21
scripts/browser-tests/    real-browser suite (npm run test:browser): cdp.js driver + sweep / consent / functional / approved tests
vercel.json               GENERATED Vercel Preview config (do not hand-edit; run scripts/vercel-config.js)
infra/template.yaml       previous AWS plan: S3 + CloudFront + function + headers (CloudFormation); still the source of the routing tables, CSP and headers
infra/github-oidc.yaml    GitHub Actions deploy role;  infra/deploy-site.sh  manual/CI deploy script
infra/CUTOVER-RUNBOOK.md  backup / Route 53 cutover / rollback / post-deploy checks
.github/workflows/        deploy.yml (auto-deploys on push to main), quality-gate.yml (runs verify on push)
backend/, *-section.html, SFR_Website_Info.txt   legacy / reference material (not deployed)
dist/                     generated by the build (gitignored)
```

---

Checkpoint reference: `feature/seo-safe-migration`; earlier checkpoint content commit `4412584`, Vercel Preview checkpoint on top of `45107ba`. Nothing merged, nothing deployed to the live domain, no DNS change.
