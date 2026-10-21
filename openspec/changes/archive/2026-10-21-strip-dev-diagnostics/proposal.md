## Why

Development warnings must not ship to production. #192 inlined the `process.env.NODE_ENV`
guards so minifiers drop most of them, but a production bundle of the whole of
`@rind-ui/react` still contains two development diagnostics (Tour's unknown `goto` id and
Table's missing-name warning, whose helper survives although its only call is guarded), and
nothing stops new ones from leaking.

## What Changes

- The two remaining diagnostics are guarded so the message and the code that builds it are
  dropped in production.
- The size check bundles the whole library for production and fails on any `[rind-ui]`
  console message that is not a declared runtime failure report (a consumer callback threw or
  rejected) or a thrown error.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bundle-size`: production bundles carry no development diagnostics.

## Non-goals

- A shared diagnostics helper: #192 chose inline guards because a helper call is not resolved
  by minifiers; this change keeps that.
- Changing the text or the conditions of any warning.
- Removing thrown errors or callback failure reports, which are runtime behaviour.

## Impact

- `packages/core/src/components/tour/tour.machine.ts`, `packages/react/src/table/table.tsx`.
- `scripts/size.mjs` (production-diagnostics check with an allow-list).
