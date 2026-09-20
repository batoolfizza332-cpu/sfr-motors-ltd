# SFR Motors Ltd — Website Project

This repo has two related things in it:

1. **`*-section.html` files at the repo root** — standalone homepage sections
   (Why Choose Us, Services, FAQ, etc.) built to paste into the existing
   WordPress + Elementor site at sfrmotors.co.uk via an HTML widget.
2. **`site/`** — those same sections grown into a real, standalone static
   website: 18 pages (home, about, contact, services overview, 9 individual
   service pages, 5 location pages) + optimized assets, ready to deploy to
   AWS (S3 + CloudFront) as a self-contained production site, independent of
   WordPress. `backend/` and `infra/` are the AWS-side pieces that support it.

If you just want to keep editing the WordPress site, use the root section
files as before. If you want to run SFR Motors as a standalone AWS-hosted
site, everything below is for that.

## What's in `site/`

```
site/
  index.html             homepage: header, hero, all sections, quote form, footer
  about.html, contact.html, services.html
  mobile-tyre-fitting.html, mobile-tyre-replacement.html, mobile-puncture-repair.html,
  emergency-tyre-change.html, mobile-locking-wheel-nut-removal.html,
  trade-fleet-tyre-services.html, van-tyre-replacement.html,
  caravan-trailer-tyre-fitting.html, tpms-services.html    9 service pages
  mobile-tyre-fitting-{bathgate,edinburgh,livingston,west-lothian,falkirk}.html
                                                            5 location pages
  robots.txt
  sitemap.xml
  assets/
    css/main.css         one shared stylesheet, all pages
    js/main.js            ~110 lines, vanilla JS: mobile nav toggle + quote form submit
    js/analytics.js       cookie-consent banner + consent-gated GA4 conversion tracking
    img/                  AVIF + WebP + JPEG for every photo, pre-generated
```

Every page shares the same `assets/css/main.css` and `assets/js/main.js` — no
per-page bundling, no framework. `site/` itself needs no build step to edit
or preview; `npm run build` (see [Production build](#production-build)
below) only comes in when producing the deployable `dist/` bundle.

### Try it locally

Serve `site/` directly with any static server — no build step needed for
local development:

```bash
npx http-server site -p 5500
```

then open http://localhost:5500.

## How the production checklist is addressed

| Requirement | How |
|---|---|
| Fast page loading | No JS framework, ~110 lines of vanilla JS total, one shared CSS file, images pre-compressed (see below) |
| Secure HTTPS | CloudFront distribution in `infra/template.yaml` is HTTPS-only (`redirect-to-https`), TLS 1.2+ |
| Optimized images (WebP/AVIF) | Every photo has AVIF + WebP + JPEG fallback via `<picture>`; hero has an extra 800w variant for small screens |
| Lazy loading below the fold | Every below-the-fold `<img>` has `loading="lazy" decoding="async"`; the hero image (only above-the-fold photo) uses `fetchpriority="high"` instead |
| Minimal JavaScript | One file, no dependencies: nav toggle + form submit handler |
| Clean semantic HTML | `<header>`, `<nav>`, `<main>`, `<section>`, `<address>`, `<footer>`, proper heading hierarchy throughout |
| Mobile-first responsive | Every section already had mobile breakpoints; nav collapses to a toggle menu under 860px |
| SEO-friendly structure | One clean heading outline, descriptive meta description/OG tags, canonical URL, `robots.txt`, `sitemap.xml`, `AutomotiveBusiness` + `FAQPage` JSON-LD |
| Strong Core Web Vitals | Single hero image is the only eager-loaded asset (LCP candidate), no layout-shifting web fonts (font-display: swap), no render-blocking JS |
| Secure forms with spam protection | Quote form has a honeypot field + a submit-timing check (both checked client- and server-side) + real server-side validation in the Lambda handler + API Gateway rate limiting — see `backend/` |
| Caching & compression | CloudFront `Compress: true` (gzip/brotli) on both cache behaviors; long `max-age=604800, immutable` on `/assets/*`, short cache on HTML so edits show up quickly — see `infra/deploy-site.sh` |
| Content-Security-Policy & security headers | CloudFront response headers policy: CSP scoped to the site's actual resources (self + Google Fonts + Maps embed + consent-gated Google Analytics), HSTS with preload, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy — see `infra/template.yaml` |
| Backup-friendly | S3 bucket versioning is on, with a lifecycle rule expiring old versions after 90 days so storage cost doesn't grow unbounded — full history in git either way |
| Analytics without hurting Core Web Vitals | `gtag.js` is not requested at all until a visitor accepts analytics; then it is injected via JS with `async` — no render-blocking script tag, no impact on LCP/CLS/INP. The consent banner is `position:fixed`, so it causes no layout shift. See "Analytics & conversion tracking" below |

## Quote/contact form: WhatsApp, not the backend

The quote form (on `index.html` and `contact.html`) builds a formatted
enquiry message client-side and opens it as a pre-filled WhatsApp
conversation (`wa.me/447448427154`) — see the "Quote / contact form"
section of `site/assets/js/main.js`. Nothing needs deploying for this to
work; there's no API call involved.

Spam protection in place, both still handled client-side since there's no
server in this flow:
- Honeypot field (`company`) — invisible to real visitors.
- Submit-timing check — the form records when it rendered, and a
  submission arriving under 1.5 seconds later is treated the same way as
  the honeypot (silently shown a fake success, WhatsApp never opens).

### `backend/` (currently unused by the live site)

A Lambda + API Gateway + SES setup for emailing form submissions still
exists in `backend/` and `infra/`, but `site/` no longer calls it — the
form was switched to the WhatsApp flow above because this backend was
never actually deployed successfully in production. The code is left in
place in case email-based delivery is wanted again later; if so, it'd need
`cd backend && sam build && sam deploy --guided` (see `backend/src/handler.js`
for the SES-sandbox and confirmation-email notes), and `site/assets/js/main.js`
would need a fetch() call added back pointing at the deployed API — it
doesn't have one now.

## Production build

`site/` is the source; `dist/` (gitignored, generated) is what actually gets
deployed. `npm run build` (Node 18+) turns one into the other:

- `assets/css/main.css` and `assets/js/*.js` are minified and renamed with a
  content hash — `main.<hash>.css`, `main.<hash>.js` — so they can be cached
  by the browser and CloudFront for a full year without ever going stale: a
  content change produces a new filename, so there's nothing to invalidate.
- Every `.html` page has its asset references rewritten to match, then is
  minified (whitespace/comments only — the inline JSON-LD `<script>` blocks
  are never touched).
- Images, fonts, `robots.txt` and `sitemap.xml` are copied through unchanged
  — already optimized, and their filenames are already stable.

`deploy-site.sh` runs the build itself before syncing, so you don't need to
run it separately — `npm install && npm run build` locally is only useful
for previewing the exact bundle that will ship (`npx http-server dist`).

## Quality gate

`npm run verify` (Node 18+, `npm install` first) runs the production build
and then inspects `site/` for the things that are easy to break by hand:

- the build itself completes without error
- no broken internal `.html` links or `#anchor` targets
- every indexable page has exactly one `<h1>`
- every page has a non-empty, unique `<title>` and meta description
- every page has a correct, unique canonical URL on `https://sfrmotors.co.uk/`
- every local image reference actually exists
- meaningful images have alt text; all `<img>` have explicit width/height
- `sitemap.xml` is well-formed and lists every indexable page
- no leftover placeholder text, `localhost`, or `*.vercel.app` URLs
- `git diff --check` passes (no trailing whitespace / conflict markers)
- cookie consent + consent-gated Google Analytics (check 15, see below)
- the CloudFront Function stays within AWS's service limits (10,240-byte code,
  128-character comment), its routing tables match the canonical URL map, and
  CloudFront serves the dedicated `404.html` for missing URLs (check 16)
- every URL inside the JSON-LD is absolute and on the production domain (check 17)
- no image file in `site/assets/img` is unreferenced (check 7)

It's read-only — it never edits `site/` or git state, it only builds
(gitignored `dist/`) and reports. Run it before committing changes to `site/`:

```bash
npm run verify
```

Prints `QUALITY GATE: PASSED` with a check count on success, or
`QUALITY GATE: FAILED` with one `Error` / `Affected file` / `Suggested fix`
block per issue found, and exits non-zero — safe to wire into CI as-is.

## Deploying the site (hosting)

**Read `infra/CUTOVER-RUNBOOK.md` first** — it holds the backup, cutover and
rollback plan (the live site is WordPress on Hostinger, and its e-mail is
hosted there too). Merging to `main` triggers an automatic deploy to S3
(see "Automatic deployments" below).

Requires an ACM certificate issued in **us-east-1** (CloudFront requirement)
that covers **both `sfrmotors.co.uk` and `www.sfrmotors.co.uk`** (the
CloudFront Function 301-redirects `www` to the apex, as WordPress does today;
pass `IncludeWww=false` only if `www` is deliberately unused) — create and
DNS-validate that first.

```bash
cd infra
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name sfr-motors-site \
  --parameter-overrides DomainName=sfrmotors.co.uk AcmCertificateArn=<your-cert-arn>
```

Then point your domain's DNS at the CloudFront distribution (Route 53 alias
records; an apex/root domain cannot be a plain CNAME, so another DNS provider
must offer an ALIAS/ANAME record type — see the runbook), and push content with:

```bash
BUCKET=<Outputs.BucketName> DISTRIBUTION_ID=<Outputs.DistributionId> ./deploy-site.sh
```

## Automatic deployments (CI/CD)

Once the steps above have run at least once, further content edits can
deploy themselves: push to `main`, GitHub Actions builds `site/` into `dist/`,
syncs it to S3 and invalidates the CloudFront cache automatically
(`.github/workflows/deploy.yml`, triggered when `site/`, `scripts/build.js`
or `package.json` changes).

No AWS access keys are stored in GitHub. The workflow uses OpenID Connect to
assume a narrowly-scoped IAM role for the few seconds a deploy takes, then
the credentials expire. One-time setup, after the site stack already exists:

```bash
cd infra
aws cloudformation deploy \
  --template-file github-oidc.yaml \
  --stack-name sfr-motors-github-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOrgAndRepo=<your-github-username>/<repo-name> \
    SiteBucketArn=<template.yaml Outputs.BucketArn> \
    DistributionArn=<template.yaml Outputs.DistributionArn>
```

Then in the GitHub repo: **Settings → Secrets and variables → Actions →
Variables**, add four repository variables (not secrets — none of these are
sensitive on their own, they're just resource identifiers):

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `github-oidc.yaml` output `RoleArn` |
| `AWS_REGION` | the region you deployed `template.yaml` into |
| `SITE_BUCKET` | `template.yaml` output `BucketName` |
| `DISTRIBUTION_ID` | `template.yaml` output `DistributionId` |

If an AWS account already has a GitHub OIDC provider from another project
(only one is allowed per account per provider URL), remove the
`GitHubOidcProvider` resource from `github-oidc.yaml` before deploying it and
reference the existing provider's ARN instead.

Manual deploys with `./deploy-site.sh` still work fine any time — CI/CD is
an addition, not a replacement.

## Estimated monthly cost

For a small business site at typical low-to-moderate traffic, everything
here runs on pay-per-use pricing — there's no fixed server to pay for
whether or not anyone visits:

| Service | What drives cost | Typical monthly cost |
|---|---|---|
| S3 (site storage) | ~3MB of files, versioned with a 90-day expiry | well under $0.10 |
| CloudFront (CDN) | Data transfer + requests; first 1TB/month and first 10M requests are on the AWS Free Tier | $0–2 for a small site, even off the free tier |
| Lambda (quote form) | Pay per invocation; a contact form gets dozens, not millions, of submissions | effectively $0 (covered by the always-free tier) |
| API Gateway (HTTP API) | Pay per request, cheaper than the older REST API type | effectively $0 at this volume |
| SES (email sending) | Pay per email sent | effectively $0 (a few cents per 1,000 emails) |
| Route 53 (DNS, if used) | Hosted zone + queries | ~$0.50/month + query volume |
| ACM (SSL certificate) | — | free |

Realistic total: **a few dollars a month**, dominated by CloudFront data
transfer once traffic grows — there's no database, container, or
always-on compute anywhere in this stack to pay for at idle.

## Known placeholders to fill in before going live

- `footer-section.html` / the footer in `site/index.html` — Facebook and
  Instagram icons currently link to `#`. Multiple similarly-named accounts
  turned up in a search and none are linked from the live WordPress site,
  so rather than guess, these are left for you to fill in with the
  confirmed official profile URLs.

## Analytics, cookie consent & conversion tracking

`assets/js/analytics.js` is the whole implementation (one file, loaded on
every page): a small first-party consent banner plus consent-gated Google
Analytics 4. The Measurement ID (`G-B9TY4GMXYT`, public by design) is set
once in that file as `GA_MEASUREMENT_ID`.

**Consent behaviour**

| State | What happens |
|---|---|
| First visit | A compact banner offers **Accept analytics** and **Reject analytics** (same size, weight and contrast). Nothing Google-related is requested, no `dataLayer`/`gtag` exists, no `_ga` cookie is set. Scrolling, waiting or pressing Escape is *not* consent. |
| Accepted | `sfr_consent=v1:analytics=granted` is stored; `gtag.js` is injected once (`https://www.googletagmanager.com/gtag/js?id=G-B9TY4GMXYT`), initialised once (one `page_view`), then phone/WhatsApp/quote events are sent. |
| Rejected | `sfr_consent=v1:analytics=denied` is stored; Google is never loaded; any `_ga*` cookies are cleared. The site works exactly the same. |
| Change / withdraw | Every page footer has a **Cookie settings** button that reopens the choices (modal, keyboard-trapped, Escape closes without changing anything). Accept -> Reject stops the tag (`ga-disable-<ID>`), deletes `_ga` / `_ga_B9TY4GMXYT`, then reloads the page so no Google code is left running. Reject -> Accept loads GA once, with no reload. |

The preference is one essential first-party cookie, `sfr_consent`
(`Path=/`, `SameSite=Lax`, `Secure` on HTTPS, **180 days**), holding only
the choice and a version marker — no personal data, no web storage. It is
not forwarded by CloudFront (the cache policies use `CookieBehavior: none`).

**Events (sent only while consent is granted)**

| Event | Fires when | Parameters |
|---|---|---|
| `phone_click` | any `tel:` link is clicked | `page_path`, `page_type`, `link_location` (`top_bar` / `header` / `footer` / `page_content`) — never the number or link text |
| `whatsapp_click` | any `https://wa.me/...` link is clicked | same three — never the number or message |
| `quote_request` | the quote/contact form is submitted **and WhatsApp opens with the enquiry pre-filled** (never on the honeypot/bot-timing path) | `page_path`, `page_type` — no form content |
| `contact_form_submit` | the same submission, on the Contact page | `page_path`, `page_type` |
| `cta_click` | a link pointing at `#quote-form` is clicked | `page_path`, `page_type`, `link_location`, `link_text` |
| `nav_click` | a main-navigation link is clicked | `page_path`, `page_type`, `link_location`, `link_text` |

`page_type` is `core` / `service` / `location`, computed from the URL.
Google signals and ad personalisation are switched off in the tag config
and the Consent Mode default denies `ad_storage`, `ad_user_data` and
`ad_personalization`, so no advertising cookies or Google Ads origins are
involved. GA4's "Enhanced measurement" (scroll, outbound-click, etc.) is a
property-side setting in the Analytics admin, not controlled by this code.

**Local previews never reach Google.** On `localhost` / `127.0.0.1` the
banner and the stored choice work, but Google Analytics is deliberately not
loaded, so testing the preview cannot pollute the live GA4 property.

**CSP** (`infra/template.yaml`): `script-src` allows `www.googletagmanager.com`;
`connect-src` and `img-src` allow exactly `www.google-analytics.com` and
`region1.google-analytics.com` (the regional collection host Google serves
to UK/EU visitors). No wildcards, no `google.com` / `doubleclick.net`. If
data from visitors in another region is missing after launch, check the
browser console for a CSP violation naming another `*.google-analytics.com`
host. `scripts/verify.js` check 15 enforces all of the above (ID configured
once, no inline/unconditional gtag in any page, consent controls and footer
button on every page, policy text in sync with the code, exact CSP origins).

**Policy text:** `site/privacy-policy.html` sections 3 and 4 describe the
optional analytics, the cookies (`sfr_consent`, `_ga`, `_ga_B9TY4GMXYT`),
their lifetimes, and how to change the choice. Keep them in sync with
`analytics.js` — check 15 fails if the cookie names or the 180-day lifetime
drift apart.
