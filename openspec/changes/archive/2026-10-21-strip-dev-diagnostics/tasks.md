## 1. Guards

- [x] 1.1 Tour: guard the unknown `goto` id diagnostic
- [x] 1.2 Table: `warnOnce` returns first in production

## 2. Check

- [x] 2.1 `scripts/size.mjs`: production whole-library bundle has no `[rind-ui]` console diagnostic outside the failure-report allow-list
- [x] 2.2 Verify the check fails when a guard is removed

## 3. Verify and ship

- [x] 3.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check pass
- [x] 3.2 Changeset (patch, `@rind-ui/core`, `@rind-ui/react`)
