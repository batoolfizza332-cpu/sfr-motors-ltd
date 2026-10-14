# CLAUDE.md

## Permanent Website Quality Requirements

1. Use production-quality, clean, maintainable code. Avoid unnecessary libraries, duplicate code, heavy animations and excessive JavaScript.

2. Use a mobile-first responsive approach. Every page, menu, form, button and section must work correctly on mobile, tablet and desktop.

3. Keep performance highly optimized. Aim for Lighthouse/PageSpeed 90–100 on mobile and desktop, with fast loading, minimal JavaScript and CSS, no avoidable layout shifts and efficient caching.

4. Keep images lightweight and high quality. Use responsive AVIF/WebP, explicit dimensions, lazy loading below the fold and descriptive alt text. Use labelled placeholders until the owner supplies final images.

5. Keep every page SEO-friendly with one H1, unique title and meta description, correct canonical URL, semantic headings, internal links, appropriate schema, robots.txt and sitemap.xml.

6. Keep the site scalable for high traffic using static output where appropriate, efficient assets, CDN/browser caching and minimal third-party scripts. Avoid performance bottlenecks.

7. Keep colours, typography and spacing controlled through reusable CSS variables/design tokens so the theme can be changed later without editing every page. Never invent business claims, prices, response times, coverage areas, reviews or certifications.

8. Hosting is GitHub + Hostinger only. Nothing goes live without the owner's explicit permission: a merge to `main` only runs a dry run, and the real upload is `.github/workflows/deploy-hostinger.yml` in `deploy` mode, started only after the owner says so (see `infra/HOSTINGER-DEPLOY.md`). Do not use, connect to or deploy to Vercel, AWS or any other host, and never change DNS or e-mail records.

9. Owner decision (2026-10-14): in addition to the workflow in rule 8, Claude may upload a release to Hostinger itself through the Hostinger connector, but only after the owner explicitly says so for that release (for example "live کر دو"), and only for content already merged to `main`. Strict limits, no exceptions:
   - Touch only the website `sfrmotors.co.uk`. Never touch `inventory/`, `sfr-upload/` or any other folder, website or subdomain (`sfrmotors.uk`, `old.sfrmotors.uk`, `inventory.sfrmotors.co.uk`).
   - Build from `main` (`npm ci`, `npm run verify`, production `.htaccess` from `scripts/htaccess-config.js --profile production`) and upload only the files of that release that differ from the live site, one file at a time, in this order: `assets/`, pages, `.htaccess`, `sitemap.xml`, `robots.txt`/`favicon.ico`.
   - Never delete, rename or move anything on the server. Never use archive deploys or Git deploys (they overwrite the whole site). Never change databases, WordPress, SSL, DNS, e-mail or plan settings.
   - Keep a copy of every live file before replacing it, run `node scripts/live-compare.js` afterwards, put the copies back if anything fails, and tell the owner exactly which files were uploaded.
   - Do only the task the owner asked for, nothing else.
