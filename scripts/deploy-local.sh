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

# --- refuse to ship untested code -------------------------------------------
# This gate exists because the site has shipped builds nobody ran. Nothing below
# uploads anything, so a red run costs nothing but the ~45s it took.
if [ "${SKIP_TESTS:-0}" -eq 1 ]; then
  echo "deploy-local: SKIP_TESTS=1 — tests were NOT run. This deploy is unverified." >&2
else
  echo "deploy-local: running npm test before anything is uploaded ..."
  if ! npm test; then
    echo "deploy-local: TESTS FAILED — nothing was uploaded." >&2
    exit 1
  fi
  echo "deploy-local: tests passed."
fi

# --- refuse to ship an unnamed or unreviewed commit ---------------------------
# A detached HEAD is what a stash, a bisect or a worktree leaves behind; its
# SHA describes a state nobody can name afterwards. And every run of this script
# publishes to fashionistas.ai production, so a stray lane checkout must be a
# deliberate choice rather than whatever happened to be checked out.
BRANCH_NOW="$(git branch --show-current)"
if [ "$DRY_RUN" -eq 0 ]; then
  if [ -z "$BRANCH_NOW" ] || [ "$BRANCH_NOW" = "HEAD" ]; then
    echo "deploy-local: detached HEAD — refusing to publish an unnamed commit." >&2
    exit 1
  fi
  if [ "$BRANCH_NOW" != "main" ] && [ "${ALLOW_BRANCH:-}" != "$BRANCH_NOW" ]; then
    echo "deploy-local: branch '$BRANCH_NOW' is not main, and this script deploys to production." >&2
    echo "deploy-local: re-run as ALLOW_BRANCH=$BRANCH_NOW npm run deploy if that is intended." >&2
    exit 1
  fi
fi

# --- refuse to ship a dirty tree ---------------------------------------------
# version.txt must equal the deployed commit. If the working tree has uncommitted
# changes, the SHA would describe a state that is not what we upload.
if [ "$DRY_RUN" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "deploy-local: working tree is dirty — commit first so version.txt is truthful:" >&2
  git status --short >&2
  exit 1
fi

SHA="$(git rev-parse HEAD)"
echo "deploy-local: deploying $SHA from $(pwd) (branch $BRANCH_NOW)"

# --- extension zip (served from /chrome-store/*.zip on Pages) -----------------
# OPT-IN ONLY, via SHIP_EXTENSION=1. Do not "simplify" this back to unconditional.
#
# The published build used to include a Chrome extension the public could
# download at /chrome-store/*.zip, while the backend it exists for was never
# built: nothing serves /api/jobs or /api/sessions, and nothing on the site
# enqueues a job for it to pick up. So what shipped could only ever fail at the
# one thing it does.
#
# The first version of this gate probed the Worker over the network and treated
# 401 as proof the route existed ("the route exists and is gating on auth").
# That was WRONG, and it is left here as the reason the gate is now a human
# decision instead of a probe. This Worker answers 401 for every unmatched
# /api path — measured 2026-10-12:
#     /api/jobs                              -> 401
#     /api/sessions                          -> 401
#     /api/definitely-not-a-real-route-xyz   -> 401
# A catch-all that 401s everything makes 401 evidence of nothing. Any probe
# that can be fooled by a URL that does not exist is not a gate, it is
# decoration — and this one would have shipped the zip on every single deploy
# while looking like it was withholding it.
#
# A network probe only becomes meaningful once the Worker distinguishes
# "no such route" (404) from "no session" (401). Reintroduce one then.
# Until then, shipping the extension is a deliberate act: SHIP_EXTENSION=1.
EXT_VER="$(node -p "JSON.parse(require('fs').readFileSync('apps/extension/manifest.json','utf8')).version")"
if [ "${SHIP_EXTENSION:-0}" = "1" ]; then
  echo "deploy-local: SHIP_EXTENSION=1 — building the extension zip."
  bash scripts/zip-extension.sh
  cp -f "chrome-store/fashionistas-extension-v${EXT_VER}.zip" chrome-store/fashionistas-extension-v.zip
else
  echo "deploy-local: extension zip NOT shipped (set SHIP_EXTENSION=1 once its backend exists)." >&2
  rm -f "chrome-store/fashionistas-extension-v.zip" \
        "chrome-store/fashionistas-extension-v${EXT_VER}.zip"
fi

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
  --exclude='node_modules/' --exclude='__pycache__/' --exclude='*.pyc' --exclude='*.log' \
  --exclude='*.env' --exclude='*.pem' --exclude='*.key' --exclude='e2e/' --exclude='mobile/' --exclude='extension/' --exclude='dist/' \
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
BRANCH="${DEPLOY_BRANCH:-main}"
# 2026-10-15 hard rule: production only through scripts/deploy-safe.sh (preview → smoke → prod → smoke).
if [ "$BRANCH" = "main" ] && [ "${DEPLOY_SAFE_INNER:-0}" != "1" ]; then
  echo "deploy-local: production deploys must go through the smoke gate: bash scripts/deploy-safe.sh" >&2
  exit 1
fi
case "$BRANCH" in *[!a-z0-9-]*) echo "deploy-local: DEPLOY_BRANCH must be lowercase letters, digits, dashes" >&2; exit 1;; esac
if [ "$BRANCH" = "main" ]; then BASE="https://fashionistas.ai"; else BASE="https://${BRANCH}.fashionistas-ai.pages.dev"; fi
echo "deploy-local: branch=$BRANCH -> $BASE"
npx wrangler pages deploy "$STAGE" --project-name=fashionistas-ai --branch="$BRANCH"

# --- verify ----------------------------------------------------------------
echo "deploy-local: verifying $BASE/version.txt == $SHA"
for i in 1 2 3 4 5 6 7 8 9 10; do
  live="$(curl -fsS "$BASE/version.txt" 2>/dev/null | tr -d '[:space:]' || true)"
  echo "  attempt $i: live=${live:-<empty>}"
  if [ "$live" = "$SHA" ]; then
    echo "deploy-local: VERIFIED — live == $SHA"
    for p in /.env.deploy /.env.modal /.env /.git/config /.dev.vars; do
      code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
      echo "  $p -> $code"
      [ "$code" = "404" ] || { echo "deploy-local: WARNING $p did not 404" >&2; exit 1; }
    done
    exit 0
  fi
  sleep 6
done

echo "deploy-local: NOT VERIFIED — version.txt never matched $SHA" >&2
exit 1
