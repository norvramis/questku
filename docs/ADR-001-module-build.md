# ADR-001: Zero-dep build + modular core (src → questku.js)

## Status
Accepted (2026-08). In progress (rewards module migrated; more to follow).

## Context
`questku.js` = single 2300-line IIFE pasted into Discord DevTools. Tests/CI can't
reach inner functions; `extension/questku.js` was a manual copy (drift-prone).
Full TS+esbuild migration stalled: it requires a Discord runtime pass this
environment can't provide, and inverting the shipped artifact on faith is a
regression risk.

## Decision
- Build = **zero-dependency Node script** (`scripts/build.js`), not esbuild.
- Source of truth: `src/questku.js` (IIFE main) + `src/core/*.js` (pure CJS helpers).
- `scripts/build.js` injects `src/core/*` into the `/*__CORE__*/` marker under a
  CJS shim, then writes `questku.js` + `extension/questku.js` (identical).
- Wrappers preserve legacy signatures (`getOrbValue(rewards)`, `getRewardHtml(q)`)
  so call sites in main stay byte-identical.
- `scripts/migrate.js` = one-time transform (questku.js → src/), already used.
- Unit tests `require('src/core/*.js')` directly (CJS, hermetic); relay tests
  spawn/attach relay.ps1 + raw TCP.

## Trade-offs
- + Zero install, deterministic output, tests reach the shipped logic, CI guards
  the generated files (build → syntax → fc sync).
- − Not TS; per-module extraction still requires touching `src/questku.js`;
  browser-run verification still manual.
- Future TS/esbuild stays possible: adapt `scripts/build.js`, contract (1 file
  IIFE + same filenames) unchanged.

## Migration order (increments, each reviewed)
1. rewards (done: getRewardTypes/getOrbValue/getRewardHtml + 14 unit tests)
2. quests (done: isExpired/isDesktopOnlyQuest + 9 unit tests; inline boolean-expiry
   sites deduped to isExpired across filter/sort/select/autoEnroll)
3. api (done: apiReq retry/rate-limit policy + jitter, deps-injected; 9 unit tests.
   directFetch/claimAPI stay in main - the policy lives in core now)
4. ui rendering + hypesquad + achievements — CANCELLED (YAGNI). These are 100%
   DOM/webpack-coupled: extraction buys indirection, not test coverage, at high
   behavior-risk. Their small pure bits (claim body, house-id labels) live inline
   with thin wrappers and are covered by runtime-verify instead.