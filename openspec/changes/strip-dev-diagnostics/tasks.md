## 1. Helpers

- [ ] 1.1 `packages/core/src/dev/diagnostics.ts`: `devWarn`, `devError`, `devWarnOnce`, `reportFailure`, single `process` declaration; unit tests in development and production modes

## 2. Migration

- [ ] 2.1 Find why each of the 8 production messages survives (accordion, tour ×5, qr-code, table) and fix the cause
- [ ] 2.2 Switch every `console.*` in `packages/core` and `packages/react` to the helpers, classified diagnostic vs failure report; remove per-file `process` declarations and `dev()` helpers
- [ ] 2.3 Existing warning tests still pass (messages unchanged)

## 3. Checks

- [ ] 3.1 `scripts/size.mjs`: production whole-library bundle has no `[rind-ui]` message outside the failure-report allow list
- [ ] 3.2 `scripts/lint-platform.mjs`: `console.*` outside the diagnostics module fails (with a test)

## 4. Verify and ship

- [ ] 4.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check pass
- [ ] 4.2 Changeset (patch, `@rind-ui/core`, `@rind-ui/react`)
