# Pre-Launch Readiness Report — SFR Motors Ltd Static Site

**Phase 4B, Batch F — Final pre-launch verification and launch package**

Branch: `claude/sfr-motors-audit-4ovs2r`
Baseline commit going into this batch: `884140bafbaa519d9f85dc7e42ae1a12b53f2896` (Phase 4B Batch E)
Checkpoint tag: `phase4b-batchF-checkpoint`

This report covers only what was actually run and observed in this
session, against the local production build (`dist/`). **No live,
authenticated Google Search Console, hosting, DNS, or analytics access
exists in this session** — every finding below is either a local,
reproducible, automated check, or is explicitly marked as requiring live
access that has not been exercised.

---

## 1. Executive Verdict

**READY WITH CONDITIONS.**

The site is code-complete, internally consistent, and passes every
automated check this session has the means to run: the full production
build, the complete 80-page SEO/metadata/structured-data sweep, all 19
redirects (including source-of-truth drift checks across
`infra/redirects.json` / `vercel.json` / `infra/cloudfront-function.js` /
`infra/template.yaml`), sitemap/robots.txt reconciliation, a full mobile
axe-core accessibility sweep of all 80 pages plus representative tablet/
desktop passes, and functional QA of navigation, forms and the tyre-size
calculator.

Launch is conditional on:
1. The owner reviewing and deciding the two pending Google Search Console
   URLs (§8 below) — not blocking in the sense of needing more
   engineering work, but blocking in the sense that this batch's rules
   explicitly forbid guessing at them.
2. Real infrastructure steps that cannot be performed from this session
   at all: issuing/validating a TLS certificate, deploying to Vercel or
   AWS, pointing DNS, and verifying a live Search Console property (see
   §10 launch blockers and `LAUNCH_CHECKLIST.md`).
3. One unresolved cross-host question flagged in §7: Vercel's actual
   routing precedence between its custom `redirects` and its
   `trailingSlash` setting has not been verified against a live Vercel
   deployment (only the CloudFront path was fully verified locally,
   because it runs in a Node.js simulation this session can execute).

No material factual, safety, or legal defect was found. No content
rewrite was required. Two small, objective implementation defects were
found and fixed (§4).

---

## 2. Verified Counts

| Metric | Count | How verified |
|---|---|---|
| Built pages (`dist/`) | **80** | `scripts/phase4b-batchF-test.js` §1 (recount from the filesystem, not a hardcoded constant) |
| `site/` source pages | **80** | same — confirmed no build drift between `site/` and `dist/` |
| Redirects (`infra/redirects.json`) | **19** | `scripts/batchF-redirect-verify.js` — every entry individually verified |
| Sitemap URLs (`site/sitemap.xml`, `dist/sitemap.xml`) | **80** | matches built page count exactly, no duplicates |
| WordPress inventory (from the original WXR export) | **90** (37 pages + 53 posts) | `scripts/wp-export-inventory.json`, re-verified unchanged from Batch E |
| WordPress-derived disposition | **28 Preserved + 42 Recreated + 11 Redirected + 7 Excluded + 2 Pending GSC = 90** | `scripts/phase4b-batchE-disposition.json`, re-verified unchanged from Batch E |

### The "70 vs 80" count, explained (per this batch's explicit instruction)

Batch E's "70 canonicals" note referred specifically to the
**WordPress-derived** subset of the site: 28 Preserved + 42 Recreated =
**70** pages that trace directly to a real WordPress URL in the original
export. The full site has **80** pages — the extra 10 are new-site-only
content with no WordPress equivalent (already enumerated in Batch E):
`/best-mobile-tyre-fitters-bathgate/`,
`/blog/how-mobile-tyre-fitting-in-livingston-saves-time-and-improves-road-safety/`,
`/cookie-policy/`, `/mobile-tyre-fitting-armadale/`,
`/mobile-tyre-fitting-guide/`, `/mobile-tyre-fitting/`,
`/mobile-tyre-replacement/`, `/services/`, `/terms-and-conditions/`,
`/tyre-fitting-edinburgh-expert-technical-aspects-you-must-know/`.

Per the explicit Batch F instruction, **every one of the 80 pages** —
not only the 70 WordPress-derived ones — was verified for canonical,
indexability, metadata, structured data and HTTP result. See §5.

---

## 3. Complete Test Results

All suites below were run against the same production build (`dist/`,
rebuilt fresh from `site/` immediately before this run) on Node.js, with
Playwright/Chromium for the browser-based checks.

### 3.1 Existing regression suites (pre-Batch-F, re-run for zero-regression confirmation)

| Suite | Result |
|---|---|
| `scripts/phase3-test.js` | 365 passed, 0 warnings, 0 failed |
| `scripts/phase3b-old-url-test.js` | 45/45 passed |
| `scripts/phase4-test.js` | 243 passed, 0 failed |
| `scripts/phase4b-batchA-test.js` | 47 passed, 0 failed |
| `scripts/phase4b-batchB1-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchB2-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchB3-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchB4-test.js` | 24 passed, 0 failed (Part 2, browser) |
| `scripts/phase4b-batchC-test.js` | all survivor pages 0 axe violations, suite passed |
| `scripts/phase4b-batchD1-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchD2-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchD3-test.js` | all pages 0 axe violations, suite passed |
| `scripts/phase4b-batchE-test.js` | 279 passed, 0 failed |

**Zero regressions** from any Batch F change, including the CloudFront
redirect-chain fix and the sitemap `lastmod` fix (§4).

### 3.2 New Batch F tooling and results

| Script | Purpose | Result |
|---|---|---|
| `scripts/batchF-audit.js` | Full 80-page SEO/metadata/structured-data/content-safety crawl → `PRELAUNCH_PAGE_AUDIT.json` | 80/80 pages, all categories clean except 1 documented, reviewed non-defect (§5) |
| `scripts/batchF-redirect-verify.js` | All 19 redirects + source-of-truth drift + representative-request simulation → `PRELAUNCH_REDIRECT_AUDIT.json` | 19/19 redirects OK, 3/3 drift checks OK, 9/9 simulations OK |
| `scripts/batchF-a11y-qa.js` | Full 80-page mobile axe-core sweep + tablet/desktop representative sweep + functional QA → `PRELAUNCH_A11Y_QA_REPORT.json` | See §6 |
| `scripts/phase4b-batchF-test.js` | Pass/fail gate consuming all of the above | **68 passed, 0 failed** |

---

## 4. Small Objective Implementation Defects Found and Fixed

Per the Batch F instruction ("small objective implementation defects may
be fixed, documented and fully tested" — as distinct from material
content/factual defects, which must stop for owner input), two were
found and fixed:

### 4.1 `package-lock.json` was gitignored, breaking `npm ci` on a fresh clone

`.gitignore` excluded `package-lock.json`, so it was never committed
despite `npm ci` being the documented, expected install method. Verified
as a real failure (not theoretical): backed up the local lockfile,
deleted it, ran `npm ci` — it failed with an npm usage error rather than
regenerating gracefully. **Fix:** removed the `package-lock.json` line
from `.gitignore`; the lockfile is now tracked and `npm ci` succeeds from
a clean checkout.

### 4.2 A no-trailing-slash retired WordPress URL took two redirect hops on the CloudFront path

All 19 entries in `infra/redirects.json` are keyed on their trailing-
slash form (matching how WordPress itself and Google's index would have
them). The generated CloudFront Function first checked its `REDIRECTS`
map, then separately added a trailing slash to any bare path — meaning a
request for the non-canonical no-slash form of a retired URL (e.g.
`/tyre-lifespan-mobile-tyre-repair-guide`, no trailing slash — a
plausible manually-typed or malformed-backlink case) would 301 to add
the slash, then 301 again on the next request to the real destination:
two hops, violating this batch's explicit "no second hop" requirement.

**Fix:** `scripts/gen-redirects.js`'s generated CloudFront Function now
checks whether the slash-added form is itself a redirect source, and if
so redirects straight to the final destination in one hop.
`infra/cloudfront-function.js` and the embedded copy in
`infra/template.yaml` were regenerated from the fixed generator. Verified
locally: the no-slash retired URL now resolves in exactly one hop
(`scripts/batchF-redirect-verify.js` simulation case
`/tyre-lifespan-mobile-tyre-repair-guide` → single 301 straight to
`/tyre-lifespan/`).

**This fix could not be verified — or even reliably designed — for the
Vercel path**, since Vercel's actual routing precedence between its
custom `redirects` array and its global `trailingSlash: true` setting is
a live-service behaviour this session cannot deploy or observe (deploying
to Vercel is outside this batch's mandate). This is flagged as an
unresolved cross-host question in §7 and as an explicit launch-day
verification step in `LAUNCH_CHECKLIST.md` §3A.

### 4.3 `site/sitemap.xml`'s `lastmod` dates were a fabricated hardcoded constant

`scripts/gen-sitemap.js` wrote every URL's `<lastmod>` from a single
hardcoded string constant (`"2026-09-03"`) set at some earlier batch's
write time — already one day stale by the time this batch ran, and
guaranteed to go stale again the next time the script isn't re-run on
the literal day it names. This does not meet the Batch F requirement
that "sitemap dates (if present) [be] defensible not fabricated."

**Fix:** `scripts/gen-sitemap.js` now derives each URL's `lastmod` from
that page's own real `git log -1 --format=%cs` last-commit date — a
verifiable, non-fabricated timestamp tied to the file's actual last
change, with a same-day fallback only for an uncommitted file. Note: the
regenerated sitemap currently shows `2026-09-04` for all 80 URLs; this is
not a bug in the fix — this repository's entire Phase 4B migration
history (Batches A through E) happened to commit within the same
day in this session's environment clock, so every page's most recent
real edit genuinely falls on that date. This will naturally diverge
per-page as real future edits land.

### 4.4 Body-text links inside two shared card/section styles had no explicit colour, falling back to browser-default blue on a dark background

The full 80-page mobile axe-core sweep (§10) found 5 `color-contrast`
("serious") violations across 5 pages: an in-copy link inside
`.sfr-about__text` (4 pages: `/24-7-mobile-tyre-replacement/`,
`/mobile-locking-wheel-nut-removal/`, `/mobile-tyre-fitting/`,
`/mobile-tyre-puncture-repair/`, `/mobile-tyre-replacement/`) and inside
`.sfr-how__step p` (1 page: `/24-7-mobile-tyre-replacement/`). Neither
selector had its own `a` colour rule in `main.css`, so the link fell back
to the browser's default link blue against these sections' dark
background — the exact same root cause Phase 4's regression suite had
already found and fixed once for `/blog/`'s "get in touch" link, just
recurring on 5 newer pages added in later batches that use these two
different card/section classes.

**Fix:** two small CSS rules added to `site/assets/css/main.css`,
consistent with the same pattern already used for `.sfr-guide__item p a`,
`.sfr-legal__body a`, `.sfr-faq__panel p a` and `.sfr-band__text a`
elsewhere in the same file — `color:var(--sfr-orange)` (both classes
already define `--sfr-orange` locally) plus `text-decoration:underline`:

```css
.sfr-about__text a{color:var(--sfr-orange);text-decoration:underline;}
.sfr-how__step p a{color:var(--sfr-orange);text-decoration:underline;}
```

Verified: re-running the full 80-page mobile sweep after the fix shows
**zero** axe-core violations sitewide (down from 5), with zero
regressions in any other suite.

No other implementation defects were found. No content was rewritten.

---

## 5. SEO and Migration Findings (all 80 pages)

Full machine-readable detail: `PRELAUNCH_PAGE_AUDIT.json`.

| Check | Result |
|---|---|
| HTTP 200 at final clean URL | 80/80 |
| Exactly one meaningful H1 | 80/80 |
| Unique title sitewide | 80/80 (0 duplicates) |
| Unique meta description sitewide | 80/80 (0 duplicates) |
| Self-referencing HTTPS canonical, final clean trailing-slash URL | 80/80 |
| Open Graph URL matches canonical | 80/80 |
| Indexable (`index, follow`) | 80/80 |
| Valid, parseable JSON-LD | 80/80 (0 parse errors) |
| Structured-data URL fields use final domain/clean URLs | 80/80 |
| No false self-serving AggregateRating | 80/80 (0 present) |
| No stale `.html`/retired-slug/preview-domain/localhost URL anywhere | 80/80 |
| No broken internal link | 80/80 |
| No broken local image/CSS/JS/icon reference | 80/80 |
| No accidental orphan page | 80/80 (every page reachable from at least one other) |
| Listed in sitemap, no excluded/redirected/pending URL present in sitemap | 80/80 listed; 0 excluded/redirected/pending URLs leaked into the sitemap |
| Phone (`tel:01312020289`) and WhatsApp (`wa.me/447448427154`) CTAs present and correct | 80/80 |
| Correct company name "SFR Motors Ltd", no stale name | 80/80 |
| No accidental nationwide-coverage claim | 80/80 |
| No unsupported fixed arrival-time or price claim | 79/80 clean; 1 reviewed, see below |
| No Hindi/placeholder/development text | 80/80 |
| Correct British-English spelling, except intentional historical "tire" URLs | 80/80 |

### One flagged item, investigated and accepted (not a defect)

The homepage (`/`) trips the automated "unsupported arrival time" pattern
on the phrase "the tyre fitter was here at our house within 30 minutes of
first contact" — but this is not a claim by SFR about its own service
guarantees; it is a real, named, explicitly-sourced testimonial ("Jord
Nelson", "Google Review", with the Google logo) that already exists on
the live homepage. It is categorically different from the anonymous
fabricated case studies removed from WordPress content in earlier
batches: it is attributed, sourced, and presented as one customer's
account, not as a company-wide promise. This session cannot independently
verify a specific Google review's authenticity, and altering a real,
attributed customer review is outside this batch's mandate (Part 6
explicitly limits this batch to small, objective implementation fixes,
not content rewrites). **No change made.** `scripts/phase4b-batchF-test.js`
locks this in as the *only* page allowed to trip that pattern, so any
new, unattributed arrival-time claim introduced later would still fail
the suite.

---

## 6. Redirect and Migration Verification

Full machine-readable detail: `PRELAUNCH_REDIRECT_AUDIT.json`.

- **All 19 redirects individually verified:** correct source, correct
  destination, HTTP 301 (permanent), single hop (destination is never
  itself a redirect source), destination returns 200 and exists as a
  real built page, destination topically relevant (verified by reading
  every redirect's documented reason in `infra/redirects.json` against
  its destination page — see §4 of `WORDPRESS_MIGRATION_AUDIT.md` for the
  full per-redirect reasoning, unchanged from prior batches).
- **Zero configuration drift** across all three generated
  implementations plus the source of truth: `infra/redirects.json` (19
  entries) → `vercel.json` (19 entries, all `statusCode: 301`,
  `trailingSlash: true`) → `infra/cloudfront-function.js` (19-entry
  `REDIRECTS` map) → `infra/template.yaml` (the identical function
  embedded verbatim between generated markers). Verified programmatically,
  not by inspection alone.
- **Query strings handled safely:** a redirect source requested with a
  query string (`/emergency-tyre-fitter-edinburgh-falkirk/?utm_source=test`)
  still 301s correctly to the bare destination path — the query string is
  neither echoed into an open redirect nor causes a match failure.
- **Trailing-slash normalisation:** verified not to create a second hop
  for any of the 19 canonical (slash-terminated) redirect sources. The
  one case that *did* chain — a non-canonical no-slash request for a
  retired URL — was found and fixed; see §4.2.
- **Custom 404 returns a true 404 status, not a soft-404 200:** verified
  both for a wholly unknown URL and for a retired `.html` variant of a
  migrated URL (the old WordPress `.html` extension is not supported and
  correctly 404s rather than being silently served). The local simulation
  server replicates the exact CloudFront custom-error-response design
  (403/404 origin errors served with `index.html`'s *content* but the
  real `404` *status* — confirmed the status code specifically, not just
  that a page rendered).

**Simulated representative requests** (all passed, `scripts/batchF-redirect-verify.js`):
old WordPress URL with trailing slash, old WordPress URL without trailing
slash, a live page's own no-slash form, an unknown URL, a real
content-hashed static asset path, a retired `.html` variant, a redirect
source carrying a query string.

---

## 7. Hosting Parity and Rollback

Neither hosting path is deployed. Both are code/config-complete and
locally verified to the extent a local Node.js simulation can verify
them; deployment-time behaviour that only a live service can exhibit
(actual routing precedence, actual TLS provisioning, actual DNS
propagation) has **not** been observed, per this batch's hard stop
against deploying anything.

| | Vercel | AWS S3 + CloudFront |
|---|---|---|
| Config completeness | `vercel.json` complete: build command, output directory, 19 redirects (301), `trailingSlash: true` | `infra/template.yaml` complete: S3 + OAC, CloudFront distribution, security headers policy, 2 cache policies, CloudFront Function (redirects + clean-URL rewrite), custom error responses for a true 404 |
| One-time setup lift | Connect GitHub repo, add custom domain in dashboard — Vercel provisions and renews TLS automatically | Issue + DNS-validate an ACM certificate (us-east-1) manually, `sam`/`cloudformation deploy` the stack, run the first `deploy-site.sh`, point DNS |
| `www` handling | Not configured in `vercel.json` (domain-level config lives in the Vercel dashboard, not in this repo) — must be set at deploy time | **Not built at all**: `Aliases` in `template.yaml` lists only the apex domain; no `www` alias, no `www` certificate SAN, no redirect rule exists for it today |
| Clean-URL / 301 behaviour | Verified in principle via `vercel.json`'s redirects + `trailingSlash: true`; **the specific interaction that produced the two-hop bug on CloudFront (§4.2) has not been verified live on Vercel** — flagged as a launch-day check | Fully verified locally via a faithful Node.js simulation of the CloudFront Function's actual logic |
| Custom 404 behaviour | Vercel serves a 404 by default for unmatched paths; not deployed/verified live this session | Verified locally: `CustomErrorResponses` maps 403/404 → true 404 status with `index.html` content |
| Cache invalidation | Handled automatically per-deploy by Vercel | Manual/scripted via `infra/deploy-site.sh`'s `aws cloudfront create-invalidation` call (content-hashed assets need no invalidation; only HTML/robots.txt/sitemap.xml do) |
| CI/CD | Native Vercel Git integration (deploy-on-push), once connected | `.github/workflows/deploy.yml` exists, wired to `main`, using GitHub OIDC (no stored AWS keys) — requires one-time `github-oidc.yaml` deploy + 4 repo variables first |
| Rollback | Revert the Vercel deployment to a previous one (native "Instant Rollback") | Re-run `deploy-site.sh` from a previous commit, or restore the previous S3 object versions (bucket versioning is on per `README.md`) |

**This report does not pick one path as "the" launch path** — that is an
infrastructure/ownership decision outside this batch's scope. Vercel has
a materially smaller one-time operational lift (no manual certificate
issuance, no manual DNS-validation wait, no IAM/OIDC setup) if a Vercel
account is available; AWS gives finer control over caching, headers and
error handling and was the design's original target (per `README.md`)
but requires more manual one-time setup before its first real request.

See `LAUNCH_CHECKLIST.md` §3A/§3B for the concrete steps for each.

**Rollback plan, backups, DNS capture, launch-day smoke test, and
24h/7-day/28-day monitoring plan:** see `LAUNCH_CHECKLIST.md` in full —
none of it has been executed, all of it is prepared for launch day.

---

## 8. Pending GSC Decisions

Two URLs remain explicitly marked pending, per this batch's instruction
not to guess, not to create unrelated redirects, and not to redirect
either to the homepage:

- `/spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/`
- `/what-to-expect-from-a-same-day-mobile-car-repair-service/`

The exact GSC data required (clicks/impressions over 3-month and 16-month
windows, indexed status, referring pages/backlinks) and the recommended
decision rule (recreate / redirect / 404 / 410, and exactly which
conditions select each) are documented in full in
`WORDPRESS_MIGRATION_AUDIT.md` §6e — added in this batch. No GSC evidence
was available in this session, so no disposition change was made; both
URLs currently 404, correctly.

---

## 9. Content and Safety Sweep

Re-swept against the full Part 6 checklist. No material factual, legal,
or safety defect was found — consistent with, and re-confirming, the
verification work already done in Batches D1-D3 (GOV.UK Highway Code
Annex 6 tread-depth/blowout facts; Michelin 1946 patent history; Pirelli
PNCS technical claims) and Batch E's exclusion re-review.

| Checked for | Result |
|---|---|
| Unsupported statistics/survey claims | None found (the specific unverifiable AA/TyreSafe/Michelin/Continental/Tyre Industry Federation figures identified and excluded in Batches D3/E remain excluded) |
| Invented testimonials/customer stories | None found (the one real, attributed, sourced Google review on the homepage was reviewed — see §5) |
| Incorrect legal/Highway Code claims | None found (1.6mm legal minimum tread depth and £2,500/3-points penalty figure only, sourced to GOV.UK Highway Code Annex 6) |
| Unsupported 2mm/3mm seasonal tread thresholds | None found (the fabricated seasonal threshold caught and removed in the Batch D1 correction has not reappeared) |
| Unsupported pricing | None found (site deliberately publishes no fixed SFR pricing anywhere; the cost-factors article explains what drives cost without a figure) |
| Unverified response-time promises | None found sitewide via the automated pattern sweep, other than the one reviewed, attributed testimonial (§5) |
| "Best in the UK"/nationwide/most trusted/guaranteed-ranking claims | None found |
| Unnecessary competitor names | None found (grep across all 80 pages for major named UK tyre retailers: zero matches) |
| Brand partnership/endorsement/stock-availability claims | The only "stock"-related language found is SFR's own appropriately-hedged availability language about its own inventory ("we'll confirm availability before we arrive", "depends on stock availability... we'll confirm the earliest we can get to you") — not a false manufacturer partnership/endorsement/authorised-dealer claim. No defect. |
| Unsafe roadside repair/lifting/drilling/destructive wheel-nut instructions | None found (grep across all 80 pages for drilling/hydraulic-jack/force-the-nut/angle-grinder style instructions: zero matches; the locking-wheel-nut articles carry the industry-practice/wheel-damage-risk disclaimer added in Batch C) |
| Old company names | None found (`SFR Mobile Tyres Ltd` and other superseded names: zero matches sitewide) |
| Unrequired American wording | None found, other than the intentionally-preserved exact historical WordPress URL containing "tire" (`/michelin-radial-tire-history-innovation/`, `/on-demand-mobile-tire-fitting/` as a redirect source) |

No content was rewritten in this batch. No material defect was found
that would require stopping per the Part 6 instruction.

---

## 10. Accessibility Findings and Limitations

Full machine-readable detail: `PRELAUNCH_A11Y_QA_REPORT.json`.

**Full-site mobile (390×844) axe-core sweep, all 80 pages** (WCAG
2.0/2.1, levels A + AA):
- Initial run found **5 "serious" `color-contrast` violations across 5
  pages** (0 critical, 0 moderate, 0 minor) — a real, objective CSS
  defect, found, fixed, and re-verified; see §4.4.
- **After the fix: 0 violations across all 80 pages, all severities.**
- 0 pages with horizontal overflow at 390px.
- 0 pages raised a same-origin JS console error, uncaught page error, or
  failed same-origin network request. (Third-party requests — Google
  Fonts/Analytics/Maps — were excluded from this check: this sandboxed
  session's outbound network proxy is independently unreliable for
  external hosts, confirmed separately via a genuine
  `net::ERR_CONNECTION_RESET` on the Google Fonts stylesheet request
  during the Lighthouse run in §11.1 — an environment condition, not a
  defect in the site's own code, which correctly uses a non-blocking
  preload+swap pattern for that resource regardless of whether it loads.)

**Representative-page sweep at tablet (768×1024) and desktop (1440×900)**
— homepage, `/mobile-tyre-fitting/`, `/mobile-tyre-fitting-livingston/`,
`/tyre-lifespan/`, `/tyre-size-calculator/`, `/contact-us/`: **0
violations at either viewport**, after the same fix (the one
tablet-viewport violation observed before the fix was the identical
`.sfr-about__text a` issue on `/mobile-tyre-fitting/`, resolved by the
same CSS change).

### 10.1 Functional QA (direct interaction, not just automated scanning)

All 18 checks passed, via real Playwright-driven DOM interaction (clicks,
keyboard events, form fills), not static source inspection:

| Check | Result |
|---|---|
| Mobile nav starts closed (`aria-expanded="false"`) | OK |
| Mobile nav opens on click (`aria-expanded`/`data-open` both flip to true) | OK |
| Escape closes the open mobile nav | OK |
| Focus returns to the nav toggle button after Escape | OK |
| Mobile nav closes when a nav link is clicked | OK |
| Skip link is the first Tab stop on the page | OK |
| Skip link activates and moves focus into `#main` | OK |
| Homepage has 8 `tel:` links, all using the correct number (`01312020289`) | OK |
| Homepage has 4 `wa.me` links | OK |
| Empty quote-form submit (after the form's 1.5s bot-timing window) shows the real inline validation error, not the anti-bot fake-success message | OK |
| Valid quote-form submit opens the correct WhatsApp deep link (`wa.me/447448427154`) | OK |
| The WhatsApp message text includes the actually-submitted form data (name, service, location) | OK |
| Tyre-size calculator flags an out-of-range value (`aria-invalid`) | OK |
| Calculator moves focus to the first invalid field on a failed submit | OK |
| Calculator shows results for valid boundary-edge values (min AND max of every field's allowed range) | OK |
| Calculator reset hides the results panel and clears errors | OK |
| Calculator's 6 fields are reachable in order via Tab alone (keyboard-only) | OK |

One methodology note, corrected during this batch: the WhatsApp
deep-link check cannot reliably observe the popup window's own URL in
this sandboxed environment, because that popup's navigation to
`https://wa.me/...` is intentionally intercepted (to keep the crawl fast
and independent of this environment's proxy reliability for external
hosts) — and a blocked popup's URL gets overwritten by Chromium to
`chrome-error://chromewebdata/` before Playwright's `popup` event
listener can observe the original target, which was confirmed by direct
testing before this script's final version. The fix captures the actual
outbound request URL (including its query-string-encoded message body)
at the network layer instead, which is unaffected by what the popup's
navigation does afterwards — a more reliable signal, not a weaker one.

**Important limitation, stated explicitly per this batch's instruction:**
automated axe-core coverage (WCAG 2.0/2.1 A+AA rule set) is necessary but
not sufficient for real accessibility. It does not catch every usability
issue a screen-reader user, a switch-access user, or a user with a
cognitive disability might encounter, and does not replace manual
testing with assistive technology. **This site is not being described as
accessibility-perfect** — it passed every automated check this session
could run, and specific functional keyboard/focus/ARIA-state behaviours
were additionally verified by direct interaction (above), which goes
beyond what axe alone catches, but this is still not a substitute for
real assistive-technology testing with real users.

**One non-blocking, documented-not-fixed finding:** Lighthouse's SEO
`link-text` audit flags the homepage's and several location pages'
service-card "Learn More" links as having non-descriptive visible text.
These links already carry a fully descriptive `aria-label` (e.g.
`aria-label="Learn more about Mobile Tyre Fitting"`), which is why
axe-core's WCAG accessible-name check (a real conformance requirement)
found zero violations here — the accessible name computed for assistive
technology is already correct. Lighthouse's check is a separate, weaker
SEO heuristic about the literal visible text (relevant to sighted users
scanning a page and to anchor-text as a minor ranking signal), not a
WCAG failure. Fixing it would mean touching the shared service-card
markup in `site/index.html` and `scripts/gen-location-pages.js` across
every card on every page that uses this pattern — judged out of scope
for this batch's "small, objective, single-file" fix bar, and reported
here rather than made silently.

**Important limitation, stated explicitly per this batch's instruction:**
automated axe-core coverage (WCAG 2.0/2.1 A+AA rule set) is necessary but
not sufficient for real accessibility. It does not catch every usability
issue a screen-reader user, a switch-access user, or a user with a
cognitive disability might encounter, and does not replace manual
testing with assistive technology. **This site is not being described as
accessibility-perfect** — it passed the automated checks this session
could run, and specific functional keyboard/focus/ARIA-state behaviours
(mobile nav, skip link, calculator validation focus) were additionally
verified by direct interaction (§10.1), which goes beyond what axe alone
catches, but this is still not a substitute for real assistive-technology
testing with real users.

### 10.1 Functional QA (direct interaction, not just automated scanning)

**FUNCTIONAL_QA_PLACEHOLDER**

---

## 11. Performance and Security Readiness

### 11.1 Lighthouse / automated performance audit

Lighthouse 12.8.2 (installed transiently for this session, not a project
dependency) was run against the production build (`dist/`, served
locally via `http-server` on `http://127.0.0.1:8980`) using this
session's pre-installed Chromium (`/opt/pw-browsers/chromium-1194`),
desktop preset, against all 6 representative pages the instruction
names: homepage, the core mobile-tyre-fitting page, a location page
(`/mobile-tyre-fitting-livingston/`), a blog article (`/tyre-lifespan/`),
the tyre-size calculator, and the contact/quote page.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Homepage (`/`) | 100 | 100 | 96 | 92 | 0.5s | 0 | 20ms |
| `/mobile-tyre-fitting/` | 100 | 100 | 96 | 100 | 0.5s | 0 | 0ms |
| `/mobile-tyre-fitting-livingston/` | 100 | 100 | 96 | 92 | 0.4s | 0 | 0ms |
| `/tyre-lifespan/` | 100 | 100 | 96 | 100 | 0.3s | 0 | 0ms |
| `/tyre-size-calculator/` | 100 | 100 | 96 | 100 | 0.4s | 0 | 0ms |
| `/contact-us/` | 100 | 100 | 96 | 100 | 0.4s | 0 | 0ms |

**The two things holding Best Practices and some pages' SEO scores below
100, investigated and both confirmed as this sandboxed session's
environment, not the site:**

- **Best Practices (96/100, `errors-in-console`):** every page logs one
  browser console error for the Google Fonts stylesheet request —
  `Failed to load resource: net::ERR_CONNECTION_RESET` for
  `https://fonts.googleapis.com/css2?family=Roboto...`. This is this
  sandboxed session's outbound proxy failing an external HTTPS request,
  not a site defect: the request itself is legitimate and uses the
  correct non-blocking preload+swap pattern (§10.1, §11.2), and a real
  production deployment reaching the real internet would not see this.
- **SEO (92/100 on the homepage and the location page,
  `link-text`):** the "Learn More" service-card links — see §10.1 for
  the full explanation (these links already carry a fully descriptive
  `aria-label`; this is a separate, non-blocking visible-text heuristic,
  documented rather than fixed in this batch).

**No other Lighthouse finding on any of the 6 pages.** Performance is a
perfect 100 on every page tested, with LCP between 0.3-0.5 seconds, zero
layout shift, and near-zero (0-20ms) total blocking time.

**Explicit limitation, stated per this batch's instruction:** these are
**local, synthetic (lab) measurements** against a local static-file
server on this session's own machine — not real Core Web Vitals field
data from real visitors on the real production domain over a real
network. Real-world numbers depend on the actual hosting CDN's latency,
real users' devices and connections, and real third-party network
conditions (Google Fonts, Analytics, Maps), none of which this session
can measure. **No live Core Web Vitals are claimed.** The post-launch
Search Console monitoring plan (`LAUNCH_CHECKLIST.md` §6, §8) is where
real field data should be reviewed once the site is live.

### 11.2 Manual bundle/asset/header inspection

| Check | Finding |
|---|---|
| CSS size | 1 stylesheet, minified + hashed: `main.792c7a59.css`, 60 KB (from 68 KB source — clean-css minification) |
| JS size | 3 scripts, minified + hashed, ~4 KB each on disk (`main.c511bcff.js`, `analytics.2f2dca11.js`, `tyre-calculator.38df87a1.js`) — combined well under 15 KB, no framework, no dependencies |
| Total `dist/` size | 4.6 MB (dominated by pre-optimised images; HTML+CSS+JS together are a small fraction of this) |
| Image formats | AVIF + WebP + JPEG fallback via `<picture>` for every photo (16 AVIF, 17 WebP, 12 JPEG files present in `dist/assets/img`) |
| Lazy loading | Below-the-fold `<img>` elements use `loading="lazy" decoding="async"`; the one above-the-fold hero image per page uses `fetchpriority="high"` instead, with explicit `width`/`height` to reserve layout space |
| Hero image priority/dimensions | Confirmed: hero images carry explicit `width`/`height` attributes and `fetchpriority="high"`, with responsive `<source media>` variants for narrow viewports |
| Font loading | Google Fonts (Roboto) loaded via `rel="preconnect"` + async `rel="preload"`-then-`stylesheet` swap pattern with a `<noscript>` fallback and `display=swap` — no render-blocking font request, no unstyled-text flash beyond the swap period |
| Cache headers/config | Defined in `infra/deploy-site.sh` (AWS path) and `infra/template.yaml`'s cache policies: `/assets/*` cached 7 days default / 1 year max (content-hashed, safe to cache aggressively); HTML cached 5 minutes so edits show up quickly. **Not yet configured on the Vercel path** — Vercel applies its own default caching for static builds, which has not been separately verified against these same targets. |
| Compression | `Compress: true` (gzip/brotli) on both CloudFront cache behaviours; Vercel compresses by default | 
| Render-blocking resources | None found: CSS is a single `<link>` in `<head>` (necessary, not blocking in the render-blocking-*script* sense), JS is not `async`/`defer`-audited individually in this pass but is minimal (~4 KB total) and not observed to raise console errors or block interaction in the functional QA pass (§10.1) |
| Layout-shift risk | Explicit `width`/`height` on every `<img>` found in the audit crawl (0 broken/missing local assets); font-swap strategy is the standard low-CLS pattern |
| Third-party requests | Google Fonts (CSS + font files), Google Analytics via `gtag.js` (currently a no-op — `GA_MEASUREMENT_ID` is still the placeholder `G-XXXXXXXXXX`, per `README.md`), Google Maps embed on the contact page, WhatsApp deep link (`wa.me`, only on click, not loaded automatically) |
| Form/WhatsApp data handling | No backend: the quote form builds a message client-side and opens `wa.me` with it URL-encoded; nothing typed into the form is sent to analytics or stored anywhere (confirmed in `site/assets/js/main.js` and `README.md`) |
| Security headers | CloudFront `SecurityHeadersPolicy`: HSTS (`max-age=63072000`, `includeSubDomains`, `preload`), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a CSP scoped to the site's actual resources (self + Google Fonts + Google Analytics/Maps + `api.sfrmotors.co.uk`, no `unsafe-inline`/`unsafe-eval`), `Permissions-Policy` denying geolocation/microphone/camera. **This policy is only wired into the CloudFront path** (`infra/template.yaml`'s `ResponseHeadersPolicyId` on both cache behaviours) — the Vercel path has no equivalent `headers` block in `vercel.json` today, so these headers would not be sent if Vercel is chosen as the launch path without adding one. |
| HTTPS / canonical-host policy | CloudFront: `ViewerProtocolPolicy: redirect-to-https`, TLS 1.2+ minimum. Every canonical/OG/JSON-LD URL sitewide uses `https://sfrmotors.co.uk/...` (verified for all 80 pages in §5) — but see §7: **no `www` handling exists on either path today**; this must be resolved at deploy time (see `LAUNCH_CHECKLIST.md`) |
| No secrets/credentials/private files in deployable output | Verified: `dist/` contains zero `.json` files, zero WXR/audit-fixture files, and no matches for common AWS-key/private-key/hardcoded-password patterns across all HTML/CSS/JS/text output. `scripts/phase4b-batchF-test.js` asserts this programmatically as part of the regression gate. |

**No live Core Web Vitals are claimed or invented.** Anything requiring
real field data (actual LCP/INP/CLS from real visitors, actual CDN
latency, actual cache hit rates) is out of reach of this session and is
listed as a post-launch monitoring task in `LAUNCH_CHECKLIST.md` §8.

---

## 12. Explicit Confirmation: What Was and Was Not Tested With Live Services

**Tested, locally, in this session, and reproducible by re-running the
listed scripts:**
- Full production build (`npm run build`) and all generators
- All 80 pages' HTML, metadata, structured data, and internal links,
  served from a local Node.js server replicating the production
  clean-URL/redirect/404 behaviour
- All 19 redirects, including source-of-truth drift across every config
  file, via the same kind of local server
- A full mobile (390×844) axe-core accessibility sweep of all 80 pages,
  plus representative tablet (768×1024) and desktop (1440×900) sweeps,
  via headless Chromium (Playwright)
- Functional QA (mobile nav, skip link, keyboard navigation, quote form
  validation and WhatsApp deep-link construction, tyre-size calculator
  boundary/reset/keyboard behaviour) via the same headless-Chromium
  automation, driving real DOM interaction, not just static source
  inspection
- Local Lighthouse audit — see §11.1 for exact scope and limitations
- Static inspection of `dist/` for leaked secrets/internal files

**NOT tested — requires live access this session does not have, and no
claim is made that it was:**
- Anything on the real `sfrmotors.co.uk` domain, or any staging/preview
  URL of either hosting path — nothing has been deployed anywhere
- Real DNS behaviour, propagation, or the current live DNS records
- A real TLS certificate (issuance, validation, or browser trust)
- Real Google Search Console data of any kind: current indexing status,
  clicks, impressions, backlinks, or Core Web Vitals field data for
  either the old WordPress site or the new site (Search Console has not
  been signed into in this session)
- Real Google Analytics data (analytics is not yet activated — the
  Measurement ID is still the documented placeholder)
- Vercel's actual live routing behaviour (only its checked-in
  configuration was inspected; nothing was deployed to Vercel)
- AWS's actual live behaviour beyond what a faithful local simulation of
  its documented configuration can prove (nothing was deployed to AWS)
- The current live WordPress site itself was not modified, and was not
  re-crawled in this session — all WordPress-derived facts come from the
  previously-extracted `scripts/wp-export-inventory.json`

---

## 13. Launch Blockers (must happen before going live, none of them code)

1. Owner decision on the two pending GSC URLs (§8) — or an explicit
   owner decision to launch with them left as 404s, which the decision
   rule in `WORDPRESS_MIGRATION_AUDIT.md` §6e already supports as a
   valid outcome if the evidence points that way.
2. Choose a hosting path (Vercel or AWS) and complete its one-time setup
   (§7, `LAUNCH_CHECKLIST.md` §3A/§3B) — certificate, deployment, and (for
   AWS) the `www` alias/redirect this batch found is not yet built if
   `www` needs to work at all.
3. Decide the canonical host (`sfrmotors.co.uk` vs `www.sfrmotors.co.uk`)
   before DNS cutover — the entire site's canonical/OG/JSON-LD tags
   already assume the non-www apex domain; changing that after the fact
   would require a sitewide edit this batch has not made because no
   evidence yet says it's necessary.
4. DNS cutover itself (`LAUNCH_CHECKLIST.md` §4).
5. If analytics is wanted from launch: set the real GA4 Measurement ID
   and put a cookie-consent mechanism in place first (UK PECR/GDPR) —
   currently a documented, intentional no-op placeholder, not a defect.
6. Confirm the Facebook/Instagram footer links (currently `#` placeholders,
   documented in `README.md` as an intentional placeholder rather than a
   guess) with the owner's real profile URLs, or leave them as-is if the
   business doesn't want them linked yet.

**Nothing else found in this batch blocks launch.**

---

## 14. What This Batch Did Not Do (per the hard stop)

- Did not deploy to Vercel, AWS, or anywhere else.
- Did not publish anything to the public internet.
- Did not change any DNS record.
- Did not alter the live WordPress site at sfrmotors.co.uk in any way.
- Did not merge this branch into `main` or any production branch.
- Does not describe the website as live — it is not.
- Stops here and awaits the owner's explicit launch approval before any
  deployment, DNS, or production action is taken.

---

*Generated by Phase 4B Batch F. See also: `LAUNCH_CHECKLIST.md` (the
step-by-step procedure for whenever launch is approved),
`WORDPRESS_MIGRATION_AUDIT.md` (the full migration audit trail, including
§6e's new pending-GSC decision rule), `PRELAUNCH_PAGE_AUDIT.json`,
`PRELAUNCH_REDIRECT_AUDIT.json`, and `PRELAUNCH_A11Y_QA_REPORT.json` (the
full machine-readable evidence behind every count in this report).*
