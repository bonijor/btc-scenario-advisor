#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

echo "AgentSite preflight for isolated landing candidate"
echo "No repository source file will be modified by this preflight."

if ! command -v agentsite >/dev/null 2>&1; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "AGENTSITE_INSTALL_BLOCKED: uv is not available" >&2
    echo "Install uv first, then run: uv tool install agentsite" >&2
    exit 2
  fi
  echo "Installing AgentSite in an isolated uv tool environment..."
  uv tool install agentsite
fi

echo "AGENTSITE_BIN=$(command -v agentsite)"
agentsite --version

MODEL="${AGENTSITE_MODEL:-}"
PROVIDER=""

# Explicit model selection is allowed only when the matching provider is
# demonstrably configured in the shell. This prevents a false-green preflight
# where AGENTSITE_MODEL is present but the required credential is not.
if [ -n "$MODEL" ]; then
  case "$MODEL" in
    openai/*)
      [ -n "${OPENAI_API_KEY:-}" ] || { echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires OPENAI_API_KEY"; exit 5; }
      PROVIDER="openai"
      ;;
    anthropic/*|claude/*)
      [ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires ANTHROPIC_API_KEY"; exit 5; }
      PROVIDER="anthropic"
      ;;
    google/*|gemini/*)
      if [ -z "${GOOGLE_API_KEY:-}" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
        echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires GOOGLE_API_KEY or GEMINI_API_KEY"
        exit 5
      fi
      PROVIDER="google"
      ;;
    openrouter/*)
      [ -n "${OPENROUTER_API_KEY:-}" ] || { echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires OPENROUTER_API_KEY"; exit 5; }
      PROVIDER="openrouter"
      ;;
    groq/*)
      [ -n "${GROQ_API_KEY:-}" ] || { echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires GROQ_API_KEY"; exit 5; }
      PROVIDER="groq"
      ;;
    ollama/*)
      command -v ollama >/dev/null 2>&1 || { echo "AGENTSITE_MODEL_PROVIDER_MISMATCH: $MODEL requires local ollama"; exit 5; }
      PROVIDER="ollama-local"
      ;;
    *)
      echo "AGENTSITE_MODEL_PROVIDER_UNREVIEWED=$MODEL"
      echo "Use a reviewed provider/model prefix before generation."
      exit 5
      ;;
  esac
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  PROVIDER="openai"
  MODEL="openai/gpt-4o"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  PROVIDER="anthropic"
elif [ -n "${GOOGLE_API_KEY:-}" ] || [ -n "${GEMINI_API_KEY:-}" ]; then
  PROVIDER="google"
elif [ -n "${OPENROUTER_API_KEY:-}" ]; then
  PROVIDER="openrouter"
elif [ -n "${GROQ_API_KEY:-}" ]; then
  PROVIDER="groq"
elif command -v ollama >/dev/null 2>&1; then
  PROVIDER="ollama-local"
fi

if [ -z "$PROVIDER" ]; then
  echo "AGENTSITE_PROVIDER_CREDENTIAL=NOT_CONFIGURED"
  echo "No secret was read or printed."
  echo "Configure a supported provider credential only in the shell environment, never in the repository."
  echo "Do not paste provider secrets into chat, files, git history or command output."
  exit 4
fi

if [ -z "$MODEL" ]; then
  echo "AGENTSITE_PROVIDER=$PROVIDER"
  echo "AGENTSITE_MODEL_SELECTION_REQUIRED"
  echo "Set AGENTSITE_MODEL to a reviewed model for this provider; no secret value should be printed."
  exit 5
fi

echo "AGENTSITE_PROVIDER=$PROVIDER"
echo "AGENTSITE_MODEL_SELECTED=$MODEL"
echo "PASS_AGENTSITE_PREFLIGHT"
