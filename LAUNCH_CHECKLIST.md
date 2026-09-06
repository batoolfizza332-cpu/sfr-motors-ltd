# Launch Checklist — SFR Motors Ltd Static Site

Follow this in order on the day launch is actually approved. Nothing in
this file has been executed — it is the procedure to follow, not a log of
actions taken. See `PRELAUNCH_READINESS_REPORT.md` for the full Phase 4B
Batch F evidence behind each step.

**Do not start this checklist until the owner has given explicit launch
approval and reviewed the two pending Google Search Console decisions in
`WORDPRESS_MIGRATION_AUDIT.md` §6e.**

## 0. Before you start

- [ ] Confirm branch `claude/sfr-motors-audit-4ovs2r` (or whatever branch
      holds the approved Batch F work) is the one being deployed — check
      `git log -1` and compare against the commit hash in the readiness
      report.
- [ ] Confirm which hosting path is being used for this launch: Vercel or
      AWS/CloudFront (see `PRELAUNCH_READINESS_REPORT.md` §7 "Hosting
      parity" for the readiness comparison of each). The steps below are
      grouped by path — only do the steps for the path you're using.
- [ ] Re-run the full regression suite one more time immediately before
      deploying, in case anything changed since the readiness report was
      written:
      ```
      npm ci
      node scripts/gen-articles.js && node scripts/gen-content-pages.js && node scripts/gen-location-pages.js && node scripts/gen-sitemap.js && node scripts/gen-redirects.js
      git status --short   # must be empty — no drift
      npm run build
      node scripts/batchF-audit.js && node scripts/batchF-redirect-verify.js && node scripts/batchF-a11y-qa.js
      node scripts/phase4b-batchF-test.js
      for f in phase3-test phase3b-old-url-test phase4-test phase4b-batchA-test phase4b-batchB1-test phase4b-batchB2-test phase4b-batchB3-test phase4b-batchB4-test phase4b-batchC-test phase4b-batchD1-test phase4b-batchD2-test phase4b-batchD3-test phase4b-batchE-test; do node scripts/$f.js; done
      ```
      All suites must report zero failures before proceeding.

## 1. Pre-launch backups (do this before touching anything live)

- [ ] **WordPress full backup** — a complete export (files + database) of
      the current live WordPress site at sfrmotors.co.uk, stored
      somewhere outside the WordPress host itself (e.g. downloaded
      locally or to separate cloud storage). Confirm the backup file
      opens/restores in a test environment before relying on it.
- [ ] **DNS record capture** — export or screenshot the complete current
      DNS zone for sfrmotors.co.uk (all A/AAAA/CNAME/MX/TXT/NS records,
      including current TTLs) from whatever DNS provider is authoritative
      today. This is the record you'd restore from if DNS needs to be
      rolled back.
- [ ] **Current hosting config capture** — document the current
      WordPress host, PHP version, plugin list (especially Yoast/RankMath,
      whichever supplied the SEO metadata this migration was built from),
      and any server-level redirects or `.htaccess` rules currently live.
- [ ] **Current sitemap/robots.txt capture** — save the live
      `https://sfrmotors.co.uk/sitemap.xml` and
      `https://sfrmotors.co.uk/robots.txt` exactly as they are today,
      before they're replaced.
- [ ] **Search Console baseline export** — from the current GSC property
      (if one exists for the WordPress site): export Performance data
      (clicks, impressions, average position) for at least the last 3
      months and, if available, the last 16 months, plus the current
      Coverage/Indexing report and the current list of submitted
      sitemaps. This is the "before" baseline the 24h/7-day/28-day
      monitoring plan below compares against.
- [ ] **Analytics baseline capture** — if the current WordPress site has
      any analytics installed (GA, GA4, or otherwise), export at least
      the last 3 months of sessions/users/conversions by page, so
      post-launch numbers have something real to compare against.

## 2. Resolve the two pending GSC decisions

- [ ] In Search Console, pull the data specified in
      `WORDPRESS_MIGRATION_AUDIT.md` §6e for both pending URLs:
      `/spare-wheel-delete-why-new-cars-dont-have-them-and-what-the-data-says-about-repair-kits/`
      and `/what-to-expect-from-a-same-day-mobile-car-repair-service/`.
- [ ] Apply the decision rule in §6e to decide: recreate, redirect, 404
      (current default), or 410 for each. Get explicit owner sign-off on
      the decision before changing anything.
- [ ] If a decision changes from the current 404 default, implement it
      (new article, new `infra/redirects.json` entry, or a 410 response)
      and re-run the full regression suite before continuing.

## 3A. Vercel launch path (if using Vercel)

- [ ] Connect this GitHub repository to a Vercel project (or confirm an
      existing connection).
- [ ] In the Vercel project's Domains settings, add `sfrmotors.co.uk` and
      `www.sfrmotors.co.uk`, with `www` set to redirect to the apex (or
      vice versa — pick one canonical host and redirect the other).
      `vercel.json` and this site's canonical tags all assume the
      non-www apex domain (`https://sfrmotors.co.uk`) — do not launch
      with `www` as the canonical host without also updating every
      canonical/OG/JSON-LD URL sitewide first.
- [ ] Confirm the build settings match `vercel.json`
      (`buildCommand: npm run build`, `outputDirectory: dist`) — Vercel
      should read these automatically from the committed file, but
      verify in the dashboard before the first deploy.
- [ ] Deploy to a Vercel preview URL first (not production) and manually
      smoke-test it against the checklist in §5 below.
- [ ] Promote to production once the preview smoke test passes.
- [ ] **After DNS cutover** (see §4), manually verify on the live
      `https://sfrmotors.co.uk`:
      - [ ] A non-trailing-slash request for one of the 19 retired
            WordPress URLs (e.g. `/tyre-lifespan-mobile-tyre-repair-guide`,
            no slash) redirects in a single hop straight to
            `/tyre-lifespan/` — not a two-hop chain. This was fixed and
            verified locally for the CloudFront path in Batch F but
            **Vercel's own routing precedence between custom redirects
            and its `trailingSlash` setting has not been verified live**
            — see the readiness report's known-limitations section.
      - [ ] `www.sfrmotors.co.uk` correctly redirects to the canonical
            host.

## 3B. AWS/CloudFront launch path (if using AWS instead of Vercel)

- [ ] Issue (or locate an existing) ACM certificate for `sfrmotors.co.uk`
      in the **us-east-1** region, and complete DNS validation for it.
- [ ] Deploy the stack:
      ```
      cd infra
      aws cloudformation deploy \
        --template-file template.yaml \
        --stack-name sfr-motors-site \
        --parameter-overrides DomainName=sfrmotors.co.uk AcmCertificateArn=<your-cert-arn>
      ```
- [ ] Run the first content deploy:
      ```
      BUCKET=<Outputs.BucketName> DISTRIBUTION_ID=<Outputs.DistributionId> ./deploy-site.sh
      ```
- [ ] Verify the CloudFront distribution serves the site correctly at its
      `*.cloudfront.net` domain **before** pointing DNS at it.
- [ ] `infra/template.yaml`'s `Aliases` currently lists only the apex
      domain (`sfrmotors.co.uk`) — no `www` alias and no `www`-handling
      redirect exist in this stack today. Decide the canonical-host
      policy (see the Vercel section above) and, if `www` needs to work
      at all (even just to redirect), add it as a second CloudFront
      alias with a matching certificate SAN and a redirect rule in
      `infra/cloudfront-function.js`/`scripts/gen-redirects.js` before
      relying on it — this is not yet built.
- [ ] (Optional, for automatic future deploys) Deploy
      `infra/github-oidc.yaml` and set the four GitHub repo variables
      listed in `README.md`, so pushes to `main` auto-deploy via
      `.github/workflows/deploy.yml`.
- [ ] Manually smoke-test the CloudFront domain against §5 below before
      cutting DNS over.

## 4. DNS cutover

- [ ] Lower the DNS TTL for the relevant records well in advance (ideally
      24-48h before cutover) so the eventual change propagates quickly.
- [ ] Point `sfrmotors.co.uk` (and `www`, per the canonical-host decision
      above) at the new host: a CNAME/ALIAS to the Vercel-assigned
      hostname, or to the CloudFront `DistributionDomainName` output (or
      a Route 53 alias record if using Route 53).
- [ ] Confirm the WordPress host stops receiving DNS traffic once
      propagation completes — but do not delete or deactivate the old
      WordPress site or hosting account yet (needed intact for rollback
      — see §7).

## 5. Launch-day smoke test

Run through this manually on the live production domain immediately after
cutover, in addition to the automated suites already run pre-launch:

- [ ] Homepage loads over HTTPS with a valid certificate (no browser
      warning).
- [ ] `http://` requests redirect to `https://`.
- [ ] A sample of each page type loads correctly: homepage, a service
      page, a location page, a blog article, `/tyre-size-calculator/`,
      `/contact-us/`.
- [ ] View source on 2-3 pages: canonical tag, title, meta description,
      and JSON-LD all reference `https://sfrmotors.co.uk/...` (the live
      domain), not a staging/preview URL.
- [ ] Click through 3-5 of the 19 retired WordPress URLs (see
      `infra/redirects.json`) and confirm each 301s to its correct
      destination in one hop.
- [ ] Request a clearly nonexistent URL and confirm it returns an actual
      404 status (check via browser devtools Network tab or `curl -I`),
      not a 200.
- [ ] `tel:` and WhatsApp links work from a real mobile device.
- [ ] Submit a real test enquiry through the quote form and confirm the
      WhatsApp deep link opens with the correct pre-filled message.
- [ ] Run the tyre-size calculator with a real example and confirm
      results display correctly.
- [ ] `https://sfrmotors.co.uk/robots.txt` and
      `https://sfrmotors.co.uk/sitemap.xml` are both reachable and
      correct on the live domain.
- [ ] Confirm the GA4 Measurement ID has been set in
      `site/assets/js/analytics.js` if analytics tracking is wanted from
      launch (it is currently a safe no-op placeholder,
      `G-XXXXXXXXXX`) — and that a cookie-consent mechanism is in place
      first, per the UK PECR/GDPR note in `README.md`, if analytics is
      being enabled.

## 6. Search Console (post-launch, requires real GSC access)

- [ ] Verify the production domain as a Search Console property (domain
      property, covering both http/https and www/non-www).
- [ ] Submit `https://sfrmotors.co.uk/sitemap.xml` as the property's
      sitemap.
- [ ] Use URL Inspection on 5-10 representative priority URLs (homepage,
      2-3 service pages, 1-2 location pages, 1-2 articles) to request
      indexing.
- [ ] Over the following days, monitor the Indexing (Pages) report for
      the retired WordPress URLs specifically — confirm Google is
      recognising the 301s (they should move to "Page with redirect",
      not accumulate as 404/soft-404 errors).
- [ ] Monitor the Page Experience / Core Web Vitals report as real field
      data accumulates (this takes real users and time — see the
      readiness report's note that no live Core Web Vitals exist yet).
- [ ] Monitor the Coverage/Indexing report generally for unexpected 404s
      or redirect errors.
- [ ] Watch canonical selection ("Google-selected canonical" vs
      "User-declared canonical") on a sample of pages to confirm Google
      agrees with this site's self-referencing canonicals.
- [ ] Compare clicks/impressions/rankings against the pre-launch baseline
      captured in §1.

## 7. Rollback plan (if launch needs to be reversed)

1. **DNS rollback** — point `sfrmotors.co.uk` (and `www`) back at the
   original WordPress hosting, using the DNS record capture from §1.
   Because TTLs were lowered in §4, this should propagate on the same
   timescale as the original cutover.
2. **Do not delete anything** — the WordPress site, its database, and its
   hosting account should be left running and untouched throughout
   launch specifically so this rollback step is a DNS change only, not a
   restore-from-backup. Restoring from the §1 WordPress backup is the
   fallback only if the WordPress site itself was modified or taken down
   during the launch window.
3. **New-site side** — no rollback action is required on the Vercel/AWS
   side; simply leave the new deployment running (or pause the Vercel
   project / remove the CloudFront alias if it should stop serving
   traffic entirely) — DNS pointing elsewhere is sufficient to take it
   out of the traffic path.
4. **Search Console** — if the rollback is temporary, no GSC action is
   needed (Google will simply see the old site again at the same URLs).
   If the rollback is expected to last more than a few days, consider
   noting the temporary reversion doesn't need any sitemap resubmission
   since the domain and most URLs are unchanged.
5. **Investigate before re-attempting** — identify and fix whatever
   caused the rollback before attempting cutover again; re-run the full
   regression suite (§0) as part of that fix.

## 8. Monitoring plan

**24 hours after launch:**
- [ ] Confirm DNS has fully propagated (check from multiple locations/
      resolvers).
- [ ] Confirm HTTPS certificate is valid and auto-renewing (Vercel:
      automatic; AWS: ACM auto-renews, but confirm the certificate isn't
      set to expire before renewal would trigger).
- [ ] Check hosting provider's own error/access logs for any spike in
      4xx/5xx responses.
- [ ] Spot-check 10-15 of the highest-value pages (homepage, core
      service pages, top location pages) are still loading correctly.
- [ ] Confirm quote-form WhatsApp submissions are being received (ask the
      business owner to confirm a real enquiry came through, if one has).

**7 days after launch:**
- [ ] Search Console Coverage/Indexing report: confirm the retired
      WordPress URLs are being recognised as redirects, not accumulating
      as errors.
- [ ] Search Console Performance report: compare early clicks/impressions
      against the pre-launch baseline — a temporary dip in the first 1-2
      weeks after a URL migration is common and not automatically a
      problem; a sustained drop is.
- [ ] Confirm no unexpected 404s are showing up in Search Console for
      URLs that should exist or redirect.
- [ ] Re-run `scripts/phase4b-batchF-test.js` and the full regression
      suite against the live production build (not just the local
      `dist/`) if feasible, to catch any drift introduced by the actual
      hosting environment (cache misconfiguration, header differences,
      etc.).

**28 days after launch:**
- [ ] Full Search Console Performance comparison against the pre-launch
      baseline: clicks, impressions, average position, by page and in
      aggregate.
- [ ] Review Core Web Vitals / Page Experience report now that enough
      real-user field data should have accumulated.
- [ ] Revisit the two previously-pending GSC decisions (§2) if they
      hadn't been resolved before launch — one month of real post-launch
      data is a reasonable point to make that call if it was deferred.
- [ ] Decide whether the old WordPress hosting/backup can be safely
      retired, based on stable traffic and no rollback having been
      needed.
