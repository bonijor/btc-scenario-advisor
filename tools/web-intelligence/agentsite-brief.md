# AgentSite brief: BTC Scenario Advisor

## Objective

Improve the public product landing for a probabilistic Bitcoin research platform. The result should feel institutional, technical and credible rather than promotional or speculative.

## Non-negotiable safety semantics

Do not remove, weaken or visually bury any of these concepts:

- SHADOW mode;
- SPOT_ONLY;
- no SELL;
- no shorts;
- no automatic execution;
- no exchange credentials;
- no online learning;
- analysis is informational and not financial advice;
- the 90D counter is only valid when backed by formal reconciled ledger evidence.

Do not invent live market values, model metrics, trial days, win rate or P&L.

## Product hierarchy

1. Hero: probabilistic research, explainability and safety.
2. Trust strip: SHADOW / SPOT_ONLY / NO EXECUTION.
3. Architecture: public data → Quant → Agent Intelligence → Paper/evidence.
4. Formal 90D evidence.
5. Agent Intelligence.
6. Governance.
7. CTA to the existing dashboard.

## Visual direction

- dark institutional fintech cockpit;
- Bitcoin orange used sparingly as a signal, not as wallpaper;
- high information density without looking like an exchange trading screen;
- large editorial headlines paired with compact technical evidence blocks;
- responsive from 360px through desktop;
- WCAG AA contrast target;
- semantic landmarks, headings and keyboard navigation;
- honor `prefers-reduced-motion`.

## Integration contract

Work on `landing-v2.html` and `assets/landing-v2.css` only unless a reviewer explicitly expands scope.

Do not modify `index.html`, dashboard API wiring, Firebase auth, BI Trading, trial IDs, data contracts or runtime code.

Preserve links to:

- `index.html` for the dashboard;
- `bi-trading.html` for BI Trading.

## Review dimensions

Score 1-10 on:

- visual hierarchy;
- accessibility;
- semantic structure;
- responsive behavior;
- credibility / no overclaiming;
- clarity of SHADOW safety model;
- performance simplicity.

Reject the proposal if any dimension is below 8 or if a safety semantic is weakened.
