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
    fonts/               self-hosted Roboto (latin, one variable WOFF2) + OFL.txt licence
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
| Content-Security-Policy & security headers | CloudFront response headers policy: CSP scoped to the site's actual resources (self + a click-to-load Google Maps embed + consent-gated Google Analytics; fonts are self-hosted, so no Google Fonts origins), HSTS with preload, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy — see `infra/template.yaml` |
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

**Only the real website opens WhatsApp.** The form opens the enquiry only on
`sfrmotors.co.uk` / `www.sfrmotors.co.uk`. On any other hostname (a Vercel
Preview, `localhost`, a temporary or staging address) it validates the form
but shows "Preview copy: nothing was sent and WhatsApp was not opened", keeps
the visitor's entries and fires no analytics event, so a reviewer can never
send a test enquiry to a real customer channel.

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
- the owner-approved corrections (check 18: self-hosted font, click-to-load Map, robots, no street address, ...)
- `vercel.json` is up to date and routes every URL exactly like the CloudFront Function, and sends the Vercel-only noindex header (check 19)
- Analytics and the WhatsApp form work only on the production hostnames (check 20, `scripts/host-guard-tests.js`)
- the deployed-headers checker (`scripts/check-vercel-deployment.js`) passes, fails and refuses as designed, using a fake fetch (check 21)

It's read-only — it never edits `site/` or git state, it only builds
(gitignored `dist/`) and reports. Run it before committing changes to `site/`:

```bash
npm run verify
```

A real-browser test suite (Chrome or Edge over the DevTools protocol, Node 22+, no
new dependencies) lives in `scripts/browser-tests/`: every page at 1280x720 and
375x812, cookie consent + Analytics, the Map click-to-load, the 404 page,
redirects, the calculator and the quote form. It is not part of `verify` because
it needs a browser and takes several minutes:

```bash
npm run build && npm run test:browser
```

Nothing is sent to Google, WhatsApp or the live domain (Google requests are
stubbed/blocked inside the browser; `https://sfrmotors.co.uk` is answered from
the local server).

Prints `QUALITY GATE: PASSED` with a check count on success, or
`QUALITY GATE: FAILED` with one `Error` / `Affected file` / `Suggested fix`
block per issue found, and exits non-zero — safe to wire into CI as-is.

## Deploying the site (hosting)

> **Current hosting plan (owner decision).** A protected **Vercel Preview** is used only so the owner
> and trusted reviewers can look at the site; the intended **Production** host is the
> owner's existing **Hostinger** hosting. The AWS S3 + CloudFront + Route 53 material in
> this section, `infra/` and the runbook is the **previous plan, kept as reference** (no
> AWS account or resource exists). The Hostinger deployment documentation is still to be
> written; see `PROJECT-HANDOVER.md`.
>
> **Vercel Preview.** `vercel.json` is generated from `infra/template.yaml` by
> `node scripts/vercel-config.js` (redirects, pretty-path rewrites, the exact security
> headers and CSP, asset caching) and `npm run verify` (check 19) fails if it drifts.
> Vercel builds with `npm run build` and publishes `dist/`. Every response also carries
> `X-Robots-Tag: noindex, nofollow` (Vercel review copy only; never in `infra/template.yaml`
> or on the real hosting).
>
> **Vercel state (owner-reported from the Vercel Dashboard, 2026-09-20).** One Vercel project remains,
> `sfr-motors-preview` (Project ID `prj_GXRf5TeUa7jJk9PaF2gsy5DMWqMz`), with one deployment: the protected
> **Preview** `https://sfr-motors-preview-i1xangr2b-batoolfizza332-cpu.vercel.app`
> (`dpl_6YRuZrLQC7pcahxbZJT8dSeespys`), target **preview**, Ready, **Vercel Authentication enabled**. Its
> login response carries Vercel's own `X-Robots-Tag: noindex`, but the **application response headers are
> still unverified**. No custom domain is attached to Vercel; the live `sfrmotors.co.uk` is still WordPress
> and DNS, `main` and the live website are unchanged. The next Preview deployment is not yet authorised;
> when it is, pass `--target=preview` explicitly.
>
> **Deleted by the owner (Dashboard, permanent):** the first, accidental **Production** deployment
> `dpl_J5w1LKoeiLP7CR31kJFfTA1i7AhR` (`https://sfr-motors-preview.vercel.app`; Vercel assigns a project's
> first deployment to Production automatically; it was public and had no `X-Robots-Tag`), and the older,
> separate Vercel project `sfr-motors-ltd` (only its Vercel deployments, `*.vercel.app` domains and project
> settings; the GitHub repository and the live WordPress site were not affected).
>
> `node scripts/check-vercel-deployment.js https://<name>.vercel.app` verifies the application headers
> of a **publicly reachable** `*.vercel.app` copy only (plain GETs, redirects not followed, nothing
> sent but the request). On a protected deployment it prints "Deployment is protected; application
> headers remain unverified." (exit 3): neither a pass nor a failure.
>
> **Warning: `npx vercel curl` is not read-only.** On a protected deployment it can create a
> project-level *Protection Bypass for Automation* secret (it did once; the owner removed it in the
> Dashboard). Such a value may remain in the already-built Preview until a redeploy (none is
> authorised yet). Never create a bypass secret, shareable link or protection exception without
> explicit owner approval. Never attach `sfrmotors.co.uk` / `www.sfrmotors.co.uk` to the Preview
> project and never create a Production deployment from it.
>
> **Hostinger staging (Apache/LiteSpeed `.htaccess`).** `node scripts/htaccess-config.js` generates the
> Hostinger routing from `infra/template.yaml`, the same source as `vercel.json`: the legacy WordPress
> 301s, `/mobile-tyre-fitting` and `/mobile-tyre-fitting/` to `/mobile-tyre-fitting.html` (its only indexable URL, one hop), `.html` to pretty-URL 301s (the audit-kept location URLs are served at their exact URL), `/index.html` to `/`, pretty-path serving, `www` to apex, HTTP to
> HTTPS, the 404 page for 403/404, the security headers, the caching policy (all scripts content-hashed and immutable) and `.js` as `text/javascript`. `npm run build:hostinger`
> builds `dist/` and adds `dist/.htaccess` (staging profile: `X-Robots-Tag: noindex, nofollow` and a
> short HSTS, `max-age=300`); the plain `npm run build` never contains it. `npm run verify` (check 22)
> proves the rules route every URL like the CloudFront Function. The `production` profile (the template
> headers, indexable, with HSTS `max-age=31536000` only: no `includeSubDomains`, no `preload`) is for
> the launch. Upload `dist/` only to the
> document root of an isolated, owner-approved staging (sub)domain; never to a folder that holds another
> site. The behaviour on Hostinger's real server is unverified until that staging test is run.

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

## Owner-approved site policies (do not undo without the owner)

- **Social links:** the Facebook / Instagram placeholder icons (`href="#"`) were removed. Add real ones only when the owner
  supplies the confirmed profile URLs; `verify.js` fails on any `href="#"`.
- **Service-area business:** the only public location is **Bathgate, West Lothian**. No street address, postcode or Plus Code
  appears anywhere (check 18 scans `site/`, `backend/` and the info file). The incorrect London registered-office address
  (Beverley Drive, Edgware) was **removed from every page and the Privacy Policy on the owner's instruction**; check 18 fails
  if it comes back.
- **Company line (footer, every page):** "SFR Motors Ltd. Registered in England and Wales, company number 15819240." (no address).
  Note for the owner: UK company law expects a company website to state its registered office address; this was hidden
  because the owner said the London address shown is incorrect. Supply the correct registered office and it can be shown.
- **Contact channels:** phone 0131 202 0289, WhatsApp 07448 427154, email info@sfrmotors.co.uk.
- **Contact-page map:** click-to-load only (nothing is requested from Google until "Load Google Map" is pressed); it shows the
  general Bathgate area, never a business pin.
- **Fonts:** Roboto is self-hosted (`site/assets/fonts/`, SIL OFL 1.1). No request goes to fonts.googleapis.com or fonts.gstatic.com.
- **robots.txt:** everything allowed for normal crawlers; **OAI-SearchBot explicitly allowed; GPTBot disallowed**.
- **Home URL:** `/` is the only Home URL; `/index.html` 301-redirects to `/` and nothing links to it.

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

**Only the production hostnames reach Google.** Google Analytics loads only on
`sfrmotors.co.uk` and `www.sfrmotors.co.uk`. On every other host (`localhost`,
any `*.vercel.app` Preview, a temporary or staging address) the banner and the
stored choice work, but Google Analytics is deliberately not loaded even after
"Accept analytics", so reviewing a preview cannot pollute the live GA4
property. The hostname pattern lives in `assets/js/analytics.js` and
`assets/js/main.js` (identical in both) and `scripts/host-guard-tests.js` runs
both scripts on production, `localhost`, `*.vercel.app` and look-alike
hostnames as part of `npm run verify` (check 20).

**CSP** (`infra/template.yaml`): `script-src` allows `www.googletagmanager.com`;
`connect-src` and `img-src` allow exactly `www.google-analytics.com` and
`region1.google-analytics.com` (the regional collection host Google serves
to UK/EU visitors). No wildcards, no `google.com` / `doubleclick.net`. If
data from visitors in another region is missing after launch, check the
browser console for a CSP violation naming another `*.google-analytics.com`
host. `scripts/verify.js` check 15 enforces all of the above (ID configured
once, no inline/unconditional gtag in any page, consent controls and footer
button on every page, policy text in sync with the code, exact CSP origins).

**Policy text:** `site/privacy-policy.html` sections 5 and 6 (analytics and cookies) describe the
optional analytics, the cookies (`sfr_consent`, `_ga`, `_ga_B9TY4GMXYT`),
their lifetimes, and how to change the choice. Keep them in sync with
`analytics.js` — check 15 fails if the cookie names or the 180-day lifetime
drift apart.
