#!/usr/bin/env bash
# Build site/ into dist/ (minified, cache-fingerprinted), sync dist/ to S3
# with per-file-type Cache-Control, then invalidate CloudFront.
#
# Usage:
#   BUCKET=sfrmotors.co.uk-site DISTRIBUTION_ID=E1234ABCD ./deploy-site.sh
#
set -euo pipefail

: "${BUCKET:?Set BUCKET to the S3 bucket name (see infra template Outputs.BucketName)}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID to the CloudFront distribution id (see infra template Outputs.DistributionId)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

echo "Building production bundle ..."
(cd "$REPO_ROOT" && npm install --no-audit --no-fund && npm run build)

echo "Deploying $DIST_DIR to s3://$BUCKET ..."

# assets/css and assets/js are content-hash-fingerprinted by the build
# (main.<hash>.css etc.), so they're safe to cache for a full year: a
# content change always produces a new filename and a new URL, and an old
# cached copy is simply never requested again. assets/img is unhashed but
# effectively immutable in practice (filenames are the fixed, sharp-generated
# responsive set) and gets the same long cache.
aws s3 sync "$DIST_DIR/assets" "s3://$BUCKET/assets" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# HTML and the two crawler files: short cache so edits show up quickly.
aws s3 sync "$DIST_DIR" "s3://$BUCKET" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "public, max-age=300, must-revalidate" \
  --content-type "text/html; charset=utf-8"

aws s3 cp "$DIST_DIR/robots.txt" "s3://$BUCKET/robots.txt" \
  --cache-control "public, max-age=3600" \
  --content-type "text/plain; charset=utf-8"

aws s3 cp "$DIST_DIR/sitemap.xml" "s3://$BUCKET/sitemap.xml" \
  --cache-control "public, max-age=3600" \
  --content-type "application/xml; charset=utf-8"

echo "Invalidating CloudFront cache for pages ..."
# Only HTML/robots.txt/sitemap.xml ever need invalidating — assets/ is
# content-hashed, so a stale cached copy is simply never referenced again
# by the newly-deployed HTML. "/" is invalidated explicitly and separately
# from "/index.html" — a request for the bare root path is cached under
# its own key (via DefaultRootObject), so "/*.html" alone would miss it.
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/" "/*.html" "/robots.txt" "/sitemap.xml"

echo "Done."
