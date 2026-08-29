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

# First pass is intentionally code-only. Graphify parses code locally with
# tree-sitter and does not require or consume LLM API keys in this mode.
# HTML/CSS/product copy remain covered by deterministic QA + AgentSite review.
rm -rf "$OUT"

echo "Mapping public web repository locally (code-only)..."
echo "Root: $ROOT"
echo "Output: $OUT"
echo "External LLM/API keys: NOT REQUIRED"

graphify . --code-only

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
echo "Suggested read-only code queries:"
echo '  graphify query "Which JavaScript modules control dashboard data fetching, rendering and resilience?"'
echo '  graphify query "What code paths connect market data to dashboard state and UI rendering?"'
echo '  graphify query "Which code modules enforce fail-closed or read-only behavior in the public web app?"'
echo
echo "NOTE: Landing HTML/CSS are intentionally reviewed outside Graphify code-only via Playwright, Lighthouse and AgentSite."
