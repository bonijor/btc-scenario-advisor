# Web Intelligence Graphify Evidence

Validated locally on 29/08/2026 against PR #35 using Graphify 0.9.51 in `--code-only` mode.

## Gate result

- `PASS_GRAPHIFY_WEB_MAP`
- `GRAPHIFY_EXIT=0`
- Query 1 exit: 0
- Query 2 exit: 0
- Query 3 exit: 0
- No external LLM/API key used.
- No deploy, GCP mutation, trading action, exchange credential or production write.

## Graph shape

- 37 code files parsed locally with tree-sitter AST.
- 24 non-code files intentionally skipped in the code-only pass.
- 318 nodes.
- 605 edges.
- 32 communities.
- `graph.json`, `GRAPH_REPORT.md` and `graph.html` generated locally under ignored `graphify-out/`.

Community names remain `Community N` placeholders because no LLM backend was configured. This is expected and does not invalidate the local code graph.

## Query observations

### Dashboard data flow

The graph identifies `assets/app.js` as a central runtime module, with `resilienceTools()` importing from `assets/dashboard-resilience.js`. It also surfaces `firebase-auth.js`, `product-control-ui.js`, `bi-trading.js`, `product.js` and `quant-decision-bridge.js` as connected modules around auth, control UI and decision boundaries.

### Market data to UI

The graph exposes the main dashboard path around functions including `loadTicker()`, `loadCandles()`, `loadModel()`, `refreshMarket()`, `refreshAll()`, `renderDecisions()`, `renderPaper()`, `renderAnalytics()`, `updateFreshness()` and `renderUnavailableState()` in `assets/app.js`, plus market-view functions in `assets/product-ux.js` and resilience helpers in `assets/dashboard-resilience.js`.

This supports treating `assets/app.js` as a high-impact change surface that should remain behind deterministic regression gates.

### Fail-closed / read-only query

The broad natural-language query produced a sparse result in code-only mode. It surfaced the read-only Browser-Use audit tool and selected test/config nodes, but did not fully reconstruct all safety semantics. This is a limitation of the local AST-only graph and should not be interpreted as absence of safeguards.

Safety semantics remain verified by source review plus deterministic Playwright/Lighthouse contracts. HTML/CSS/product copy are intentionally outside the code-only semantic graph.

## Architecture recommendation

1. Keep `assets/app.js` and `assets/dashboard-resilience.js` under regression protection before refactoring.
2. Keep Web Intelligence landing work isolated from dashboard runtime and formal 90D state.
3. Use Graphify as architecture orientation, not as a security oracle.
4. Run AgentSite only against an isolated candidate under `artifacts/`.
5. Require Playwright, budget and Lighthouse again before any candidate can be considered for promotion.
