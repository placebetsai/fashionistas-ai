#!/usr/bin/env bash
# Deploy fashionistas.ai from THIS laptop with wrangler. No GitHub Actions.
#
# Why this exists: deploys used to run in .github/workflows/deploy.yml, which
# meant the only machine that could ship was a GitHub runner holding the
# Cloudflare token as a repo secret. Wrangler runs fine here, so the runner —
# and the token it held — are unnecessary.
#
# Credentials come from .env.deploy (mode 600, gitignored via .gitignore
# ".env.*"). Nothing in this file prints them, and wrangler only ever sees them
# as environment variables.
#
# Usage:
#   scripts/deploy-local.sh              deploy HEAD as-is
#   scripts/deploy-local.sh --dry-run    build version.txt, skip the upload
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# --- credentials -----------------------------------------------------------
if [ ! -f .env.deploy ]; then
  echo "deploy-local: .env.deploy is missing." >&2
  echo "  Create it with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (mode 600)." >&2
  echo "  It is gitignored on purpose — the token never enters the repository." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.deploy
set +a

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "deploy-local: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not both set in .env.deploy" >&2
  exit 1
fi

# --- refuse to ship a dirty tree -------------------------------------------
# version.txt must equal the deployed commit. If the working tree has uncommitted
# changes, the SHA would describe a state that is not what we upload.
if [ "$DRY_RUN" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "deploy-local: working tree is dirty — commit first so version.txt is truthful:" >&2
  git status --short >&2
  exit 1
fi

SHA="$(git rev-parse HEAD)"
echo "deploy-local: deploying $SHA from $(pwd)"

# --- version.txt -----------------------------------------------------------
GITHUB_SHA="$SHA" bash scripts/gen-version.sh

if [ "$DRY_RUN" -eq 1 ]; then
  echo "deploy-local: --dry-run — version.txt written, upload skipped."
  exit 0
fi

# --- upload ----------------------------------------------------------------
npx wrangler pages deploy . --project-name=fashionistas-ai --branch=main

# --- verify ----------------------------------------------------------------
echo "deploy-local: verifying https://fashionistas.ai/version.txt == $SHA"
for i in 1 2 3 4 5 6 7 8 9 10; do
  live="$(curl -fsS https://fashionistas.ai/version.txt 2>/dev/null | tr -d '[:space:]' || true)"
  echo "  attempt $i: live=${live:-<empty>}"
  if [ "$live" = "$SHA" ]; then
    echo "deploy-local: VERIFIED — live == $SHA"
    exit 0
  fi
  sleep 6
done

echo "deploy-local: NOT VERIFIED — version.txt never matched $SHA" >&2
exit 1
