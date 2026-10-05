#!/usr/bin/env bash
# Zip the browser extension locally. Replaces .github/workflows/extension-zip.yml,
# which built the same archive on a GitHub runner and uploaded it as an artifact —
# a round trip to somebody else's computer for a local zip command.
#
# Usage:  scripts/zip-extension.sh [output-path]
# Default output: chrome-store/fashionistas-extension-v<manifest version>.zip
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SRC="apps/extension"

if [ ! -f "$SRC/manifest.json" ]; then
  echo "zip-extension: $SRC/manifest.json not found" >&2
  exit 1
fi

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$SRC/manifest.json','utf8')).version")"
OUT="${1:-chrome-store/fashionistas-extension-v${VERSION}.zip}"

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
# Resolve to an absolute path: we zip from inside apps/extension, so a relative
# output would resolve against that directory and miss chrome-store/ entirely.
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

# Exclude anything that must never ship: tests, editor metadata, env files.
(
  cd "$SRC"
  zip -r -q "$OUT" . \
    -x '*.DS_Store' \
    -x '*__tests__*' \
    -x '*.test.js' \
    -x '*.test.mjs' \
    -x '.env' \
    -x '.env.*'
)

echo "zip-extension: wrote $OUT"
echo "zip-extension: manifest version = $VERSION"

# The archive is about to be handed to a store reviewer — prove it is clean.
echo "zip-extension: contents:"
unzip -l "$OUT"

# Manifest must be inside, and must parse.
if ! unzip -p "$OUT" manifest.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);if(!m.version)process.exit(1);console.log("zip-extension: manifest.json present, version "+m.version)})'; then
  echo "zip-extension: manifest.json missing or unparseable inside the zip" >&2
  exit 1
fi

# Leak scan. Values are never printed — only the entry + line number.
echo "zip-extension: scanning for secrets in archive entries..."
LEAK="$(unzip -Z1 "$OUT" | while IFS= read -r entry; do
  case "$entry" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.woff|*.woff2|*.ttf) continue ;;
  esac
  unzip -p "$OUT" "$entry" 2>/dev/null | grep -nEi \
    '(api[_-]?key|secret|passwd|password|bearer[[:space:]]|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_\-]{12,}' \
    | sed "s|^|$entry:|" || true
done)"

if [ -n "$LEAK" ]; then
  echo "zip-extension: BLOCKED — possible secret inside the archive:" >&2
  echo "$LEAK" >&2
  exit 1
fi
echo "zip-extension: leak scan clean"
