#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/scripts/dev-clean.sh" || true
exec npm --prefix "$ROOT" run tauri dev
