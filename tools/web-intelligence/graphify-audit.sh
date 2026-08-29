#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify CLI not found. Install the official 'graphifyy' package in an isolated environment first." >&2
  echo "Example: uv tool install graphifyy" >&2
  exit 2
fi

OUT="${GRAPHIFY_OUT_DIR:-graphify-out}"

if [[ "$OUT" = /* ]] || [[ "$OUT" == *".."* ]]; then
  echo "Refusing unsafe GRAPHIFY_OUT_DIR=$OUT" >&2
  exit 2
fi

mkdir -p "$OUT"

echo "Mapping public web repository locally..."
echo "Output: $ROOT/$OUT"

# Graphify's code mapping is local-first. We intentionally scope the first pass
# to this public website repository and do not pass GCP credentials or secrets.
graphify . --output "$OUT"

echo
echo "Graphify complete. Review GRAPH_REPORT.md and graph.html manually before refactoring."
