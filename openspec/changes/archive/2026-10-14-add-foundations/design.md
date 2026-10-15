## Context

The monorepo is scaffolded (pnpm 11 + Turborepo, TypeScript 7, tsdown + publint,
Biome, Storybook 10) with empty `core`, `react` and `testing` packages and a CSS-only
`theme`. Workspace packages export a `@rind-ui/source` condition pointing at
`src/index.ts`; `tsconfig.base.json` sets `customConditions` and Storybook's Vite
config resolves it, so nothing waits for a build.

The API sketches this design relies on are in the research notes and are binding
unless this document says otherwise:

- [machine-runtime.md §5](../../../docs/research/machine-runtime.md) — definition
  shape (5.1), type inference (5.2), implementation signatures (5.3), controllable
  semantics (5.4), service interface and React binding (5.5), graph (5.6).
- [testing.md — Decisions](../../../docs/research/testing.md) — `Env`/`Part` (a),
  contract shape, adapters (b), drivers (c), setup (d), `testMachine` (e).

## Goals / Non-Goals

**Goals:**
- Every layer of the architecture (machine → connect → parts → contract → driver →
  model-based test) exists and is proven end to end on a fixture.
- Compile-time errors for every naming mistake the specs list.
- The same fixture test passes in Vitest browser mode, in jsdom with
  `@rind-ui/testing/setup`, and through the Playwright adapter.

**Non-Goals:**
- Hierarchical or parallel states; machine composition (decided with Menu/Combobox).
- Collections, overlays, positioning.
- Devtools UI (only the `inspect` hook).

## Decisions

### Layout

```
packages/core/src/
├─ machine/        setup(), controllable(), type(), createService(), types
├─ env/            capability interfaces (Scheduler, DomRoot, …) + domEnvironment()
├─ contract/       contract(), Env/Part/Key/By/Modality types, ContractDef
└─ index.ts
packages/react/src/
├─ use-machine.ts  useMachine, useSelector
├─ normalize-props.ts, merge-props.ts, render.ts (render prop), use-ids.ts
└─ index.ts
packages/testing/src/
├─ graph.ts        toGraph, paths
├─ driver.ts       createDriver, Driver<C>
├─ adapters/dom.ts, adapters/playwright.ts
├─ model.ts        testMachine, machinePaths, generic invariants
├─ setup.ts        the `@rind-ui/testing/setup` entry
└─ index.ts
packages/testing/fixtures/disclosure/   machine, connect, contract, React parts (not published)
```

`@rind-ui/testing` exports: `.` (drivers, `testMachine`, graph), `./dom`,
`./playwright`, `./setup` (listed in `sideEffects`).

### Resolved open questions from the research

| Question (note) | Decision | Why |
|---|---|---|
| Hierarchical states (runtime 1) | Flat in v1; `.` reserved in state names | 4/52 Zag machines nest; revisit at Combobox with data |
| Machine composition (runtime 2) | Out of scope; adapters may run sibling services | First needed by overlays (presence) — decided there |
| Event narrowing (runtime 3) | `assertEvent(event, "X")` + `event.type` checks; no per-transition params | Smallest surface; revisit only if Select needs it |
| Environment granularity (runtime 4) | Per-machine `env` type built from small capability interfaces; `domEnvironment()` returns an object implementing all capabilities core knows | ISP for machines, no generic gymnastics for adapters |
| TS 7 inference cost (runtime 5) | Keep the F-bounded `const D`; task 2.9 measures a 60-transition synthetic machine; fallback is `satisfies MachineDef<…>` with an explicit state union | Measure before choosing the worse ergonomics |
| Large collections (runtime 6) | Out of scope | Collections change |
| `$reverted` (runtime 7) | Machine-level `$reverted` event only | One mechanism; connect can map it |
| Cancelable changes (runtime 8) | `cancel()` in `ChangeDetails` from day one; no `allowPropagation()` | Adding it later would be breaking; propagation is a dismiss-layer concern |
| Devtools (runtime 9) | `inspect()` on the service in core, counted in the 2.5 kB budget | The oracle needs it too; avoids a second build |
| `data-instance` (testing 1) | Adopt | Covers parts no ARIA relation points to (backdrop, positioner) |
| Default DOM input (testing 2) | user-event; pluggable `vitest/browser` input | Our dual-environment CI catches mismatches |
| Random walks (testing 3) | Not in v1 | Graph walk first |
| Event arguments (testing 4) | One value per event (`args(ctx)`) | Equivalence classes later, per component |
| Props-dependent graphs (testing 5) | `props` option, required when any guard reads props (type-level) | Oracle must evaluate guards like the component |
| Playwright fixture (testing 6) | Not in v1; `createDriver(page)` only | Keep the surface small |
| a11y per step (testing 7) | Once per distinct state per test | Cost control in jsdom |
| Generic a11y invariants | Every [I] rule of accessibility.md's checklist that needs no component knowledge, trait-gated where it depends on the pattern | Checked on every component for free. Rule 12 (`data-focus-visible`) arrives with `add-a11y-foundations`, which ships the modality tracker |
| Native `<dialog>` (testing 8) | Overlay change | Depends on native-platform research |

### Clarifications agreed during implementation

- **Context and values types** are declared in `type<{ props; events; env; context? }>()`
  because implementations are typed before `.machine()`. The machine's `context`
  factory must return that type. Candidate controllable values are the prop keys `K`
  that have both `defaultK` and `onKChange`; only keys declared in the definition's
  `values` are controllables at runtime, and `set` on any other key is a compile error.
- **State inference** uses `machine<const S extends string>(def: MachineDef<S, T, I>)`
  with `NoInfer<S>` on `initial` and targets (the F-bounded `D` sketch hits TS2313 on
  TS 7.0.2). The measurement is recorded in machine-runtime.md as task 2.9's outcome.
- **No function shorthand for contract actions.** Every action is
  `{ pointer?, keyboard?, touch?, none?: { keyboard: reason }, done }`; `virtual` is
  derived from `pointer`. This makes the keyboard-twin rule checkable.
- **Controlled writes** run the transition's actions, skip exit/entry and the state
  change, and record the proposal; `cancel()` runs nothing. Context written by those
  actions is not rolled back when the parent refuses.

### Review follow-ups (tasks 7.x)

- **`bindProp(name, { states })`** declares a read-only prop binding in `values`,
  next to `controllable()`. Same state mapping and `$sync` machinery; no proposal, no
  callback, no `$reverted`. Prop names are checked against `props` at compile time.
- **Prop steps**: `testMachine({ …, rerender: (props) => … })`; contract `events` map
  `"$sync:<value>"` / `"$props:<prop>"` to `{ props: (target) => Partial<Props> }`.
  The DOM adapter's `rerender` comes from Testing Library's `render` result; the
  Playwright one from the story's args (e.g. Storybook URL args).

### Element substitution: `render` prop, not `asChild`

`render` accepts an element or `(props, state) => element`. Chosen over Radix/Ark's
`asChild` because the merged props are explicit and typeable, state is available to
the consumer, and it needs no `cloneElement` of an arbitrary single child (Base UI
made the same move). Reado's `Slot.tsx` migrates to `render` during its migration.

### Handler merging

Consumer handler first, then the part's, unless the consumer calls
`event.preventRindHandler()` (added to the event object by `mergeProps`). Using
`event.defaultPrevented` as the opt-out (Radix) is rejected: it conflates "skip the
library's logic" with "skip the browser's default", which consumers need separately.

### Accessibility-critical attributes

Each part's connect output marks attributes the pattern depends on (`role`,
`aria-*` relations it owns). Overriding one in development logs a warning naming
the part and attribute; production never warns.

### Size check

A build step measures `@rind-ui/core`'s `machine/` entry minified + gzipped (e.g.
with `size-limit`'s preset or a small script over the tsdown output) and fails over
2.5 kB.

### Repo test infrastructure

- Root `vitest.config.ts` with projects: `browser` (Vitest browser mode, Playwright
  provider, Chromium + Firefox + WebKit in CI, Chromium locally), `jsdom` (runs the
  same driver tests with `@rind-ui/testing/setup`), `node` (machine and graph tests,
  no DOM).
- Storybook: `@storybook/addon-vitest` wired to the browser project; the existing
  `a11y.test: "error"` parameter then fails stories with axe violations.
- Turbo `test` task runs all projects; CI installs Playwright browsers.

### The fixture

`disclosure` (states `closed`/`open`, events `OPEN`/`CLOSE`/`TOGGLE`, controllable
`open`, one delayed transition for testing `after`, one effect) with connect,
contract (traits `disclosure`), React parts (Root, Trigger, Content) and stories. It
lives under `packages/testing/fixtures/` and is excluded from the published files.

## Risks / Trade-offs

- [TS 7's programmatic API is experimental and tsdown warns] → if `.d.mts` output is
  wrong, pin TypeScript 6 for `build` only (decision 0002).
- [F-bounded inference may be slow or produce unreadable errors] → measured in
  tasks; documented fallback.
- [user-event's synthetic input diverges from browsers (zag#3298, #1920)] → the same
  tests run in browser mode; distinct pointer coordinates per interaction.
- [Own runtime is more code to own than XState] → size budget, one interpreter,
  model-based tests of the runtime itself.
- [`preventRindHandler` mutates the event object] → it is added once per event by
  `mergeProps` and is typed on the handler's event parameter.
