"""Read-only exploratory QA for the BTC Scenario Advisor landing lab.

Run only against a local/static preview. This script is advisory and must not
replace Playwright or Lighthouse promotion gates.
"""

import asyncio
import os

from browser_use import Agent

try:
    from browser_use import ChatBrowserUse
except ImportError as exc:
    raise SystemExit("browser-use is not installed or is incompatible") from exc


TARGET_URL = os.environ.get(
    "BTC_WEB_LAB_URL",
    "http://127.0.0.1:4173/landing-v2.html",
)

TASK = f"""
Audit {TARGET_URL} as a read-only QA reviewer.

You may navigate, scroll, use keyboard focus and follow links that remain on the
same local origin. Do not submit forms, authenticate, call APIs, change settings,
or interact with any financial execution control.

Check:
1. hero clarity and visual hierarchy;
2. mobile/narrow readability;
3. keyboard navigation and skip link;
4. semantic labels and understandable link names;
5. obvious overflow, clipped text or broken layouts;
6. preservation of SHADOW, SPOT_ONLY, no automatic execution, no SELL and no shorts;
7. absence of wording that promises market outcomes;
8. clear separation between the dated 11/90 snapshot and a live formal counter.

Return a compact report with severity (blocker/high/medium/low), evidence and a
recommended fix. If no issue is found in a category, say PASS. Do not modify the
site.
"""


async def main() -> None:
    model = os.environ.get("BROWSER_USE_MODEL")
    if not model:
        if not os.environ.get("BROWSER_USE_API_KEY"):
            raise SystemExit(
                "BROWSER_USE_API_KEY is not set. Keep credentials outside the repo, "
                "export the key in the shell, then rerun this read-only audit."
            )
        model = "bu-2-0-mini-preview"

    agent = Agent(task=TASK, llm=ChatBrowserUse(model=model))
    result = await agent.run()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
