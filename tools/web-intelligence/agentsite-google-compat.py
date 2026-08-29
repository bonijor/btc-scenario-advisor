#!/usr/bin/env python3
"""Runtime-only compatibility shim for AgentSite + Prompture + google-genai.

Prompture's async Google driver can emit Gemini multi-message content as
{"role": ..., "parts": ["text"]}. Newer google-genai validation expects
Content/Part objects for that multi-message shape. Single-message prompts are
usually unwrapped to a plain string and therefore do not expose the issue.

This shim patches only the in-memory AgentSite process. It does not edit the
installed Prompture package, repository source files, credentials, GCP, or any
financial runtime.
"""

from __future__ import annotations

from typing import Any

from google.genai import types
from prompture.drivers.async_google_driver import AsyncGoogleDriver


_original_build_generation_args = AsyncGoogleDriver._build_generation_args


def _as_part(value: Any) -> Any:
    if isinstance(value, types.Part):
        return value
    if isinstance(value, str):
        return types.Part(text=value)
    if isinstance(value, dict):
        try:
            return types.Part(**value)
        except Exception:
            return value
    return value


def _patched_build_generation_args(self, messages, options=None):
    gen_input, config_dict = _original_build_generation_args(self, messages, options)

    if not isinstance(gen_input, list):
        return gen_input, config_dict

    normalized: list[Any] = []
    for item in gen_input:
        if isinstance(item, types.Content):
            normalized.append(item)
            continue

        if not isinstance(item, dict) or "role" not in item or "parts" not in item:
            normalized.append(item)
            continue

        raw_parts = item.get("parts") or []
        parts = [_as_part(part) for part in raw_parts if not (isinstance(part, str) and part == "")]

        # Prompture may retain an empty assistant/model turn after a tool call.
        # google-genai rejects an empty Content object, so omit only that empty
        # transport artifact. Tool results remain present as the following user
        # message and are not modified.
        if not parts:
            continue

        normalized.append(types.Content(role=item.get("role"), parts=parts))

    return normalized, config_dict


AsyncGoogleDriver._build_generation_args = _patched_build_generation_args

print("AGENTSITE_GOOGLE_COMPAT_SHIM=ACTIVE")

from agentsite.cli import cli  # noqa: E402


if __name__ == "__main__":
    cli()
