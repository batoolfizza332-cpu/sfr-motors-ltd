# Cutover, backup and rollback runbook (WordPress -> S3 + CloudFront)

Status: **plan only** — nothing here has been run. Written from the pre-deployment audit of branch
`feature/seo-safe-migration`. Items marked **UNKNOWN** could not be verified from the repository and need the owner.

## 0. What is true today (checked read-only on 2026-09-20)

| Fact | Evidence |
|---|---|
| The live site is WordPress on **Hostinger** (LiteSpeed, PHP), IP `82.29.191.9` | response headers of `https://sfrmotors.co.uk/` |
| DNS is hosted at **Hostinger DNS** (`pixel.dns-parking.com`, `byte.dns-parking.com`) | `NS` lookup |
| `www` is a CNAME to the apex; both `http://` variants 301 to `https://`, and `https://www.` 301s to `https://sfrmotors.co.uk/` | `curl -I` |
| **Email is on Hostinger** (`MX` -> `mx1.hostinger.com`, `mx2.hostinger.com`) | `MX` lookup |
| Merging to `main` **auto-deploys** `site/**` to S3 and invalidates CloudFront (`.github/workflows/deploy.yml`) | workflow file |

Consequences: (1) DNS changes must not touch MX/TXT records or e-mail (`info@sfrmotors.co.uk`) stops. (2) A CloudFront
distribution cannot be the target of an apex CNAME — see step C3. (3) Do not merge to `main` until the AWS stacks and repo
variables exist and you are ready for the build to go to S3 (S3 upload alone is harmless while DNS still points at WordPress).

## A. Before cutover — what must be backed up (all read-only / copy operations)

1. **WordPress, complete**: all files (`wp-content` incl. `uploads`, themes, plugins) + database export, downloaded to a
   machine you control (Hostinger hPanel backup or your backup plugin). Note the WordPress/PHP version, active plugins and
   permalink structure. Keep it until at least 30 days after a stable cutover.
2. **DNS zone, complete**: export or screenshot *every* record at Hostinger (A, AAAA, CNAME, MX, TXT incl. SPF / DKIM / DMARC /
   Google or other site-verification TXT, NS) with their TTLs. This file is the rollback source of truth.
3. **Search/analytics verification**: **UNKNOWN** how Google Search Console and Google Business Profile are verified. If it
   is by a WordPress plugin, meta tag or uploaded HTML file it will be lost when WordPress stops serving the domain — switch to
   the DNS TXT method *before* cutover. GA4 stream `G-B9TY4GMXYT` needs no change.
4. **URL inventory**: save the live WordPress sitemap URL list; after cutover every URL there must return 200 or a 301 to a
   page that exists (the static site already implements the audit-approved redirects — `infra/template.yaml`).
5. **Release identity**: record the exact commit SHA to be released (and, with the owner's approval at that moment, tag it,
   e.g. `git tag release-YYYYMMDD <sha>`). Keep a zip of the built `dist/` for that SHA.
6. **Last known-good static deployment**: the S3 bucket is versioned (90-day noncurrent retention), so every earlier object
   version is recoverable. Write down the CloudFront distribution ID, the stack parameters and the S3 version IDs of
   `index.html`, `404.html`, `robots.txt`, `sitemap.xml` after the first successful deploy.
7. **Lower DNS TTLs** on the apex and `www` records to 300 s (or 60 s) at least 24–48 h before cutover, so a rollback
   propagates quickly. Old TTL is **UNKNOWN**.

## B. Stand everything up while WordPress is still live (no visitor impact)

1. Create/validate an **ACM certificate in `us-east-1` covering both `sfrmotors.co.uk` and `www.sfrmotors.co.uk`**
   (DNS validation = adding validation CNAMEs at Hostinger; does not affect traffic).
2. Deploy `infra/template.yaml` (parameters `DomainName`, `AcmCertificateArn`, `IncludeWww=true`). Then `infra/github-oidc.yaml`,
   then set the four repo variables named in `deploy.yml`.
3. Deploy the site (script or workflow). The site is now live on `https://<distribution>.cloudfront.net` only.
4. **Rehearse the real hostname without changing DNS**, using a fixed IP for the distribution:
   `curl -sI --resolve sfrmotors.co.uk:443:<a CloudFront IP for the distribution> https://sfrmotors.co.uk/`
   Run the section E checks this way (and the same with `www.sfrmotors.co.uk`). Browsers can do the same with a temporary
   hosts-file entry. Cookie choices: click **Reject analytics** while rehearsing so no test data reaches GA4 (only localhost is
   auto-excluded).

## C. Cutover (choose a quiet weekday morning; keep phone/WhatsApp attended)

1. Freeze WordPress edits. Take a final WordPress backup.
2. Confirm the section E checks pass via `--resolve`.
3. **DNS switch — owner decision (UNKNOWN which is possible):**
   * *Recommended:* move DNS to **Route 53** in two steps. First create the hosted zone with **every existing record copied**
     (still pointing at WordPress), verify with `dig @<route53 ns> ...` that answers match Hostinger for A/MX/TXT, and change
     the registrar's nameservers (this changes *no* traffic; allow up to 48 h). Then the cutover itself is one change: apex
     `A`/`AAAA` **ALIAS** to the distribution, and `www` CNAME/ALIAS to the distribution.
   * *Alternative:* keep Hostinger DNS only if it supports an apex ALIAS/ANAME to `*.cloudfront.net`. A plain apex CNAME is not
     valid DNS, and hard-coding CloudFront IPs is not supported.
4. Watch: `dig +short sfrmotors.co.uk`, then the section E checks on the real DNS name. Keep WordPress hosting running.

## D. Rollback

**Triggers (any one):** TLS/certificate error on apex or `www`; 403/5xx on `/` or on several pages; redirect loop; a
key page (Home, Contact, a service page) missing or unstyled; phone/WhatsApp/quote flow broken; Google Map blocked by CSP;
`www` not redirecting; e-mail delivery affected.

**Sequence:**
1. **Revert DNS** for apex and `www` to the exported Hostinger records (A `82.29.191.9`, `www` CNAME -> apex). With the lowered
   TTL this takes minutes. *Do not delete the CloudFront distribution or the S3 bucket* (they are the known-good copy).
2. Confirm WordPress serves `/`, and e-mail still works (send/receive a test message).
3. Content-only defect (site itself is fine)? Do **not** roll DNS back: restore the previous S3 object versions
   (`aws s3api list-object-versions` -> copy the prior version over the current key) and create a CloudFront invalidation
   (`/*` covers pages; assets are content-hashed and immutable).
4. Fix on the feature branch, repeat section B.4 rehearsal, cut over again.
5. Keep the WordPress hosting plan and its backups **at least 30 days** after a stable cutover. Do not cancel Hostinger
   while e-mail is hosted there.

## E. Immediate post-deployment checks (run on the real hostname)

| Check | Expected |
|---|---|
| `curl -sI https://sfrmotors.co.uk/` | 200, `strict-transport-security`, `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `content-encoding: br` or `gzip` |
| `curl -sI http://sfrmotors.co.uk/` and `https://www.sfrmotors.co.uk/` | 301 to `https://sfrmotors.co.uk/` in one hop |
| `/about.html`, `/emergency-tyre-change.html`, the four blog `.html` URLs | 301 to the pretty path; `/about-us/` etc. 200 |
| `/does-not/exist/` | HTTP **404**, the styled "Page not found" page, `noindex` |
| `robots.txt`, `sitemap.xml`, `favicon.ico` | 200; robots allows everything (OAI-SearchBot allowed) |
| `content-type` of one `.avif`, `.webp`, `.css`, `.js` under `/assets/` | `image/avif`, `image/webp`, `text/css`, JavaScript; `cache-control: public, max-age=31536000, immutable` |
| HTML `cache-control` | `public, max-age=300, must-revalidate` |
| Browser, Desktop + Mobile: Home, About, Contact, a service, a location, a blog post, calculator | styled, no console/CSP errors, images load, Map loads |
| Cookie banner: Reject then Accept | Reject: no Google request; Accept: `gtag/js?id=G-B9TY4GMXYT` once, GA4 Realtime shows the visit |
| `tel:` and WhatsApp links; quote form up to the WhatsApp hand-off | correct number; opens WhatsApp |
| PageSpeed Insights (mobile) on Home + one service page | record the real numbers; field data appears only after ~28 days of traffic |
| Search Console: submit `sitemap.xml`, inspect Home + one deep URL; confirm the property is still verified | no verification loss |
| CloudFront console: 4xx/5xx rate for the first hours | flat |
