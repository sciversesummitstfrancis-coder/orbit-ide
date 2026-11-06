#!/usr/bin/env bash
set -euo pipefail
DIR="${1:-.}"
OUT="${2:-$DIR/SHA256SUMS.txt}"
: > "$OUT"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$DIR" && find . -maxdepth 1 -type f ! -name 'SHA256SUMS*' -print0 | sort -z | xargs -0 sha256sum) > "$OUT"
elif command -v shasum >/dev/null 2>&1; then
  (cd "$DIR" && find . -maxdepth 1 -type f ! -name 'SHA256SUMS*' -print0 | sort -z | xargs -0 shasum -a 256) > "$OUT"
else
  echo "No sha256 tool found" >&2; exit 1
fi
echo "Wrote $OUT"
