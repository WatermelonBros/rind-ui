## 1. Test infrastructure

- [x] 1.1 Add dev dependencies: vitest, @vitest/browser-playwright, playwright, @testing-library/dom, @testing-library/user-event, @testing-library/react, jsdom, axe-core, @storybook/addon-vitest
- [x] 1.2 Root `vitest.config.ts` with `node`, `jsdom` and `browser` projects (see design: Repo test infrastructure); `pnpm test` runs them through Turbo
- [x] 1.3 Wire `@storybook/addon-vitest` to the browser project; confirm a story with an axe violation fails
- [x] 1.4 GitHub Actions workflow: install, lint, typecheck, build, size check, test (browser project on Chromium, Firefox, WebKit)

## 2. Machine runtime (`core/machine`, `core/env`)

- [x] 2.1 Types: `EventObject`, `GuardExpr`, `TransitionDef`, `StateDef`, `MachineDef` (F-bounded), `Implementations`, `setup`, `type()` — per machine-runtime.md §5.2
- [x] 2.2 Type tests (`expectTypeOf` / `@ts-expect-error`) for every compile error listed in the `Definitions Are Type-Checked` requirement
- [x] 2.3 Capability interfaces (`Scheduler`, `DomRoot`, …) and `domEnvironment()`; scheduler resolves timers at call time
- [x] 2.4 `createService`: snapshot, run-to-completion queue, transitions (guarded arrays, `reenter`), exit/transition/entry order, one notification per outer `send`
- [x] 2.5 Effects: state-scoped and service-scoped, cleanup on exit, live getters, `send` revoked after `stop()`
- [x] 2.6 Delayed transitions on the scheduler, cancelled on exit
- [x] 2.7 `controllable()`: prop-name inference, frozen mode with dev warning, read-time resolution in `view()`, proposals, `$sync`, `$reverted`, `ChangeDetails` with `reason`, `event`, `cancel()`
- [x] 2.8 `start`/`stop` idempotence and restart semantics; `inspect()`; `onProps` events; computed memoisation
- [x] 2.9 Measure type-check time and error readability on a synthetic 60-transition machine; record the result in machine-runtime.md and apply the fallback if needed
- [x] 2.10 Size check over the built `machine/` entry (≤ 2.5 kB min+gz), wired into `build`
- [x] 2.11 `node` project tests covering every scenario in `specs/machine-runtime/spec.md`

## 3. React adapter (`@rind-ui/react`)

- [x] 3.1 `useMachine` (useSyncExternalStore, setProps per commit, start/stop in effect) and `useSelector`
- [x] 3.2 `normalizeProps` for React
- [x] 3.3 `mergeProps` with handler order, `preventRindHandler`, className/style/ref/id rules, dev warning for accessibility-critical overrides
- [x] 3.4 `render` prop helper (element or function with state)
- [x] 3.5 Ids via `useId`, overridable per part; `data-scope`/`data-part`/`data-instance` on every part
- [x] 3.6 Tests for every scenario in `specs/react-adapter/spec.md`, including StrictMode and an SSR render + hydrate test

## 4. Contracts (`core/contract`)

- [x] 4.1 `Env`, `Part`, `Key`, `KeyOptions`, `By`, `Modality` types — per testing.md (a)
- [x] 4.2 `contract()` and `ContractDef<M>`: anatomy, locate, actions (function shorthand or per-modality + `done`), queries, states, events, traits; compile-time checks against the machine
- [x] 4.3 `virtual` modality in `Modality`; pointer actions replay as bare clicks (`detail: 0`) in virtual mode in both adapters
- [x] 4.4 Type tests for unknown part / state / event / action names

## 5. `@rind-ui/testing`

- [x] 5.1 `toGraph` and `paths` (BFS; states and transitions coverage; prefix pruning) with `node` tests
- [x] 5.2 DOM adapter: TL queries with `exact: true`, `data-instance` scoping, asyncWrapper/eventWrapper, pluggable user, distinct pointer coordinates, `until`, `advance`, multi-match errors listing every match
- [x] 5.3 Playwright adapter: locators, exact names, type-only Playwright imports, same `until` loop
- [x] 5.4 `createDriver` with inferred action/query types, `via(modality)`, explicit missing-modality errors, target duck-typing
- [x] 5.5 `@rind-ui/testing/setup`: polyfills only-if-missing per test-drivers spec; `resetRindGlobals` registered on global `afterEach` and exported
- [x] 5.6 `testMachine` and `machinePaths`: per path × modality tests through a passed-in registrar, headless oracle via `inspect`, observation checks, uncovered-events report, readable failures
- [x] 5.7 Generic invariants per `specs/model-based-testing/spec.md` (including the accessibility invariants), trait-gated; per-contract and consumer invariants; a11y checker once per distinct state
- [x] 5.8 Virtual modality included by default for pointer actions; trait-gated invariants `selectable`, `set-metadata`, `valued`, `live-region`
- [x] 5.9 RTL runs: `directions` option, `directional` trait runs both by default, horizontal arrow mirroring in the driver
- [x] 5.10 Package exports `.`, `./dom`, `./playwright`, `./setup`; optional peers; publint clean

## 6. Fixture and end-to-end proof

- [x] 6.1 `disclosure` fixture: machine, connect, contract (trait `disclosure`), React parts, stories in `apps/storybook`
- [x] 6.2 Driver test for the fixture that passes unchanged in the `browser` and `jsdom` projects
- [x] 6.3 The same driver test through the Playwright adapter against Storybook
- [x] 6.4 `testMachine` over the fixture: all transitions × modalities pass; a deliberately broken variant (missing `aria-expanded`, content still visible when closed) fails with readable reports
- [x] 6.5 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` all green

## 7. Review follow-ups

- [x] 7.1 Read-only prop bindings (`machine-runtime` → "Read-Only Prop Bindings"): initial state resolved from the prop at creation, `$sync` on change, no callbacks, graph edges; node + SSR tests
- [x] 7.2 Prop steps in `testMachine` (`model-based-testing` → "Prop Steps"): `rerender` option, contract mapping for `$sync`/`$props` edges, oracle fed the same props; fixture maps `$sync:open`
- [x] 7.3 Expected parts (`react-adapter` → "Expected Parts"): no render-phase mutation, server/hydration ids for expected parts, post-commit removal + dev warning; SSR test with Title inside Content; Suspense test
- [x] 7.4 Per-part and per-item `data-state` in contracts and the invariant (`model-based-testing` → Generic Invariants)
- [x] 7.5 Second-pass errors B1, B2, B3, B5 (Reado tasks from watermelon-86); B4, B6–B8 deferred to docs/review-backlog.md
