#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify CLI not found. Install the official 'graphifyy' package in an isolated tool environment first." >&2
  echo "Recommended: uv tool install graphifyy" >&2
  exit 2
fi

OUT="$ROOT/graphify-out"

# Graphify v8 writes its default project map to graphify-out/. Keep the first
# pass on the public web repository only. Do not pass credentials or external
# document sources to this audit.
rm -rf "$OUT"

echo "Mapping public web repository locally..."
echo "Root: $ROOT"
echo "Output: $OUT"

graphify .

for required in graph.json GRAPH_REPORT.md graph.html; do
  if [ ! -s "$OUT/$required" ]; then
    echo "GRAPHIFY_OUTPUT_MISSING $OUT/$required" >&2
    exit 3
  fi
done

echo
echo "PASS_GRAPHIFY_WEB_MAP"
echo "Generated:"
ls -lh "$OUT/graph.json" "$OUT/GRAPH_REPORT.md" "$OUT/graph.html"

echo
echo "Suggested read-only queries:"
echo '  graphify query "Which files define the Landing V2 visual hierarchy and responsive behavior?"'
echo '  graphify query "What code paths connect the public landing to the existing dashboard and BI Trading?"'
echo '  graphify query "Which files enforce safety language such as SHADOW, SPOT_ONLY and no execution?"'
