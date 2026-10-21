## 1. Extract

- [x] 1.1 `dom/long-press.ts`: `longPress(options)` with the timer, tolerance, second-pointer cancel, callout attribute and context-menu hold, moved verbatim from `press.ts`
- [x] 1.2 `createPress` calls the extension hooks at the existing touch points; no long-press code left in `press.ts`
- [x] 1.3 Context Menu passes `longPress(…)`; export from `dom/index.ts`

## 2. Tests and checks

- [x] 2.1 Press long-press tests use the extension and pass unchanged in Chromium, Firefox, WebKit; Context Menu suite passes
- [x] 2.2 Test: a press without the extension schedules no long-press timer
- [x] 2.3 `scripts/size.mjs`: Switch bundle excludes `dom/long-press`; lower budgets

## 3. Ship

- [x] 3.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check pass
- [x] 3.2 Changeset (minor, `@rind-ui/core`: `createPress` `longPress` option takes the extension)
