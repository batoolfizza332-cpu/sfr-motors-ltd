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
    css/main.css         one shared stylesheet, all pages (no build step needed)
    js/main.js            ~110 lines, vanilla JS: mobile nav toggle + quote form submit
    img/                  AVIF + WebP + JPEG for every photo, pre-generated
```

Every page shares the same `assets/css/main.css` and `assets/js/main.js` — no
per-page bundling, no framework, nothing to build.

### Try it locally

No build step — it's static HTML/CSS/JS. Serve the folder with any static
server, e.g.:

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
| Content-Security-Policy & security headers | CloudFront response headers policy: CSP scoped to the site's actual resources (self + Google Fonts + Maps embed + the quote API), HSTS with preload, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy — see `infra/template.yaml` |
| Backup-friendly | S3 bucket versioning is on, with a lifecycle rule expiring old versions after 90 days so storage cost doesn't grow unbounded — full history in git either way |
| Analytics without hurting Core Web Vitals | `gtag.js` is injected via JS with `async`, after the page's own `dataLayer`/`gtag()` are defined synchronously (so no early events are lost) — no render-blocking script tag, no impact on LCP/CLS/INP. See "Analytics & conversion tracking" below |

## Deploying the backend (contact form)

The quote form posts to a Lambda function behind API Gateway, which emails
the submission via SES. Requires the AWS SAM CLI.

```bash
cd backend
sam build
sam deploy --guided
```

On first run it'll ask for `AllowedOrigin`, `ToEmail`, `FromEmail` — defaults
are already sfrmotors.co.uk / info@sfrmotors.co.uk. **`FromEmail` must be a
verified SES identity.** The handler also emails a confirmation back to
whichever address the customer submitted — since that's an arbitrary address
you can't pre-verify, **the SES account needs to be moved out of the sandbox**
(a one-time request in the SES console) or those confirmation emails will
silently fail to send (the customer's request still reaches the business
either way — see `backend/src/handler.js` for why that failure is
non-fatal).

After deploy, copy the `QuoteApiUrl` output into
`site/assets/js/main.js` → `QUOTE_API_ENDPOINT`, then redeploy the site.

Spam protection in place:
- Honeypot field (`company`) — invisible to real visitors, checked both in
  the browser and again in the Lambda, so it can't be bypassed by calling
  the API directly.
- Submit-timing check — the form records when it rendered and sends that
  back on submit; the Lambda silently drops anything that arrives under
  1.5 seconds later, the same way it handles the honeypot.
- Server-side validation (required fields, email + phone format, length
  limits, `<`/`>` stripped so submitted text can't inject markup into
  either email).
- API Gateway throttling (2 req/s sustained, burst 5) on the route.
- For heavier spam/bot traffic, put AWS WAF in front of the API with a
  rate-based rule — not included here to keep the base setup simple, but
  it's a drop-in addition.

## Deploying the site (hosting)

Requires an ACM certificate for your domain, issued in **us-east-1**
(CloudFront requirement) — create and DNS-validate that first.

```bash
cd infra
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name sfr-motors-site \
  --parameter-overrides DomainName=sfrmotors.co.uk AcmCertificateArn=<your-cert-arn>
```

Then point your domain's DNS at the CloudFront distribution (Route 53 alias,
or a CNAME to the `DistributionDomainName` output if using another DNS
provider), and push content with:

```bash
BUCKET=<Outputs.BucketName> DISTRIBUTION_ID=<Outputs.DistributionId> ./deploy-site.sh
```

## Automatic deployments (CI/CD)

Once the steps above have run at least once, further content edits can
deploy themselves: push to `main`, GitHub Actions syncs `site/` to S3 and
invalidates the CloudFront cache automatically (`.github/workflows/deploy.yml`,
triggered only when something under `site/` changes).

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

- `site/assets/js/main.js` — `QUOTE_API_ENDPOINT` (set after backend deploy)
- `site/assets/js/analytics.js` — `GA_MEASUREMENT_ID` (see below)
- `footer-section.html` / the footer in `site/index.html` — Facebook and
  Instagram icons currently link to `#`. Multiple similarly-named accounts
  turned up in a search and none are linked from the live WordPress site,
  so rather than guess, these are left for you to fill in with the
  confirmed official profile URLs.

## Analytics & conversion tracking

`assets/js/analytics.js` loads GA4 (`gtag.js`) asynchronously — it never
blocks rendering — and tracks these conversion events automatically on
every page:

| Event | Fires when |
|---|---|
| `phone_click` | any `tel:` link is clicked (header, hero, footer, "Call Now" buttons — one listener covers all of them) |
| `whatsapp_click` | any `https://wa.me/...` link is clicked |
| `quote_request` | the quote/contact form is submitted **and the backend confirms success** — never on the honeypot's silent-success path, so bot traffic can't inflate this number |
| `contact_form_submit` | the same successful submission, specifically when it happened on `contact.html` |
| `cta_click` | a "Get A Free Quote" / "Request..." link pointing at `#quote-form` is clicked, before submission — separates click-through from actual completed requests |
| `nav_click` | a main navigation link is clicked |

Every event also carries a `page_type` parameter (`core` / `service` /
`location`), computed from the URL by `analytics.js` itself — so "key
service page visits" and "location page visits" can be segmented in GA4
without editing all 18 pages individually to tag them.

**Not tracked, by design:** nothing typed into the form (name, phone,
email, message) is ever sent as an event parameter — only the fact that
a submission happened.

**To activate:** put your real GA4 Measurement ID (Google Analytics ->
Admin -> Data Streams -> your web stream) into `GA_MEASUREMENT_ID` in
`site/assets/js/analytics.js`. It's not a secret — Measurement IDs are
public by design, visible in any browser's network tab on every GA4
site — this is a single named placeholder purely so there's one place to
set it instead of 18. Until it's set, the file no-ops entirely: no
script loads, no listeners attach, nothing is sent.

**Before enabling real tracking:** as a UK business, cookie-based
analytics like GA4 generally needs visitor consent under UK PECR/GDPR
rules. This setup doesn't include a consent banner or Google Consent
Mode — deliberately, since that's a compliance decision for you to make
(a simple accept/reject banner, Consent Mode with default-denied
analytics, or accepting the risk at low traffic are all common choices
for a small business site) rather than something to bake in unasked.
