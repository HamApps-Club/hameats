#!/usr/bin/env bash
# Builds HamEats and packs it for AWS Lambda as hameats-lambda.zip (in web/). Run from anywhere:
#   BUILD_ID=$(git rev-parse --short=12 HEAD) web/scripts/package-lambda.sh
# NEXT_PUBLIC_* settings must be in the environment (or web/.env.local) when it builds: they're written into the
# browser code. GitHub Actions runs this on every push to main (.github/workflows/deploy-aws.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

rm -rf .lambda hameats-lambda.zip
mkdir .lambda
# The standalone server and the packages it needs, its static files, the public folder, and the Lambda handler.
cp -r .next/standalone/. .lambda/
mkdir -p .lambda/.next
cp -r .next/static .lambda/.next/static
cp -r public .lambda/public
cp lambda/index.mjs .lambda/index.mjs
(cd .lambda && zip -qr -X ../hameats-lambda.zip .)
rm -rf .lambda
echo "hameats-lambda.zip: $(du -h hameats-lambda.zip | cut -f1)"
