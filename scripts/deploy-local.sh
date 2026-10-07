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
ENV_FILE="${DEPLOY_ENV_FILE:-./.env.deploy}"
if [ ! -f "$ENV_FILE" ]; then
  echo "deploy-local: .env.deploy is missing." >&2
  echo "  Create it with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (mode 600)." >&2
  echo "  It is gitignored on purpose — the token never enters the repository." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$ENV_FILE"
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

# --- extension zip (served from /chrome-store/*.zip on Pages) ----------------
bash scripts/zip-extension.sh
EXT_VER="$(node -p "JSON.parse(require('fs').readFileSync('apps/extension/manifest.json','utf8')).version")"
cp -f "chrome-store/fashionistas-extension-v${EXT_VER}.zip" chrome-store/fashionistas-extension-v.zip

# --- version.txt -----------------------------------------------------------
GITHUB_SHA="$SHA" bash scripts/gen-version.sh

if [ "$DRY_RUN" -eq 1 ]; then
  echo "deploy-local: --dry-run — version.txt written, upload skipped."
  exit 0
fi

# --- staging ---------------------------------------------------------------
# NEVER upload the repo root: it holds .env.deploy / .env.modal / .git. Copy only
# public files into a temp dir. Functions are still compiled from ./functions
# and bindings from ./wrangler.toml because wrangler runs from the repo root.
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/fashionistas-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
rsync -a --delete \
  --exclude='.*' \
  --exclude='node_modules/' \
  --exclude='docs/' --exclude='tests/' --exclude='scripts/' --exclude='migrations/' \
  --exclude='functions/' \
  --exclude='*.env' --exclude='*.pem' --exclude='*.key' --exclude='*.dev.vars' \
  --exclude='wrangler*.toml' --exclude='package.json' --exclude='package-lock.json' \
  --exclude='TEST.md' --exclude='NEEDS_ISRAEL.txt' \
  ./ "$STAGE/"
# Hard fail if any dotfile or key material made it into the stage.
leak="$(find "$STAGE" \( -name '.*' -o -name '*.env' -o -name '*.pem' -o -name '*.key' \) -print | head -5)"
if [ -n "$leak" ]; then
  echo "deploy-local: refusing to deploy, sensitive files in stage:" >&2
  echo "$leak" >&2
  exit 1
fi
[ -f "$STAGE/version.txt" ] || { echo "deploy-local: version.txt missing from stage" >&2; exit 1; }

# --- upload ----------------------------------------------------------------
npx wrangler pages deploy "$STAGE" --project-name=fashionistas-ai --branch=main

# --- verify ----------------------------------------------------------------
echo "deploy-local: verifying https://fashionistas.ai/version.txt == $SHA"
for i in 1 2 3 4 5 6 7 8 9 10; do
  live="$(curl -fsS https://fashionistas.ai/version.txt 2>/dev/null | tr -d '[:space:]' || true)"
  echo "  attempt $i: live=${live:-<empty>}"
  if [ "$live" = "$SHA" ]; then
    echo "deploy-local: VERIFIED — live == $SHA"
    for p in /.env.deploy /.env.modal /.env /.git/config /.dev.vars; do
      code="$(curl -s -o /dev/null -w '%{http_code}' "https://fashionistas.ai$p")"
      echo "  $p -> $code"
      [ "$code" = "404" ] || { echo "deploy-local: WARNING $p did not 404" >&2; exit 1; }
    done
    exit 0
  fi
  sleep 6
done

echo "deploy-local: NOT VERIFIED — version.txt never matched $SHA" >&2
exit 1
