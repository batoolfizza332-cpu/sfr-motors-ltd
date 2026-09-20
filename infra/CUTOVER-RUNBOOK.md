# Cutover, backup and rollback runbook (WordPress -> S3 + CloudFront, DNS on Route 53)

Status: **plan only — no DNS mutation, no AWS resource and no deployment is authorised by this document.** Every step
below needs the owner's separate, explicit approval at the time it is run. Written from the pre-deployment audit of
branch `feature/seo-safe-migration` and updated with the owner-approved decisions. Items marked **UNKNOWN** could not
be verified from the repository and need the owner.

> **Previous plan, kept as reference.** The owner has since decided on a **Vercel Preview** for review and **Hostinger** as the intended Production host
> (see `../PROJECT-HANDOVER.md` section 2A). This runbook describes the earlier AWS S3 + CloudFront + Route 53 plan; no AWS account exists. Its backup,
> e-mail-baseline and rollback thinking is still useful, but the AWS/Route 53 steps must not be run, and a Hostinger runbook is still to be written.

Related documents: [`../PROJECT-HANDOVER.md`](../PROJECT-HANDOVER.md) (full project state) and
[`../README.md`](../README.md) (build, verify, hosting, analytics).

## 0. Approved approach and facts (checked read-only on 2026-09-20)

**Owner-approved decisions**

* The **domain registration stays at Hostinger** (registrar).
* **DNS management moves to AWS Route 53** at deployment time (nameservers at the registrar are pointed at Route 53).
* **Hostinger e-mail is not touched.** Every existing e-mail-related record is copied to Route 53 and verified before
  any nameserver change.
* The website is served from S3 + CloudFront; Route 53 **Alias** records point the apex and `www` at CloudFront.

**Facts**

| Fact | Evidence |
|---|---|
| The live site is WordPress on **Hostinger** (LiteSpeed, PHP), IP `82.29.191.9` | response headers of `https://sfrmotors.co.uk/` |
| DNS is currently hosted at **Hostinger DNS** (`pixel.dns-parking.com`, `byte.dns-parking.com`) | `NS` lookup |
| `www` is a CNAME to the apex; `http://` variants 301 to `https://`, and `https://www.` 301s to `https://sfrmotors.co.uk/` | `curl -I` |
| **E-mail is on Hostinger** (`MX` -> `mx1.hostinger.com`, `mx2.hostinger.com`) | `MX` lookup |
| Merging to `main` **auto-deploys** `site/**` to S3 and invalidates CloudFront (`.github/workflows/deploy.yml`) | workflow file |
| DNSSEC state of `sfrmotors.co.uk`: **UNKNOWN** — must be checked (section A.3) | — |

Consequences: (1) DNS work must never alter MX / SPF / DKIM / DMARC / other TXT records or `info@sfrmotors.co.uk` stops.
(2) A CloudFront distribution cannot be the target of an apex CNAME — Route 53 Alias records solve this. (3) Do not merge
to `main` until the AWS stacks and repo variables exist and the build is meant to go to S3 (an S3 upload alone is
harmless while DNS still points at WordPress).

## A. Before anything changes — back up and inventory (read-only / copy operations)

1. **WordPress, complete**: all files (`wp-content` incl. `uploads`, themes, plugins) + database export, downloaded to a
   machine you control (Hostinger backup or your backup plugin). Note WordPress/PHP versions, active plugins and permalink
   structure. Keep them until at least 30 days after a stable cutover.
2. **DNS zone, complete — the rollback source of truth.** In Hostinger's DNS editor, export or screenshot **every** record
   (name, type, value, TTL): A, AAAA, CNAME, MX, TXT (SPF, DKIM, DMARC, Google / other site-verification), SRV, CAA and any
   e-mail helper records (for example `autodiscover` / `autoconfig`). Save it as `dns-backup-<date>.txt` outside the
   repository (it contains no secrets but is not project source). Also record the **current nameservers**.
3. **DNSSEC / registrar check.** At the registrar, confirm whether DNSSEC (a DS record) is enabled for the domain. If it is,
   switching nameservers without handling it breaks resolution — decide with the owner before proceeding. Also record any
   registrar lock / transfer settings; **do not change them**.
4. **E-mail baseline** (do this now and repeat after every DNS change): send a test message from an external mailbox to
   `info@sfrmotors.co.uk` and back; open the received message's headers and note `spf=pass`, `dkim=pass`, `dmarc=pass`
   (or whatever the current results are). Save the header lines. Any later difference is a regression.
5. **Search / analytics verification**: **UNKNOWN** how Google Search Console and Google Business Profile are verified. If
   it is by a WordPress plugin, meta tag or uploaded HTML file it is lost when WordPress stops serving the domain — switch
   to the DNS TXT method *before* cutover (and copy that TXT record into Route 53). GA4 stream `G-B9TY4GMXYT` needs no change.
6. **URL inventory**: save the live WordPress sitemap URL list; after cutover every URL there must return 200 or a 301 to a
   page that exists (the static site implements the audit-approved redirects — `infra/template.yaml`).
7. **Release identity**: record the exact commit SHA to be released (and, with the owner's approval at that moment, tag it,
   e.g. `git tag release-YYYYMMDD <sha>`). Keep a zip of the built `dist/` for that SHA.
8. **Last known-good static deployment**: the S3 bucket is versioned (90-day noncurrent retention), so every earlier object
   version is recoverable. After the first successful deploy write down the distribution ID, stack parameters and the S3
   version IDs of `index.html`, `404.html`, `robots.txt`, `sitemap.xml`.

## B. Stand everything up while WordPress is still live (no visitor impact)

1. Create/validate an **ACM certificate in `us-east-1` covering both `sfrmotors.co.uk` and `www.sfrmotors.co.uk`** (DNS
   validation = adding the validation CNAMEs; do this in Route 53 once the zone exists, or at Hostinger before the move).
2. Deploy `infra/template.yaml` (parameters `DomainName`, `AcmCertificateArn`, `IncludeWww=true`). Then
   `infra/github-oidc.yaml`, then set the four repo variables named in `deploy.yml`.
3. Deploy the site (script or workflow). It is now live on `https://<distribution>.cloudfront.net` only.
4. **Rehearse the real hostname without changing DNS**, using a fixed IP for the distribution:
   `curl -sI --resolve sfrmotors.co.uk:443:<a CloudFront IP for the distribution> https://sfrmotors.co.uk/`
   Run the section F checks this way (and for `www`). While rehearsing, click **Reject analytics** so no test data reaches GA4.

## C. Route 53: build the zone first, change no traffic

Nothing in this section changes what visitors or e-mail senders see, because the Hostinger zone stays authoritative until
section D.

1. **Create the public hosted zone** `sfrmotors.co.uk` in Route 53. Record its four assigned nameservers. (Creating a zone
   affects nothing until the registrar's nameservers point at it.)
2. **Copy every record from the section A.2 export into the Route 53 zone**, with these rules:
   * Do **not** copy the zone's own `NS` and `SOA` records — Route 53 creates its own.
   * Copy **MX, SPF, DKIM, DMARC and every other TXT / CNAME / SRV / CAA record exactly** (same names, values, priorities).
     TXT values longer than 255 characters (DKIM keys) must be entered as several quoted strings inside one value — Route 53's
     console does this when you paste the full value; check the saved record.
   * Keep the **apex `A` (and any `AAAA`) pointing at WordPress (`82.29.191.9`) for now**, and `www` as a CNAME to the apex, as
     they are today. Set the TTL of those records to **300 s**.
3. **Prove the copy before touching nameservers.** For every record name/type in the export run, against Hostinger and
   against each of the four Route 53 nameservers:
   `dig +short <name> <type> @pixel.dns-parking.com` and `dig +short <name> <type> @<route53-ns>`
   The answers must be identical for MX, TXT (SPF/DMARC), DKIM names, `www`, and any verification records. Save the
   comparison. **Do not continue until MX/SPF/DKIM/DMARC match exactly.**
4. **Lower TTLs**: the `.uk` registry's NS delegation TTL is set by the registry (typically about 48 hours) and cannot be
   lowered by you, so plan the nameserver move for a quiet period and expect up to ~48 h of mixed resolvers. Records inside
   the zones (already 300 s in Route 53) can be lowered in the Hostinger zone too where the editor allows it.

## D. Move DNS management to Route 53 (nameserver change at Hostinger, the registrar)

Only after C.3 is signed off, and with the owner present.

1. Record the current nameservers again (`pixel.dns-parking.com`, `byte.dns-parking.com`) — this is the rollback target.
2. In the Hostinger domain settings for `sfrmotors.co.uk`, replace the nameservers with the four Route 53 nameservers.
   **Do not edit the Hostinger DNS zone, the mailboxes or the e-mail plan.** Leave the Hostinger zone untouched so it remains
   an identical, working fallback.
3. During propagation both zones answer identically (website still WordPress, e-mail unchanged). Verify at +15 min, +1 h,
   +6 h, +24 h and +48 h: `dig NS sfrmotors.co.uk`, MX/TXT/DKIM records from public resolvers (e.g. `@1.1.1.1`, `@8.8.8.8`),
   and **repeat the e-mail baseline (A.4) in both directions** each time. Any e-mail failure -> section G.2 immediately.
4. When everything has been stable for at least 48 h, continue to section E.

## E. Website cutover (a single Route 53 change; quiet weekday morning; phone/WhatsApp attended)

1. Freeze WordPress edits and take a final WordPress backup. Confirm section F checks pass via `--resolve`.
2. In the Route 53 zone change **only** these records:
   * apex `A` -> **Alias to the CloudFront distribution** (add an `AAAA` alias only if the distribution has IPv6 enabled —
     `infra/template.yaml` does not set `IPV6Enabled`, so check the deployed distribution first);
   * `www` `A`/`AAAA` -> **Alias to the same distribution** (the CloudFront Function 301-redirects `www` to the apex).
   Alias records to CloudFront use the CloudFront alias hosted-zone ID published in AWS's documentation; the console fills it
   in when you choose the distribution as the target. **Leave every MX / TXT / DKIM / DMARC record as it is.**
3. Watch `dig +short sfrmotors.co.uk`, then run the section F checks on the real DNS name, and repeat the e-mail baseline.
   Keep WordPress hosting running.

## F. Immediate post-deployment checks (run on the real hostname)

| Check | Expected |
|---|---|
| `curl -sI https://sfrmotors.co.uk/` | 200, `strict-transport-security`, `content-security-policy` (style-src/font-src `'self'`), `x-frame-options: DENY`, `x-content-type-options: nosniff`, `content-encoding: br` or `gzip` |
| `curl -sI http://sfrmotors.co.uk/` and `https://www.sfrmotors.co.uk/` | 301 to `https://sfrmotors.co.uk/` in one hop |
| `/index.html`, `/about.html`, `/emergency-tyre-change.html`, the four blog `.html` URLs | 301 to `/` or the pretty path; `/about-us/` etc. 200 |
| `/does-not/exist/` | HTTP **404**, the styled "Page not found" page, `noindex` |
| `robots.txt`, `sitemap.xml`, `favicon.ico` | 200; robots: `*` allowed, **OAI-SearchBot allowed, GPTBot disallowed** |
| `content-type` of one `.avif`, `.webp`, `.woff2`, `.css`, `.js` under `/assets/` | `image/avif`, `image/webp`, `font/woff2`, `text/css`, JavaScript; `cache-control: public, max-age=31536000, immutable` |
| HTML `cache-control` | `public, max-age=300, must-revalidate` |
| Browser, Desktop + Mobile: Home, About, Contact, a service, a location, a blog post, calculator, Privacy | styled, no console/CSP errors, **no request to fonts.googleapis.com / fonts.gstatic.com**, images load |
| Contact page: before clicking, DevTools Network shows **no** `google.com` requests; after **Load Google Map** the map appears (general Bathgate area) | as described |
| Cookie banner: Reject then Accept | Reject: no Google request; Accept: `gtag/js?id=G-B9TY4GMXYT` once, GA4 Realtime shows the visit |
| `tel:` and WhatsApp links; quote form up to the WhatsApp hand-off | correct numbers; opens WhatsApp |
| Footer on any page | company disclosure line present; no Facebook/Instagram icons |
| **E-mail**: send/receive with `info@sfrmotors.co.uk`; headers show the same SPF/DKIM/DMARC results as the A.4 baseline | unchanged |
| PageSpeed Insights (mobile) on Home + one service page | record the real numbers; field data appears only after ~28 days of traffic |
| Search Console: submit `sitemap.xml`, inspect Home + one deep URL; property still verified | no verification loss |
| CloudFront console: 4xx/5xx rate for the first hours | flat |

## G. Rollback

**Triggers (any one):** TLS/certificate error on apex or `www`; 403/5xx on `/` or several pages; redirect loop; a key page
(Home, Contact, a service page) missing or unstyled; phone/WhatsApp/quote flow broken; **any e-mail delivery or SPF/DKIM/DMARC
regression**; `www` not redirecting.

### G.1 Website-only rollback (fast; e-mail is not involved)

1. In the Route 53 hosted zone, set the apex record back to an **`A` record `82.29.191.9`** (the value from the A.2 export,
   TTL 300) and delete the apex `AAAA` alias if WordPress had none.
2. Set `www` back to a **CNAME -> `sfrmotors.co.uk`** (as exported).
3. Confirm with `dig +short sfrmotors.co.uk` from two public resolvers and load the WordPress site; re-run the e-mail baseline.
   Do **not** delete the CloudFront distribution or the S3 bucket (they are the known-good static copy).

### G.2 Full nameserver rollback (use for any e-mail problem, or to abandon Route 53)

1. In the Hostinger domain settings, set the nameservers back to **`pixel.dns-parking.com`** and **`byte.dns-parking.com`**
   (recorded in A.2 / D.1). The Hostinger DNS zone was never edited, so it still serves the website (WordPress) and all e-mail
   records exactly as before.
2. Wait for propagation (up to the registry's ~48 h delegation TTL). During that time both zones return identical MX/TXT
   records, so mail keeps working. Monitor with `dig NS sfrmotors.co.uk @1.1.1.1` / `@8.8.8.8` and the e-mail baseline.
3. Keep the Route 53 zone (do not delete it) until the owner confirms the situation is resolved.

### G.3 Content-only defect (the site is fine, one page or asset is wrong)

Do **not** roll DNS back. Restore the previous S3 object versions (`aws s3api list-object-versions`, copy the prior version
over the current key) and create a CloudFront invalidation (`/*` covers pages; assets are content-hashed and immutable).

### G.4 After any rollback

Fix on the feature branch, repeat section B.4 rehearsal, and cut over again. Keep the WordPress hosting plan, its backups
**and the Hostinger e-mail service** for at least 30 days after a stable cutover — never cancel Hostinger while e-mail is
hosted there.
