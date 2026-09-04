# Phase 3B — SEO Migration Risk Verification & Correction

Permanent record of the Phase 3B work: verifying and correcting risks in the
Phase 3 SEO-safe URL migration (WordPress → the static `site/` rebuild),
before this branch is ever deployed. Nothing in Phase 3B or this correction
pass has been deployed, published, or pushed to the live WordPress site —
all work is local to this repository and the `claude/sfr-motors-audit-4ovs2r`
branch.

This report covers two pieces of history:

1. The original Phase 3B pass (commit `e677150`).
2. The Phase 3B **correction** pass documented here (this commit), made
   after an independent re-verification found two live URLs the original
   pass had missed.

## 1. URL inventory methodology

The live WordPress site (`sfrmotors.co.uk`) could not be crawled directly —
outbound network access to `sfrmotors.co.uk` and `sfrmobiletyrefitters.co.uk`
is blocked by this environment's egress policy. The inventory was built
instead from indirect, external evidence:

- Search-engine result sampling (`site:sfrmotors.co.uk` and topic-specific
  queries) — the only source available in this environment that reflects
  what's actually live and indexed, as opposed to what the repository
  *assumes* is live.
- The repository's own migration history: `scripts/migrate-phase3.js`'s
  `SLUG_MAP` (Phase 3's assumed 1:1 live-permalink matches) and
  `infra/redirects.json` (Phase 2/3's redirect decisions), cross-checked
  against search results rather than taken on faith.
- The existing automated test suites (`scripts/phase3-test.js`,
  `scripts/phase3b-old-url-test.js`), re-run from a clean checkout to
  confirm claimed results were reproducible, not just asserted in a commit
  message.

This methodology is **not equivalent to** a Search Console export or a full
XML sitemap crawl of the live site — neither was accessible. Search-index
sampling finds pages that rank for guessed/plausible queries; it does not
prove completeness. See "Known uncertainties" below.

## 2. Discovered URLs

45 old-WordPress URLs are now tracked in `scripts/phase3b-old-url-test.js`
(`OLD_URLS`), each independently tested against a local server that
reproduces production redirect/trailing-slash behaviour:

- **31 "exact"** — recreated or already present at the identical slug, no
  redirect needed.
- **14 "redirect"** — 301 to a different final URL (full map in
  `infra/redirects.json`).

Two of the 45 were added in this correction pass, found via external search
*after* the original Phase 3B commit shipped:

| URL | What it is | Why it was missed the first time |
|---|---|---|
| `/emergency-tyre-replacement/` | Live article: "Emergency Tyre Replacement vs Garage Tyre Fitting" | Not surfaced by the original pass's search queries |
| `/the-best-tyres-for-your-ford-on-edinburghs-roads/` | Live article: Ford-specific tyre guide for Edinburgh drivers | Same |

Both were confirmed live via two independently-phrased search queries
before being treated as real. Neither had any redirect entry, recreated
page, or sitemap entry prior to this correction — a real visitor to either
URL post-launch would have hit a hard 404.

## 3. Final redirect decisions

Unchanged by this correction — **14 redirects**, all verified (by
`scripts/gen-redirects.js`, which runs this check on every regeneration):

- Every destination resolves to a real page in `site/`.
- No redirect chains (no destination is itself a redirect source).
- No redirect loops.
- No blanket homepage redirects — every source maps to its actual closest
  content match.
- Consistent trailing-slash behaviour (`vercel.json`'s `trailingSlash: true`
  plus every map entry using a trailing slash).

`infra/redirects.json` is the single source of truth; `vercel.json`,
`infra/cloudfront-function.js` and `infra/template.yaml` are generated from
it by `scripts/gen-redirects.js` and were re-verified to regenerate
byte-identical in this pass (no drift between source and generated files).

The `/trade-fleet-tyre-services/` question from the original Phase 3B pass
remains **open, not resolved by this correction** — see launch blockers
below.

## 4. Recreated pages

13 pages are recreated as genuinely original content at their exact live
slug (via `scripts/gen-articles.js`), rather than redirected to a general
page:

Original Phase 3B (11): `mobile-tyre-fitting-guide`,
`tyres-bathgate-guide`, `mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation`,
`mobile-tyre-repair-edinburgh-west-lothian`,
`tyre-puncture-repair-near-me-west-lothian`,
`best-mobile-tyre-fitters-bathgate`,
`tyre-fitting-edinburgh-expert-technical-aspects-you-must-know`,
`behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use`,
`better-tyres-better-drive`, `how-to-change-a-tyre`,
`locking-wheel-nut-removal` (consolidating 3 near-duplicate listicles into
one article, with the other 2 redirecting into it).

This correction (2): `emergency-tyre-replacement`,
`the-best-tyres-for-your-ford-on-edinburghs-roads`.

Each recreated page:

- Uses the shared page shell (`scripts/lib/page-shell.js`) — same header,
  navigation, footer, call-now CTA, and quote-form links as every other
  page on the site.
- Has a unique `<title>`, meta description, and exactly one `<h1>`.
- Has a self-referencing `<link rel="canonical">`.
- Has valid `BreadcrumbList` JSON-LD (and `Article` JSON-LD for the
  articles specifically).
- Links internally to relevant service/location pages.
- Is written as original content matching the page's known title/search
  intent — not scraped (the live page bodies were never accessible in this
  environment) and not carrying invented prices, qualifications, response
  times, or statistics. Where the business's real, documented facts are
  used elsewhere on the site (e.g. 24/7 availability), the recreated pages
  stay consistent with them but don't add new unverified specifics.

No FAQPage schema was added to either new page — neither presents content
as a visible Q&A list, so per the correction's brief, FAQ schema was
correctly omitted rather than force-fitted.

## 5. Known uncertainties

- **Inventory is still not proven complete.** Search-index sampling finds
  what ranks for guessed queries; it doesn't enumerate every URL on the
  live site. A genuine Search Console "Pages" export (indexed vs.
  discovered, filtered to the live WordPress property) is the only way to
  close this gap with certainty, and this environment cannot fetch one.
- A handful of core, high-value pages inherited from Phase 3's `SLUG_MAP`
  (`/mobile-tyre-fitting/`, `/mobile-tyre-fitting-bathgate/`,
  `/emergency-tyre-change/`, `/caravan-trailer-tyre-fitting/`) do not have
  an independent, external confirmation on record in this repository that
  their slug exactly matches the live WordPress permalink — they were
  carried forward as Phase 3 assumptions and never subsequently
  contradicted, but "never contradicted" is not the same evidence tier as
  the 45 URLs that were actively confirmed via search. `/mobile-tyre-replacement/`
  in this same inherited group *was* independently confirmed during this
  correction's search pass.
- The Trade & Fleet page content on `sfrmobiletyrefitters.co.uk` (a
  different domain) appears to mirror substantial site content; the
  relationship between that domain and `sfrmotors.co.uk` was not
  investigated further — out of scope for a migration to resolve
  unilaterally.

## 6. Remaining launch blockers

1. **Trade & Fleet URL is unconfirmed.** `/trade-fleet-tyre-services/`
   ships in this build (sitemap, canonical, internal links) as a
   best-match slug, but no confirmed `sfrmotors.co.uk` live URL for this
   content was found — instead, a live Trade & Fleet page was found on
   `sfrmobiletyrefitters.co.uk/trade-fleet-tyres/`, a **different domain**.
   Needs the business owner's clarification on the relationship between
   the two domains before launch — this migration should not guess at it.
2. **Inventory completeness cannot be certified from this environment.**
   A Search Console "Pages" export (or equivalent direct access to the
   live WordPress site/sitemap) is needed to move from "everything found
   so far is handled correctly" to "nothing live has been missed." This
   correction pass closing a 2-URL gap found by search sampling alone is
   itself evidence that search sampling isn't exhaustive.
3. The core-page confirmation gap under "Known uncertainties" above is not
   a known defect, but isn't independently proven either — worth a final
   pass against real Search Console/analytics data before launch.

## 7. Test commands and results (this correction pass, clean checkout)

```
rm -rf dist node_modules
npm install --no-audit --no-fund
npm run build
node scripts/phase3-test.js
node scripts/phase3b-old-url-test.js
```

| Command | Result |
|---|---|
| `npm run build` | Clean build, 41 pages, no errors |
| `node scripts/phase3-test.js` | **204/204 passed, 0 warnings, 0 failed** (includes a new named "Phase 3B correction: restored URLs" section explicitly checking both new pages for: 200, self-referencing canonical, exactly one correct H1, unique title, unique meta description, valid `BreadcrumbList` JSON-LD, sitemap inclusion, no redirect, and all internal links resolving) |
| `node scripts/phase3b-old-url-test.js` | **45/45 passed** (43 from the original Phase 3B pass + the 2 restored URLs, each still single-hop-correct) |
| `node scripts/gen-redirects.js` (re-run, verify no drift) | `vercel.json`, `infra/cloudfront-function.js`, `infra/template.yaml` regenerate byte-identical |
| `node scripts/gen-sitemap.js` (re-run, verify no drift after adding pages) | 41 URLs written, matches 41 real `site/**/index.html` files 1:1 |

## 8. Confirmation: no deployment occurred

No deploy, publish, or push to any hosting target took place during Phase
3B or this correction. No changes were made to the live WordPress site.
All work is committed to `claude/sfr-motors-audit-4ovs2r` only; `dist/`,
`node_modules/`, and `package-lock.json` are gitignored build artifacts,
regenerated locally for testing and not part of any commit.
