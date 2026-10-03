#!/usr/bin/env bash
# version.txt generation for fashionistas.ai
#
# Writes the bare 40-char commit SHA into version.txt with NO trailing newline,
# so `curl -s https://fashionistas.ai/version.txt` equals
# `git ls-remote origin main` (the check strips whitespace, but we never emit any).
#
# Usage:  scripts/gen-version.sh [sha]
#   sha defaults to $GITHUB_SHA (CI), then the current commit.
# Env:
#   VERSION_FILE  output path (default: version.txt in the current directory)
set -euo pipefail

sha="${1:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}}"
out="${VERSION_FILE:-version.txt}"

if ! printf '%s' "$sha" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "gen-version: refusing to write non-SHA value: '${sha}'" >&2
  exit 1
fi

printf '%s' "$sha" > "$out"

# Verify what landed on disk is byte-for-byte the bare SHA.
v="$(tr -d '[:space:]' < "$out")"
if [ "$v" != "$sha" ] || [ "${#v}" -ne 40 ]; then
  echo "gen-version: $out is not a bare 40-char SHA: '$v' (len=${#v})" >&2
  exit 1
fi

echo "gen-version: wrote $out = $v (40 bytes, no newline)"
