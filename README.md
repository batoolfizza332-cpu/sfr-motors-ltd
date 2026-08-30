# SFR Motors Ltd — Website Project

This repo has two related things in it:

1. **`*-section.html` files at the repo root** — standalone homepage sections
   (Why Choose Us, Services, FAQ, etc.) built to paste into the existing
   WordPress + Elementor site at sfrmotors.co.uk via an HTML widget.
2. **`site/`** — those same sections assembled into one real, standalone
   static website: `index.html` + optimized assets, ready to deploy to AWS
   (S3 + CloudFront) as a self-contained production site, independent of
   WordPress. `backend/` and `infra/` are the AWS-side pieces that support it.

If you just want to keep editing the WordPress site, use the root section
files as before. If you want to run SFR Motors as a standalone AWS-hosted
site, everything below is for that.

## What's in `site/`

```
site/
  index.html            full page: header, hero, all sections, quote form, footer
  robots.txt
  sitemap.xml
  assets/
    css/main.css         all section styles, concatenated (no build step needed)
    js/main.js            ~90 lines, vanilla JS: mobile nav toggle + quote form submit
    img/                  AVIF + WebP + JPEG for every photo, pre-generated
```

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
| Fast page loading | No JS framework, ~90 lines of vanilla JS total, one concatenated CSS file, images pre-compressed (see below) |
| Secure HTTPS | CloudFront distribution in `infra/template.yaml` is HTTPS-only (`redirect-to-https`), TLS 1.2+ |
| Optimized images (WebP/AVIF) | Every photo has AVIF + WebP + JPEG fallback via `<picture>`; hero has an extra 800w variant for small screens |
| Lazy loading below the fold | Every below-the-fold `<img>` has `loading="lazy" decoding="async"`; the hero image (only above-the-fold photo) uses `fetchpriority="high"` instead |
| Minimal JavaScript | One file, no dependencies: nav toggle + form submit handler |
| Clean semantic HTML | `<header>`, `<nav>`, `<main>`, `<section>`, `<address>`, `<footer>`, proper heading hierarchy throughout |
| Mobile-first responsive | Every section already had mobile breakpoints; nav collapses to a toggle menu under 860px |
| SEO-friendly structure | One clean heading outline, descriptive meta description/OG tags, canonical URL, `robots.txt`, `sitemap.xml`, `AutomotiveBusiness` + `FAQPage` JSON-LD |
| Strong Core Web Vitals | Single hero image is the only eager-loaded asset (LCP candidate), no layout-shifting web fonts (font-display: swap), no render-blocking JS |
| Secure forms with spam protection | Quote form has a honeypot field (checked client- and server-side) + real server-side validation in the Lambda handler + API Gateway rate limiting — see `backend/` |
| Caching & compression | CloudFront `Compress: true` (gzip/brotli) on both cache behaviors; long `max-age=604800, immutable` on `/assets/*`, short cache on `index.html` so edits show up quickly — see `infra/deploy-site.sh` |

## Deploying the backend (contact form)

The quote form posts to a Lambda function behind API Gateway, which emails
the submission via SES. Requires the AWS SAM CLI.

```bash
cd backend
sam build
sam deploy --guided
```

On first run it'll ask for `AllowedOrigin`, `ToEmail`, `FromEmail` — defaults
are already sfrmotors.co.uk / info@sfrmotors.co.uk. **Both `ToEmail` and
`FromEmail` must be verified in SES** (or the account moved out of the SES
sandbox) or sending will fail.

After deploy, copy the `QuoteApiUrl` output into
`site/assets/js/main.js` → `QUOTE_API_ENDPOINT`, then redeploy the site.

Spam protection in place:
- Honeypot field (`company`) — invisible to real visitors, checked both in
  the browser and again in the Lambda, so it can't be bypassed by calling
  the API directly.
- Server-side validation (required fields, email format, length limits,
  `<`/`>` stripped so submitted text can't inject markup into the
  notification email).
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

## Known placeholders to fill in before going live

- `site/assets/js/main.js` — `QUOTE_API_ENDPOINT` (set after backend deploy)
- `footer-section.html` / the footer in `site/index.html` — Facebook and
  Instagram icons currently link to `#`. Multiple similarly-named accounts
  turned up in a search and none are linked from the live WordPress site,
  so rather than guess, these are left for you to fill in with the
  confirmed official profile URLs.
