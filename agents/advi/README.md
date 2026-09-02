# Advi v0.1 — Read-only Scenario Advisor

Advi is an advisory agent for BTC Scenario Advisor. It analyzes verified evidence and produces probabilistic scenarios. It does not trade, mutate the Quant engine, or advance the formal 90-day trial.

## Safety contract

Advi MUST remain:

- `SHADOW_MODE=true`
- `SPOT_ONLY=true`
- `ENABLE_ONLINE_LEARNING=false`
- no SELL
- no shorts
- no exchange order permissions
- no automatic execution
- no Champion promotion or parameter mutation
- no writes to the formal decision/market-data ledger

If required evidence is missing, stale, inconsistent, or not `VERIFIED`, Advi fails closed and returns `BLOCKED` rather than fabricating a scenario.

## Allowed read inputs

Advi may consume sanitized/read-only evidence when available:

- dashboard API runtime and freshness
- `trial_id` and verified trial status
- closed 5m/15m candles used by the formal engine
- verified paper ledger summaries
- current public market context
- later, explicitly approved derivatives/on-chain/macro/news feeds

External data is context only unless separately promoted through the project's evidence protocol. It MUST NOT silently alter the formal 90-day dataset.

## Output contract

For a requested horizon (5m, 15m, 1h, 4h, 1d, 1w, 1m), Advi returns:

- observed data
- three scenarios: UP / DOWN / SIDEWAYS
- probabilities summing to 100%
- factors supporting each scenario
- interpretations
- assumptions
- risks
- confidence level
- bullish, bearish and sideways plans
- activation condition, invalidation, risk, signals to watch and estimated horizon for each plan

Advi uses probabilistic language. It never states that a price move or trade is guaranteed.

## Agent Ledger

Every Advi analysis should be auditable with a record containing at least:

```json
{
  "agent": "advi",
  "version": "0.1",
  "mode": "READ_ONLY_SHADOW",
  "generated_at": "ISO-8601 UTC",
  "trial_id": "string|null",
  "horizon": "5m|15m|1h|4h|1d|1w|1m",
  "input_fingerprint": "string",
  "input_freshness": "VERIFIED|STALE|BLOCKED",
  "probabilities": {
    "up": 0,
    "down": 0,
    "sideways": 100
  },
  "confidence": "LOW|MEDIUM|HIGH",
  "status": "ADVISORY|BLOCKED",
  "formal_trial_effect": "NONE"
}
```

The Agent Ledger is separate from the formal trading ledger. Advi records provenance and analysis; it does not create eligible trades or increment the 90-day counter.

## v0.1 acceptance gates

1. Read-only boundary is explicit and testable.
2. Missing/stale evidence produces `BLOCKED`.
3. Scenario probabilities always sum to 100% when status is `ADVISORY`.
4. Advi cannot call order/execution paths.
5. Advi cannot mutate Champion V5.9.0 or enable online learning.
6. Agent Ledger records have `formal_trial_effect=NONE`.
7. No merge or deployment until CI and human review approve the integration.
