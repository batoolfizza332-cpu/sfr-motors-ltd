# SFR Motors static website — project handover

This document lets a new developer (or a new AI assistant) continue the project **without any chat history**. It contains no
passwords, tokens or credentials, and none must ever be added to the repository.

Companion documents: [`README.md`](README.md) (commands, workflows, repository map) and
[`infra/HOSTINGER-DEPLOY.md`](infra/HOSTINGER-DEPLOY.md) (how a change goes live, one-time setup).

---

## 1. At a glance

| Item | Value |
|---|---|
| Project | Static website for **SFR Motors Ltd**, a mobile tyre-fitting business (service-area business, Bathgate, West Lothian) |
| Live site | `https://sfrmotors.co.uk`, served by **Hostinger** (LiteSpeed). The live site matches `main` (checked daily by the Daily SEO check). |
| Hosting | **GitHub + Hostinger only.** No Vercel, AWS or other hosting is used; the old Vercel projects were deleted and no AWS account exists. Do not set up or connect to any other host. |
| How a change goes live | merge to `main` -> `.github/workflows/deploy-hostinger.yml` builds, checks, backs up, uploads over SSH (no deletes), checks the live site and rolls back on failure. It needs one-time Hostinger secrets (`infra/HOSTINGER-DEPLOY.md` section 2); until they exist it uploads nothing. |
| DNS and e-mail | DNS at Hostinger (`pixel.dns-parking.com`, `byte.dns-parking.com`), apex IP `82.29.191.9`; `www` 301s to the apex. **E-mail `info@sfrmotors.co.uk` is hosted at Hostinger** (MX `mx1.hostinger.com`, `mx2.hostinger.com`). Never change DNS or e-mail records from this project. |
| Repository | `batoolfizza332-cpu/sfr-motors-ltd` on GitHub (Private) |
| Local path (Windows) | `C:\Users\batoo\Desktop\SFR Motors Website` |
| GA4 Measurement ID | `G-B9TY4GMXYT` (public by design) |

## 2. What the site contains

* Static site built from the approved WordPress audit: **76 sitemap pages** (pretty paths and flat `.html` pages) + a dedicated `404.html`.
* Audit-approved articles restored at their exact WordPress URLs, with unverified business claims removed; `/our-tyre-range/` is a neutral guide that says nothing about what SFR stocks or charges.
* Root-relative assets on every page; all internal links resolve; root `/favicon.ico` from the approved logo.
* Accessibility: contrast, keyboard focus, closed mobile menu not focusable, 44 px mobile targets.
* Approved photographs only (no gallery/carousel); customer registrations unreadable (section 9).
* **Cookie consent + GA4** (section 6) with equal Accept / Reject and withdrawal.
* Quote/contact form opens WhatsApp; there is no backend (section 8A).
* Owner-approved corrections: placeholder social links removed; click-to-load Google Map; self-hosted Roboto; `robots.txt` (OAI-SearchBot allowed, GPTBot disallowed);
  `/index.html` -> `/` 301; no street address; company line in the footer; WhatsApp 07448 427154; rewritten Privacy Policy; all "Get A Quote" buttons replaced by
  **Call Now** / **WhatsApp Us**; the incorrect London registered-office address removed; no fleet-contract claims; `aggregateRating` removed (section 8).

## 4. URLs and routing rules (do not change without the owner)

* **Pretty paths** (73 pages, served from differently named or same-named `.html` files) and their canonicals are defined once in the routing
  function tables in `infra/template.yaml` (`special` = slug -> file where names differ, `same` = slug equals file name, `legacy` = old WordPress URLs),
  and mirrored by `CANONICAL_URL_OVERRIDES` in `scripts/verify.js`. Check 16 keeps them in sync.
  Examples: `/about-us/` -> `about.html`, `/contact-us/` -> `contact.html`, `/24-7-mobile-tyre-replacement/` -> `emergency-tyre-change.html`,
  `/broxburn/` -> `broxburn.html`, and the pages where slug = file name (`/blog/`, `/how-to-change-a-tyre/`, `/mobile-tyre-fitting-whitburn/`, `/privacy-policy/`, ...); `/mobile-tyre-fitting-in-addiewell/` -> `mobile-tyre-fitting-addiewell.html`.
* **Redirects (301):** every `/<file>.html` of a pretty page -> its pretty URL; 15 legacy WordPress URLs (with/without trailing slash) -> their new pages; the 17 audit-kept WordPress URLs are **served directly (200) at their exact URL** and their old `/<file>.html` 301s to them (`/mobile-tyre-fitting-<town>/` for airdrie, bathgate, boness, edinburgh, falkirk, harthill, linlithgow, livingston, shotts, west-calder, west-lothian, whitburn, wishaw; `/mobile-tyre-fitting-in-addiewell/` (file `mobile-tyre-fitting-addiewell.html`); `/mobile-locking-wheel-nut-removal/`; `/privacy-policy/`; `/trade-fleet-tyre-services/`; both with and without the trailing slash; verify check 26). the two approved audit consolidations 301 straight into their restored survivors (`/tyre-lifespan-mobile-tyre-repair-guide/` -> `/tyre-lifespan/`, `/behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use/` -> `/what-tools-do-mobile-tyre-fitters-use/`; verify check 26). Two audit "Keep at exact URL" rows are deliberately 301s by **explicit owner instruction of 2026-09-18** (each after a read-only comparison of the finished text with the existing pages; verify check 26 covers them): `/tyre-puncture-repair-near-me-west-lothian/` -> `/mobile-tyre-repair-edinburgh-west-lothian/` (same provider-selection checklist, near-verbatim, and the destination also covers West Lothian) and `/tyres-bathgate-guide/` -> `/van-tyre-replacement-services/` (van-tyre-specific text that repeats the destination's "signs it's time for a new tyre" section). Neither has a page, sitemap entry or blog card. Restoring either would need a new owner decision plus text that is not a duplicate. all eight previously pending audit URLs are now served at their exact URL (below; `/our-tyre-range/` needs owner review before deployment, section 14); `/mobile-tyre-fitting` and `/mobile-tyre-fitting/` -> `/mobile-tyre-fitting.html` (one hop; verify check 23); `/mobile-tyre-fitting-broxburn.html` -> `/broxburn/` (owner decision: `/broxburn/` is the only Broxburn page; the duplicate `.html` location page was deleted; one hop, also from `www`; verify check 24);
  **`/index.html` -> `/`**; `www.<domain>` -> apex (single hop, path and query kept). No internal link points at a redirecting URL (the four links to blog `.html` posts were normalised to their canonical pretty URLs; verify check 2 now fails on a link to a pretty page's `.html` form).
* **Home is `/`.** Nothing may link to `/index.html` (verify check 2). Flat pages (e.g. `/services.html`, `/mobile-tyre-fitting.html`) keep their `.html` URL.
* **Scripts:** `main.js`, `analytics.js` and `tyre-calculator.js` are all content-hashed by the build (`tyre-calculator.<hash>.js`) and cached as immutable for a year by the generated Hostinger `.htaccess`; the `.htaccess` also serves `.js` as `text/javascript` (some hosts default to the legacy `application/x-javascript`). Whether Hostinger honours that `AddType` is unverified until a real deployment. Verify check 27 protects all of this.
* **404:** the Hostinger `.htaccess` serves `/404.html` with status 404 for any missing URL (it is `noindex`, has no canonical, uses root-relative assets).
* The routing function in `infra/template.yaml` is kept compact (check 16 holds it under 10,240 bytes, a limit from the earlier hosting plan).
* Sitemap: `site/sitemap.xml` lists the 76 indexable pages using canonical URLs.

## 5. Commands

Requires Node 18+ (developed on Node 26). Do not install new dependencies without the owner's approval (`clean-css`, `html-minifier-terser`, `terser` are the only ones).

```bash
npm install                          # only if node_modules is missing
npm run build                        # site/ -> dist/ (minified, content-hashed CSS/JS)
npm run verify                       # build + 25 quality checks; must print QUALITY GATE: PASSED
git diff --check                     # whitespace / conflict markers
node scripts/preview-edge.js 4174    # local preview of dist/ with the site's redirects, 404, compression and the exact CSP
npm run check:live                   # compare the live site with this build (read-only)
npm run test:browser                 # real-browser suite (Chrome/Edge, Node 22+): all pages at 1280x720 + 375x812, consent/Analytics, Map, forms, 404, redirects
```

`npm run verify` (see `scripts/verify.js`) covers: build; internal links/anchors (and no `/index.html` links, no `href="#"`, no orphan pages); one H1;
titles/descriptions; canonicals; images (alt, size, no unreferenced files); sitemap; placeholder text; pretty-path asset paths; favicon;
consent + Analytics (15); routing function limits/routing/404 (16); JSON-LD URLs (17); the owner-approved corrections (18); every routed URL resolves and no noindex in the rules (19);
production-hostname guards for Analytics and the WhatsApp form, run in a sandbox on production, localhost, preview-style and look-alike hosts (20, `scripts/host-guard-tests.js`); the Hostinger `.htaccess` routes every URL like the rules (22); Broxburn (24); location links (25); historical URLs (26); script caching and MIME (27).
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
* **Google Analytics loads only on `sfrmotors.co.uk` and `www.sfrmotors.co.uk`** (`IS_PRODUCTION_HOST` in `analytics.js`). On `localhost`, any preview copy and any other host it is never loaded, **even after the
  visitor presses Accept**; the consent banner, the stored `sfr_consent` choice and withdrawal still work there, so the consent UI can be reviewed on a local copy without touching the live GA4 property.
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
  in `site/` or the info file (check 18). The address `39 S Loch Park` was removed on the owner's instruction — **do not add it back.**
  (It still exists in old git history of this Private repository — see section 13.)
* **Contact channels:** phone **0131 202 0289**; WhatsApp **07448 427154** (`https://wa.me/447448427154`); email **info@sfrmotors.co.uk**.
* **Company line** (footer, every page): "SFR Motors Ltd. Registered in England and Wales, company number **15819240**." — **no address.** The London
  registered-office address (Beverley Drive, Edgware) that used to follow it was **removed from all 58 pages and the Privacy Policy on the owner's
  instruction** (2026-09-20: the owner said it is incorrect); `verify` check 18 fails if `Beverley` / `Edgware` / `HA8 5NH` reappears anywhere in `site/`.
  Open point for the owner: a company website is normally expected to state the registered office address; provide the correct one and it can be shown again.
* No placeholder social links: Facebook/Instagram icons were removed. Add them back only when the owner supplies confirmed URLs.
* **Never invent** prices, response times, review counts, certifications, guarantees, service or safety claims, or business details.
  `priceRange` and `aggregateRating` must stay absent (owner decision 2026-10-04: Google shows stars from the Business Profile; check 18 enforces it).
* Structured data: `AutomotiveBusiness` with `address` limited to locality/region/country (no street), `areaServed` list, 24/7 hours as already approved;
  the Contact page also lists the phone and WhatsApp `ContactPoint`s. Every URL in JSON-LD must be absolute and on `https://sfrmotors.co.uk/` (check 17).

## 8A. Forms

* There are only two forms: the **tyre-size calculator** (client-side arithmetic, nothing is sent) and the **quote / contact form** (`#quote-form-el`, on Home and Contact). There is **no backend, API, e-mail or database
  endpoint**: a valid quote form builds a message and opens `https://wa.me/447448427154?text=...` in a new tab, and the visitor must still press Send in WhatsApp.
* **Only the production hostnames open WhatsApp** (`PRODUCTION_HOST` in `main.js`, identical to the Analytics pattern; `verify` check 20 enforces the match). On `localhost` or any other host the form validates as usual
  but shows "Preview copy: nothing was sent and WhatsApp was not opened...", keeps the entries, does not open WhatsApp and fires no analytics event. Limitation: reviewers cannot see the WhatsApp hand-off on a local copy;
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
  discovery); **`GPTBot` explicitly `Disallow: /`** (model training; independent of ChatGPT Search).
* Important information is plain HTML (not JavaScript dependent). Do not add fake reviews, keyword stuffing or "AI optimisation" copy.
* `/broxburn/` is the only Broxburn page (owner decision): the original WordPress URL, linked once from Home -> Areas We Cover and listed once in the sitemap. The duplicate `mobile-tyre-fitting-broxburn.html` was deleted and 301-redirects to it (verify check 24).
* **Location-to-location links (owner-approved, Medium Issue #3):** 22 plain-town-name links inside the "Across <town> And The Surrounding Area" paragraph (`sfr-loc-areas-heading`) of the West Lothian hub, Bathgate, Whitburn, Armadale, Blackburn, Harthill, Shotts, Wishaw, West Calder, Addiewell and Kirkliston, each on a neighbouring town that the existing copy already names. No wording was changed; Broxburn is only ever linked as `/broxburn/`. Airdrie, Bo'ness and Kirkliston still have only the Home link as an inbound body link (no honest existing sentence; new wording needs owner approval). Verify check 25 protects the link map and rejects keyword-phrase anchors.

## 11. Working rules

1. Every change goes through a pull request with a green **Quality gate**; merging to `main` publishes it to the live site (once the Hostinger secrets exist).
2. Never touch DNS, nameservers, MX/e-mail records, the registrar or Hostinger plan settings from this project.
3. No destructive git operations (`reset --hard`, force-push, history rewrite) unless the owner explicitly asks.
4. Never request or store credentials, tokens, keys or personal data in the repository or in chat.
5. Preserve approved URLs, content, business details, SEO structure and structured data; do not redesign.
6. Hosting is GitHub + Hostinger only. Do not create, link or deploy to Vercel, AWS or any other host.

## 12. Known limitations and open items

* **The repository is Private, but its git history still contains the removed street address** (`39 S Loch Park`, `EH48 2QZ`, Plus Code) in earlier commits and in
  `SFR_Website_Info.txt` history. Removing it requires a history rewrite, which is destructive and needs the owner's decision.
* **Google Business Profile** may still show the address if configured that way; that is outside this repository (set it as a service-area business there).
* The "See More Google Reviews" link on Home searches the business name in Google Maps; the Google listing controls what it shows.
* The CTA background photo is 1,920 px wide; it is upscaled about 1.33x on screens wider than about 2,500 px.
* Root-level `*-section.html` files and root images are old WordPress snippets and source photos; they are not built or deployed.
* Privacy Policy "Effective Date" is a manual date; it does not state fixed retention periods (none were confirmed) and does not name a Data Protection Officer.
* Lab performance numbers only; real-user Core Web Vitals exist only after live traffic.
* **Article dates are deferred (owner decision).** Article JSON-LD carries no `datePublished` / `dateModified` and pages show no dates. The WordPress dates belong to text that has since been substantially rewritten, and Git dates are migration dates. Add dates only once reliable dates for the current content exist.
* **Low audit items reviewed and intentionally left unchanged:** 21 article titles exceed 60 characters (approved); `/blog/` title and the `/broxburn/` description (169 characters) wait for owner-approved wording; the two-hop `http://www` chain is issued by Hostinger before `.htaccess` (a host setting, not touched); `/#sfr-areas-heading` is a real Home section; the service-area phrasing and the missing registered-office address are owner facts; directory 403 and `/404.html` 200 are harmless (branded, `noindex`).
* Sitemap `lastmod` dates are not automatically updated.

## 13. Open owner decisions

- [ ] One-time Hostinger setup for automatic deployment (`infra/HOSTINGER-DEPLOY.md` section 2).
- [ ] `/our-tyre-range/`: keep as a neutral guide, or supply confirmed range/price facts.
- [ ] Git history rewrite to remove the old street address: yes/no.
- [ ] Correct registered-office address, if it should be shown again.
- [ ] Google Business Profile set as a service-area business (outside the repo).
