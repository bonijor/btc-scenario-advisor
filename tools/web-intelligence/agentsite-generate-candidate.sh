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

# Gemini can return transient 503 capacity errors even when credentials,
# billing and request shape are valid. Retry only that exact server-side
# condition with bounded exponential backoff. Do not retry auth, quota,
# billing, validation or model-not-found failures.
MAX_ATTEMPTS="${AGENTSITE_TRANSIENT_MAX_ATTEMPTS:-3}"
BASE_DELAY="${AGENTSITE_TRANSIENT_BASE_DELAY_SECONDS:-20}"

if ! [[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "AGENTSITE_TRANSIENT_MAX_ATTEMPTS_INVALID=$MAX_ATTEMPTS" >&2
  exit 7
fi
if ! [[ "$BASE_DELAY" =~ ^[0-9]+$ ]]; then
  echo "AGENTSITE_TRANSIENT_BASE_DELAY_SECONDS_INVALID=$BASE_DELAY" >&2
  exit 7
fi

attempt=1
while :; do
  rm -rf "$PROJECT_OUT"
  ATTEMPT_LOG="$(mktemp)"

  echo
  echo "AGENTSITE_GENERATION_ATTEMPT=$attempt/$MAX_ATTEMPTS"

  set +e
  "${RUNNER[@]}" generate \
    "$(cat "$PROMPT_FILE")" \
    "${MODEL_ARGS[@]}" \
    --output "$PROJECT_OUT" \
    --name "BTC Scenario Advisor Landing V2 Review" \
    --page home 2>&1 | tee "$ATTEMPT_LOG"
  RC=${PIPESTATUS[0]}
  set -e

  if [ "$RC" -eq 0 ]; then
    rm -f "$ATTEMPT_LOG"
    break
  fi

  if grep -Eq '503 (UNAVAILABLE|Service Unavailable).*(high demand|temporarily overloaded|temporarily unavailable|at capacity)' "$ATTEMPT_LOG"; then
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      delay=$(( BASE_DELAY * (2 ** (attempt - 1)) ))
      echo
      echo "AGENTSITE_TRANSIENT_503=RETRY"
      echo "AGENTSITE_RETRY_IN_SECONDS=$delay"
      rm -f "$ATTEMPT_LOG"
      sleep "$delay"
      attempt=$((attempt + 1))
      continue
    fi

    echo
    echo "AGENTSITE_TRANSIENT_503=EXHAUSTED"
    echo "No non-transient failure was detected; Google capacity remained unavailable across $MAX_ATTEMPTS attempt(s)."
  else
    echo
    echo "AGENTSITE_GENERATION_NON_TRANSIENT_FAILURE=STOP"
    echo "No automatic retry was performed for this failure class."
  fi

  rm -f "$ATTEMPT_LOG"
  exit "$RC"
done

echo
echo "PASS_AGENTSITE_CANDIDATE_GENERATED"
echo "Candidate files:"
find "$OUT" -type f -maxdepth 6 -print | sort
