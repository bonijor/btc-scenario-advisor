# UX Audit · Phase 2C

Status: CANDIDATE / NOT PUBLISHED

## Scope

This pass audits the public dashboard as a product surface, with special attention to mobile density, authentication, information hierarchy, empty states, accessibility and language consistency. It does not modify the Quant runtime, model, 90-day trial, exchange gateway or execution guardrails.

## Findings

1. **Authentication exposed mutually exclusive states at once.** The login form, registration form and logout action could visually coexist because author CSS could override the native `hidden` presentation.
2. **Anonymous users saw private-account information before authenticating.** Profile preferences, memberships and security cards competed with the primary access task.
3. **Mobile status density was excessive.** Below 520px the four system-health cards were forced into one column, pushing the primary dashboard content far below the fold.
4. **Navigation mixed Spanish and English.** Overview, Analytics, Paper Trading and Trial were inconsistent with the rest of the interface.
5. **Paper Trading used an empty table as its empty state.** The interface explained absence as a table row instead of communicating when a verified simulation will appear.
6. **Technical implementation language leaked into the product surface.** Terms such as provider internals and fail-closed implementation details were repeated where user-oriented copy was sufficient.
7. **Authentication controls needed stronger task hierarchy.** Primary email flow, Google flow, password visibility and session state were visually under-differentiated.

## Candidate improvements

- Enforce `[hidden]` fail-closed at the presentation layer.
- Anonymous Account view shows only the access card.
- Authenticated Account view reveals profile, preferences, memberships and security information.
- One auth form is visible at a time.
- Logout is only visible for an authenticated session.
- Add password reveal controls without blocking password managers or paste.
- Increase auth control hit areas and visible focus treatment.
- Replace implementation-heavy auth copy with user-facing security copy.
- Normalize navigation language to Spanish.
- Convert mobile health strip to a compact two-column layout where space permits.
- Replace the empty Paper Trading table with a dedicated explanatory empty state and reveal the table only when verified trades exist.
- Explain BA, BSS and ECE in plain language while preserving the official values.

## Accessibility basis

The pass preserves explicit input labels, browser/password-manager compatible autocomplete fields, visible keyboard focus, non-blocked paste/autofill and target sizes at or above the existing accessibility baseline. The implementation is aligned with the intent of WCAG 2.2 input assistance and accessible authentication guidance.

## Guardrails unchanged

- SHADOW
- SPOT_ONLY
- no SELL
- no shorts
- no automatic execution
- Quant API remains read-only
- model V5.9.0 remains frozen
- no account action can write to the Quant runtime or exchange gateway

## Future agent layer

A permanent UX Auditor agent can later be deployed through the Google agents-cli / Vertex AI Agent Engine path to inspect screenshots, Lighthouse/Playwright artifacts and product-copy diffs. That agent should remain advisory only, with no authority to merge, deploy, change the model or modify execution guardrails.
