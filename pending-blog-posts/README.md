# Pending blog posts (not part of the site build)

Files here are NOT in `site/`, so they are not built, deployed, linked or listed in the sitemap.

## puncture-repair-at-home-edinburgh.html

- Owner-approved 2026-10-03. Publish date: **Thu 22 Oct 2026** — do not publish earlier.
- URL: `/puncture-repair-at-home-edinburgh/`
- Page is complete (BlogPosting + FAQPage JSON-LD, datePublished 2026-10-22) and was checked locally on mobile and desktop.

To publish (on or after 2026-10-22), do exactly what was done for `/pothole-damage-tyre-wheel-checks/`:

1. `git mv pending-blog-posts/puncture-repair-at-home-edinburgh.html site/`
2. `site/blog.html`: add a card at the top of `.sfr-services__grid` (same markup as the pothole card; title = H1, text = meta description) and bump the "… Guides, So Far" heading count.
3. `site/sitemap.xml`: add `<url>` for `https://sfrmotors.co.uk/puncture-repair-at-home-edinburgh/` (lastmod 2026-10-22, monthly, 0.6) and set the `/blog/` lastmod to the same date.
4. `infra/template.yaml`: append `puncture-repair-at-home-edinburgh` to the `same` routing list (and the dated comment above it).
5. `scripts/verify.js`: add `"puncture-repair-at-home-edinburgh.html": "puncture-repair-at-home-edinburgh/",` to `CANONICAL_URL_OVERRIDES`.
6. `node scripts/vercel-config.js`, `npm run build`, `npm run verify`, browser check, then the normal (owner-approved) release.
