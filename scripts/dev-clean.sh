#!/usr/bin/env bash
set -euo pipefail
# Stop stale ORBIT dev processes that commonly hold Tauri/Vite ports (1420/1421).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pids=$(pgrep -af "$ROOT/node_modules/.bin/(vite|tauri)|$ROOT/src-tauri/target/debug/orbit-ide|vite.*--port 1420" 2>/dev/null | awk '{print $1}' | tr '\n' ' ' || true)
if [[ -z "${pids// /}" ]]; then echo "No matching ORBIT dev processes found."; exit 0; fi
echo "Stopping stale ORBIT dev processes: $pids"
kill $pids 2>/dev/null || true
sleep 1
for p in $pids; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null || true; done
echo "Done. Ports 1420/1421 should be free if held by those processes."
