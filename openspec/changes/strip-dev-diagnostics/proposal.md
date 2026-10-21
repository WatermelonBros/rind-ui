## Why

Development warnings are gated by `process.env.NODE_ENV` file by file, each module
redeclaring `process` and its own `dev()` helper. Most are stripped from production
bundles, but not all: a production build of the whole of `@rind-ui/react` still contains 8
`[rind-ui]` messages (accordion, tour ×5, qr-code, table) and nothing stops new ones from
leaking. Each leak also keeps its message-building code and the state it tracks
(`warned` sets).

## What Changes

- One development-diagnostics module in core: `devWarn(scope, message)` / `devError`, a
  once-per-key variant, and the single `process` declaration. Every development warning goes
  through it, so the minifier drops the call and its argument expressions in production.
- A rule separating **development diagnostics** (misuse the consumer must fix: an unknown tour
  step id, a value outside the allowed range) from **runtime failure reports** (a consumer
  callback threw or rejected). Diagnostics are stripped in production; failure reports stay,
  through a separate helper.
- The 8 leaks found today are fixed (gated, or moved to failure reports where that is what
  they are).
- `scripts/size.mjs` fails when a production bundle of the whole library contains a
  `[rind-ui]` message that is not a declared failure report.
- Lint: `console.warn` / `console.error` outside the diagnostics module fail.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bundle-size`: production bundles carry no development diagnostics.

## Non-goals

- Changing the text or the conditions of any warning.
- A logging or telemetry API.

## Impact

- New `packages/core/src/dev/diagnostics.ts` (exported for `@rind-ui/react`, internal).
- About 40 modules in `packages/core` and `packages/react` switched to it.
- `scripts/size.mjs`, Biome config (or `scripts/lint-platform.mjs`) for the console rule.
