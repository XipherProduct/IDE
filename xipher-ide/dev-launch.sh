#!/usr/bin/env bash
# Dev launch for the Xipher IDE fork.
#   ./dev-launch.sh          bundle src -> out (optimized + NLS), then launch
#   ./dev-launch.sh --no-build   skip build, just launch existing out/
#
# Use `bundle`, NOT `transpile`: the loose transpile output has no concatenated
# workbench.desktop.main.css and no NLS table, so the window renders blank. The
# `bundle --nls` path produces a complete, runnable out/ (bundled JS+CSS, main.js,
# nls.messages.json) — the same shape the packaged app ships. Takes ~1 min.
set -euo pipefail
cd "$(dirname "$0")"

echo "· stopping any running fork…"
pkill -9 -f 'alask[a]-ai' 2>/dev/null || true

if [[ "${1:-}" != "--no-build" ]]; then
	echo "· bundle src → out (optimized + NLS)…"
	node build/next/index.ts bundle --nls --out out
fi

echo "· launching Xipher IDE (dev)…"
# Isolated dev profile so we don't collide with the packaged AppImage's
# ~/.config/Xipher IDE state (stale mount paths, safeStorage key mismatch).
exec env VSCODE_SKIP_PRELAUNCH=1 .build/electron/alaska-ai . --no-sandbox \
	--user-data-dir "$PWD/.dev-profile"
