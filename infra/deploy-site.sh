#!/usr/bin/env bash
# Sync site/ to S3 with per-file-type Cache-Control, then invalidate CloudFront.
#
# Usage:
#   BUCKET=sfrmotors.co.uk-site DISTRIBUTION_ID=E1234ABCD ./deploy-site.sh
#
set -euo pipefail

: "${BUCKET:?Set BUCKET to the S3 bucket name (see infra template Outputs.BucketName)}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID to the CloudFront distribution id (see infra template Outputs.DistributionId)}"

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../site" && pwd)"

echo "Deploying $SITE_DIR to s3://$BUCKET ..."

# Long-lived, immutable caching for the fingerprint-free static assets.
# (Bump filenames if you ever need to force a refresh before the cache expires.)
aws s3 sync "$SITE_DIR/assets" "s3://$BUCKET/assets" \
  --delete \
  --cache-control "public, max-age=604800, immutable"

# HTML and the two crawler files: short cache so edits show up quickly.
aws s3 sync "$SITE_DIR" "s3://$BUCKET" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "public, max-age=300, must-revalidate" \
  --content-type "text/html; charset=utf-8"

aws s3 cp "$SITE_DIR/robots.txt" "s3://$BUCKET/robots.txt" \
  --cache-control "public, max-age=3600" \
  --content-type "text/plain; charset=utf-8"

aws s3 cp "$SITE_DIR/sitemap.xml" "s3://$BUCKET/sitemap.xml" \
  --cache-control "public, max-age=3600" \
  --content-type "application/xml; charset=utf-8"

echo "Invalidating CloudFront cache for all pages ..."
# "/" is invalidated explicitly and separately from "/index.html" — a
# request for the bare root path is cached under its own key (via
# DefaultRootObject), so "/*.html" alone would miss it.
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/" "/*.html" "/robots.txt" "/sitemap.xml"

echo "Done."
