#!/usr/bin/env bash
# deploy-safe.sh — THE ONLY SANCTIONED WAY TO SHIP fashionistas.ai TO PRODUCTION.
# Raw `wrangler pages deploy … --branch=main` and plain `bash scripts/deploy-local.sh` to main are
# forbidden for every bot and OpenCode. This wraps deploy-local.sh (tests, clean tree, staging,
# version.txt verify) with a smoke gate:
#   1) deploy-local.sh → preview alias gate-candidate (runs npm test first)
#   2) node scripts/smoke.mjs against the preview (must be green, version.txt must equal HEAD)
#   3) deploy-local.sh → production (only from main, or ALLOW_BRANCH=<current branch>)
#   4) smoke production; on red, prints the exact rollback (AUTO_ROLLBACK=1 runs it)
# Usage:  bash scripts/deploy-safe.sh            (from main)
#         PREVIEW_ONLY=1 ALLOW_BRANCH=<branch> bash scripts/deploy-safe.sh   (gate a branch, no prod)
#         ALLOW_KNOWN_FAILS=1 …  proceed only if every failing check ALSO fails on production today
# Manual smoke: npm run smoke -- https://<branch>.fashionistas-ai.pages.dev
# UI changes still need preview screenshots + Iz's "ship it" before production.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SITE=fashionistas.ai PROJECT=fashionistas-ai PROD_URL=https://fashionistas.ai
PREVIEW_BRANCH="${PREVIEW_BRANCH:-gate-candidate}"
say(){ printf '\n\033[1m[deploy-safe %s] %s\033[0m\n' "$SITE" "$*"; }
die(){ printf '\n\033[31m[deploy-safe %s] %s\033[0m\n' "$SITE" "$*" >&2; exit 1; }
WORK="$(mktemp -d "${TMPDIR:-/tmp}/deploy-safe.XXXXXX")"; trap 'rm -rf "$WORK"' EXIT
BR="$(git branch --show-current)"; SHA="$(git rev-parse HEAD)"
if [ "${PREVIEW_ONLY:-0}" != 1 ] && [ "$BR" != main ] && [ "${ALLOW_BRANCH:-}" != "$BR" ]; then
  die "production ships from main. On '$BR' use PREVIEW_ONLY=1 ALLOW_BRANCH=$BR, or ALLOW_BRANCH=$BR to deliberately ship this branch."
fi
[ -f .env.deploy ] || die ".env.deploy missing (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID, never printed)"
set -a; . ./.env.deploy; set +a

smoke(){ node scripts/smoke.mjs "$1" --json "$2"; }
gate_or_die(){
  local url="$1"
  if EXPECT_SHA="$SHA" smoke "$url" "$WORK/preview.json"; then return 0; fi
  if [ "${ALLOW_KNOWN_FAILS:-0}" = 1 ]; then
    say "preview failed; ALLOW_KNOWN_FAILS=1 → comparing with production"
    smoke "$PROD_URL" "$WORK/base.json" || true
    node -e '
      const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1])).results,b=JSON.parse(fs.readFileSync(process.argv[2])).results;
      const bad=new Set(b.filter(r=>!r.pass&&!r.warn).map(r=>r.name));const reg=p.filter(r=>!r.pass&&!r.warn&&!bad.has(r.name)&&!/version\.txt/.test(r.name));
      if(reg.length){console.log("REGRESSIONS:");for(const r of reg)console.log("  ✗ "+r.name+": "+r.detail);process.exit(1)}
      console.log("All preview failures are pre-existing on production. Proceeding.")' "$WORK/preview.json" "$WORK/base.json" && return 0
  fi
  die "GATE FAILED on preview $url — production was NOT touched."
}
prev_deployment(){
  curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/deployments?env=production&per_page=1" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).result||[])[0]?.id||"")}catch{}})' || true
}
rollback_cmd(){
  if [ -n "$1" ]; then
    echo "  curl -fsS -X POST -H \"Authorization: Bearer \$CLOUDFLARE_API_TOKEN\" \\"
    echo "    https://api.cloudflare.com/client/v4/accounts/\$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/deployments/$1/rollback   # (source .env.deploy first)"
  fi
  echo "  or Cloudflare dashboard → Pages → $PROJECT → Deployments → ${1:-previous production} → Rollback"
}

say "1/4 preview: deploy-local.sh → $PREVIEW_BRANCH (runs npm test)"
ALLOW_BRANCH="$BR" DEPLOY_BRANCH="$PREVIEW_BRANCH" bash scripts/deploy-local.sh
PURL="https://${PREVIEW_BRANCH}.${PROJECT}.pages.dev"
say "2/4 smoke PREVIEW $PURL"; gate_or_die "$PURL"
[ "${PREVIEW_ONLY:-0}" = 1 ] && { say "PREVIEW_ONLY=1 — preview green, production untouched"; exit 0; }
PREV="$(prev_deployment)"
say "3/4 production: deploy-local.sh → main (current prod deployment ${PREV:-unknown}; tests already passed for $SHA)"
ALLOW_BRANCH="$BR" DEPLOY_BRANCH=main SKIP_TESTS=1 DEPLOY_SAFE_INNER=1 bash scripts/deploy-local.sh
say "4/4 smoke PRODUCTION"
if ! EXPECT_SHA="$SHA" smoke "$PROD_URL" "$WORK/prod.json"; then
  echo; echo "PRODUCTION SMOKE FAILED after deploying $SHA. Roll back with:"; rollback_cmd "$PREV"
  if [ "${AUTO_ROLLBACK:-0}" = 1 ] && [ -n "$PREV" ]; then
    curl -fsS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/deployments/$PREV/rollback" >/dev/null && echo "AUTO_ROLLBACK: rolled back to $PREV"
  fi
  exit 1
fi
say "DONE — $SHA live on $PROD_URL and smoke-green. Rollback if ever needed:"; rollback_cmd "$PREV"
