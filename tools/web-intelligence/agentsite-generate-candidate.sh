#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v agentsite >/dev/null 2>&1; then
  echo "AGENTSITE_NOT_INSTALLED" >&2
  echo "Install in an isolated environment first, for example: uv tool install agentsite" >&2
  exit 2
fi

OUT="$ROOT/artifacts/agentsite-candidate"
PROMPT_FILE="$OUT/prompt.txt"
PROJECT_OUT="$OUT/project"
mkdir -p "$OUT"
rm -rf "$PROJECT_OUT"

{
  cat tools/web-intelligence/agentsite-brief.md
  printf '\n\n## Existing Landing V2 source to critique and improve\n\n'
  printf 'The following HTML and CSS are reference material. Generate an ALTERNATIVE candidate only. Do not assume permission to overwrite repository files. Preserve all required safety semantics and links.\n\n'
  printf '### landing-v2.html\n```html\n'
  cat landing-v2.html
  printf '\n```\n\n### assets/landing-v2.css\n```css\n'
  cat assets/landing-v2.css
  printf '\n```\n'
} > "$PROMPT_FILE"

MODEL_ARGS=()
if [ -n "${AGENTSITE_MODEL:-}" ]; then
  MODEL_ARGS+=(--model "$AGENTSITE_MODEL")
fi

RUNNER=(agentsite)
case "${AGENTSITE_MODEL:-}" in
  google/*|gemini/*)
    AGENTSITE_BIN="$(command -v agentsite)"
    AGENTSITE_PY="$(sed -n '1s/^#!//p' "$AGENTSITE_BIN")"

    if [ ! -x "$AGENTSITE_PY" ] && command -v uv >/dev/null 2>&1; then
      UV_TOOL_DIR="$(uv tool dir 2>/dev/null || true)"
      if [ -n "$UV_TOOL_DIR" ] && [ -x "$UV_TOOL_DIR/agentsite/bin/python" ]; then
        AGENTSITE_PY="$UV_TOOL_DIR/agentsite/bin/python"
      fi
    fi

    if [ ! -x "$AGENTSITE_PY" ]; then
      echo "AGENTSITE_GOOGLE_COMPAT_PYTHON_NOT_FOUND" >&2
      echo "Could not resolve the Python interpreter for the isolated AgentSite tool environment." >&2
      exit 6
    fi

    RUNNER=("$AGENTSITE_PY" "$ROOT/tools/web-intelligence/agentsite-google-compat.py")
    ;;
esac

echo "Generating isolated AgentSite candidate..."
echo "Output: $PROJECT_OUT"
echo "Repository source files will not be overwritten."

"${RUNNER[@]}" generate \
  "$(cat "$PROMPT_FILE")" \
  "${MODEL_ARGS[@]}" \
  --output "$PROJECT_OUT" \
  --name "BTC Scenario Advisor Landing V2 Review" \
  --page home

echo
echo "PASS_AGENTSITE_CANDIDATE_GENERATED"
echo "Candidate files:"
find "$OUT" -type f -maxdepth 6 -print | sort
