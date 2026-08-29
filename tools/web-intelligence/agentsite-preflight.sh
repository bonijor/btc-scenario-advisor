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

if [ -n "$MODEL" ]; then
  PROVIDER="explicit-model"
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
  echo "Alternatively configure AGENTSITE_MODEL for a reviewed local/provider model."
  exit 4
fi

echo "AGENTSITE_PROVIDER=$PROVIDER"
if [ -n "$MODEL" ]; then
  echo "AGENTSITE_MODEL_SELECTED=$MODEL"
else
  echo "AGENTSITE_MODEL_SELECTED=EXPLICIT_MODEL_REQUIRED_FOR_$PROVIDER"
fi

echo "PASS_AGENTSITE_PREFLIGHT"
