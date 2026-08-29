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

Use as a design/review assistant over a copy of the public web project. Preserve existing IDs, data contracts and fail-closed semantics. Treat generated HTML/CSS/JS as a proposal that must pass deterministic QA before promotion.

Brief: `tools/web-intelligence/agentsite-brief.md`.

### Browser-Use

Use as an autonomous browser QA layer after Playwright and Lighthouse. Its role is to discover navigation, copy, responsive or state-flow problems that deterministic tests may miss. It has no access to GCP or financial execution.

Starter: `tools/web-intelligence/browser-use-audit.py`.

### Graphify

Use local code mapping to understand dependencies before refactoring. The preferred first run only maps the public website repository and writes output to a local ignored directory.

Starter: `tools/web-intelligence/graphify-audit.sh`.

## QA order

1. Static review / semantic HTML.
2. Existing Playwright suite.
3. Landing-specific Playwright contract.
4. Existing performance budget.
5. Lighthouse.
6. Browser-Use exploratory QA.
7. Human review.

Agent results are advisory. Deterministic tests remain authoritative for promotion.

## Landing v2

`landing-v2.html` is a lab surface, not the production homepage. It exposes the product story, the formal 90D evidence model, agent architecture and governance without changing the existing dashboard.

The displayed `11 / 90` value is explicitly labeled as a snapshot verified on 29/08/2026. It is not the live counter and must not be treated as current after that date.

## Financial agents

TradingAgents, FinGPT and Finance Trading AI Agents MCP are not connected in this branch. Their future integration belongs in the core repository and must be SHADOW-only, with `decisionInfluence=NONE` until benchmark evidence supports a later design review.

For Finance Trading AI Agents MCP, all account/trade/order/cancel/transfer capabilities must remain denied. Only a reviewed read-only allowlist may be considered.
