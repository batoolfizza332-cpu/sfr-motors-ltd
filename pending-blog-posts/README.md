# Pending blog posts (not part of the site build)

Files here are NOT in `site/`, so they are not built, deployed, linked or listed in the sitemap.

There are no pending posts at the moment. `/puncture-repair-at-home-edinburgh/` moved into `site/` on 2026-10-21 for its 22 Oct 2026 publish date.

To publish a post parked here, do what was done for `/puncture-repair-at-home-edinburgh/`:

1. `git mv pending-blog-posts/<slug>.html site/`
2. `site/blog.html`: add a card at the top of `.sfr-services__grid` (title = H1, text = meta description) and bump the "… Guides, So Far" heading count.
3. `site/sitemap.xml`: add a `<url>` for the post (lastmod = publish date, monthly, 0.6) and set the `/blog/` lastmod to the same date.
4. `infra/template.yaml`: append the slug to the `same` routing list (and the dated comment above it).
5. `scripts/verify.js`: add `"<slug>.html": "<slug>/",` to `CANONICAL_URL_OVERRIDES`.
6. `npm run build`, `npm run verify`, then the normal owner-approved release (`CLAUDE.md` rules 8 and 9).
