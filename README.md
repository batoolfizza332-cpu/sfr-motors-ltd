# SFR Motors Ltd — website

The static website of SFR Motors Ltd (mobile tyre fitting, Bathgate, West Lothian), live at **https://sfrmotors.co.uk**.

**Hosting: GitHub + Hostinger only.** There is no Vercel, AWS or other hosting. Nothing goes live without the owner's permission: after a merge to `main`,
`.github/workflows/deploy-hostinger.yml` runs a dry run (uploads nothing); the real upload is started by hand once the owner approves
(setup and details in [`infra/HOSTINGER-DEPLOY.md`](infra/HOSTINGER-DEPLOY.md)).

```
edit site/  ->  pull request (Quality gate green)  ->  merge to main  ->  automatic dry run  ->  owner approves  ->  deploy  ->  live
```

The business rules, owner decisions and URL rules are in [`PROJECT-HANDOVER.md`](PROJECT-HANDOVER.md). Read it before
changing content.

## Commands

Node 18+ (CI uses Node 20). The only dependencies are `clean-css`, `html-minifier-terser` and `terser` (build only; nothing ships to the browser).

```bash
npm ci                               # install
npm run build                        # site/ -> dist/ (minified, content-hashed CSS/JS)
npm run verify                       # build + 25 quality checks; must print QUALITY GATE: PASSED
npm run check:live                   # compare the live sfrmotors.co.uk with this build (read-only)
node scripts/preview-edge.js 4174    # local preview of dist/ with the site's redirects, 404 and CSP
npm run test:browser                 # real-browser suite (Chrome/Edge), optional
```

## GitHub Actions

| Workflow | When | What |
|---|---|---|
| **Quality gate** | every PR and push | `npm run verify` |
| **Deploy to Hostinger** | dry run after a merge to `main` that changes the website; real upload only by hand after the owner approves | build, checks, backup, upload (no deletes), live check, automatic rollback |
| **Daily SEO check** | every day 06:17 UTC | `npm run verify` + compares the live site with `main` (pages, redirects, headers); fails and e-mails if they differ |

## Repository map

```
site/                       the website source (edit here): *.html pages, assets/ (css, js, img, fonts), robots.txt, sitemap.xml, favicon.ico
scripts/build.js            site/ -> dist/
scripts/verify.js           the quality gate
scripts/routing.js          reads the URL rules and security headers from infra/template.yaml
scripts/htaccess-config.js  generates the Hostinger .htaccess from those rules
scripts/live-compare.js     live site vs build (Daily SEO check, Deploy to Hostinger)
scripts/preview-edge.js     local preview server (also used by the browser tests)
scripts/host-guard-tests.js sandbox tests: Analytics and WhatsApp work only on sfrmotors.co.uk
scripts/browser-tests/      real-browser test suite
infra/template.yaml         the single source of redirects, pretty URLs and security headers (not deployed anywhere)
infra/HOSTINGER-DEPLOY.md   how deployment works and the one-time setup (Urdu)
infra/HOSTINGER-RELEASE-RUNBOOK.md  manual release/rollback procedure (fallback only)
*-section.html, root images, image-originals/, SFR_Website_Info.txt   old WordPress snippets and source photos (not deployed)
dist/                       build output (gitignored)
```

## Rules that never change without the owner

* Never invent business claims, prices, response times, coverage areas, reviews or certifications.
* No street address anywhere; contact channels are phone 0131 202 0289, WhatsApp 07448 427154, info@sfrmotors.co.uk.
* Do not change approved URLs, redirects, titles or structured data without the owner.
* Never touch DNS, MX/e-mail records or Hostinger plan settings from this repository.
* Never put a password, token or private key in the repository.
