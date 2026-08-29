# Web Intelligence Lab

This branch adds an isolated, non-production web-quality lab for BTC Scenario Advisor.

## Scope

The lab is intentionally separated from the formal 90-day runtime. It may improve presentation, accessibility, architecture understanding and browser QA, but it must not mutate:

- the Quant decision contract;
- the formal 90D ledger or completedDays;
- Cloud Scheduler or Cloud Run jobs;
- exchange credentials or account state;
- trading permissions, orders, SELL, shorts or leverage;
- online learning.

## Agent roles

### AgentSite

Use as a design/review assistant over an isolated candidate generated under `artifacts/`. Preserve existing IDs, data contracts and fail-closed semantics. Generated HTML/CSS/JS is a proposal only and must never overwrite source automatically.

Brief: `tools/web-intelligence/agentsite-brief.md`.

Safe candidate runner: `tools/web-intelligence/agentsite-generate-candidate.sh`.

### Browser-Use

Use as an autonomous browser QA layer after Playwright and Lighthouse. Its role is to discover navigation, copy, responsive or state-flow problems that deterministic tests may miss. It has no access to GCP or financial execution.

Starter: `tools/web-intelligence/browser-use-audit.py`.

Credentials must remain outside the repository. The starter fails closed when no Browser-Use provider credential is configured.

### Graphify

Use local code mapping to understand dependencies before refactoring. The first run maps only this public website repository and writes its map to ignored `graphify-out/`.

Starter: `tools/web-intelligence/graphify-audit.sh`.

## QA order

1. Static review / semantic HTML.
2. Existing Playwright suite.
3. Landing-specific Playwright contract.
4. Existing performance budget.
5. Landing-specific performance budget.
6. Lighthouse.
7. Graphify architecture map.
8. AgentSite isolated candidate review.
9. Browser-Use exploratory QA.
10. Human review.

Agent results are advisory. Deterministic tests remain authoritative for promotion.

## Current deterministic gate evidence

Validated locally against the Web Intelligence PR on 29/08/2026:

- Landing Playwright desktop 1920: PASS, 5/5.
- Landing Playwright mobile 390: PASS, 5/5.
- Landing Playwright narrow mobile 320: PASS, 5/5.
- Landing static budget: PASS, 17,674 / 24,000 bytes, 1 / 2 critical requests.
- Existing dashboard static budget: PASS, 137,179 / 138,000 bytes, 7 / 7 critical requests.
- Lighthouse mobile: PASS.
  - Performance: 1.00.
  - Accessibility: 0.95.
  - Best Practices: 0.96.
  - SEO: 1.00.
  - FCP: 751.6 ms.
  - LCP: 901.6 ms.
  - CLS: 0.
  - TBT: 0 ms.
  - Speed Index: 751.6 ms.

## Landing v2

`landing-v2.html` is a lab surface, not the production homepage. It exposes the product story, the formal 90D evidence model, agent architecture and governance without changing the existing dashboard.

The displayed `11 / 90` value is explicitly labeled as a snapshot verified on 29/08/2026. It is not the live counter and must not be treated as current after that date.

## Financial agents

TradingAgents, FinGPT and Finance Trading AI Agents MCP are not connected in this branch. Their future integration belongs in the core repository and must be SHADOW-only, with `decisionInfluence=NONE` until benchmark evidence supports a later design review.

For Finance Trading AI Agents MCP, all account/trade/order/cancel/transfer capabilities must remain denied. Only a reviewed read-only allowlist may be considered.
