## Context

The Vue and Svelte ports ([vue-svelte-adapters](../vue-svelte-adapters/design.md)) showed that a
parts layer is about ten helpers (machine binding, prop normalisation and merging, element
substitution, ids, provider, press/hover, modality, icons) plus thin parts. This change writes
those helpers for Solid and Angular, then ports each component's parts. The shared helpers in
`@rind-ui/core/internal` (`adapter/`: merge, registry, provider, `neutralName`) are reused
unchanged.

## Decisions

### Solid

- Parts are `.tsx` components compiled by `babel-preset-solid`; one static element per part on
  the default path (no `Dynamic`: Kobalte #717).
- Props are never destructured: `splitProps` for a part's own keys. Connect's props and the
  consumer's are merged by core's `mergeProps` (handler chaining, `preventRindHandler()`)
  inside a `createMemo`, and the memo's object is spread on the element; Solid's own
  `mergeProps` is never used for handlers (it keeps only the last).
- Element substitution: `render={(props, state) => <a {...props} />}` (a function only; Solid
  cannot clone an element). The part's `ref` reaches the consumer's element through `props`.
- Children may be a function of the state.
- Controlled values: `<value>` + `on<Value>Change(value, details)` (`details.cancel()`
  vetoes); controlled while the prop is not `undefined`, read on every access.
- Ids: `createUniqueId()` (server and hydration agree) or the consumer's `id`.
- Effects go through one `lifecycle` module (`onMount`, `createEffect`, `onCleanup`), so Solid
  2's `onSettled` is a one-file change.
- Layers render through an own portal (`insert` into the layer container), without the wrapper
  `<div>` Solid's `Portal` adds.
- Build: tsdown with a Rolldown plugin running `babel-preset-solid`, twice: `dist/**/*.jsx`
  (JSX kept, `solid` condition) and `dist/**/*.js` (`generate: "dom"`, `hydratable: true`,
  `default`), per component subpath.

### Angular

- Parts are attribute directives on the consumer's element, selector `[rind<Component><Part>]`,
  `exportAs` `rind<Component><Part>`, collected in a const tuple per component
  (`export const Toggle = [ToggleRoot, ToggleIndicator] as const`). No wrapper elements, so
  the markup is React's; the host tag is known at construction (connect's `tag`).
- One binder per element applies connect's output through `Renderer2` from an `effect`
  (attributes present in server HTML); its listeners are added in `ngOnInit`, so the
  consumer's `(event)` runs first, as with React's `mergeProps`, and may call
  `preventRindHandler()`.
- Machines: `useMachine` keeps the snapshot in a signal; inputs are read through `computed`;
  cleanup through `DestroyRef`; environment work in `afterNextRender`.
- Controlled values: `input()` `<value>`, `output()` `<value>ChangeDetails({ value, details })`
  first (its `details.cancel()` vetoes) and `output()` `<value>Change(value)` for `[(value)]`,
  never `model()`; one-way `[pressed]` stays controlled; `default<Value>` inputs for
  uncontrolled use.
- Inputs are set after a directive's constructor: the service is created on first read, during
  the first change detection, so the controlled/uncontrolled mode and defaults are latched from
  the real inputs.
- A static attribute the consumer writes wins over the part's (React's consumer-props-win), read
  from the template with `HostAttributeToken` (a hydrated element already carries the
  server-written attributes); attributes a directive owns as inputs (`id`, `disabled`, `href`,
  `type`) are the part's.
- Context: an injection token per component root; collections register with the root and order
  by DOM position (content projection breaks parent injection, Radix NG #451).
- Ids: a root-provided id source (`APP_ID` + counter); an `id` input overrides.
- Build: `ngc` partial compilation into `dist/` (per-file ESM + `.d.ts`), the same subpath
  `exports` shape as `@rind-ui/vue`; `typescript@~6.0` beside 7; `typecheck` is
  `ngc -p tsconfig.json --noEmit`.

### Tests

- The contract model test is the parity check, as in vue-svelte-adapters: React's
  `testMachine(contract, …)` with the framework's mount as `setup`.
- Markup parity: `canonicalHtml` from `@rind-ui/testing` after each package's fixture strips its
  framework's own attributes (Solid: `data-hk`, comment markers; Angular: selector attributes,
  `ng-version`, `ngh`, `ng-reflect-*`).
- Vitest projects: `vite-plugin-solid` scoped to `packages/solid/**` with the `browser` and
  `solid` resolve conditions first; `@analogjs/vite-plugin-angular` (AOT) scoped to
  `packages/angular/**`. Both keep the repo's React `.tsx` transform untouched.
- Server render and hydration fixtures per package (Solid: a fixture compiled for `ssr` and
  `dom` with `hydratable: true`; Angular: `@angular/platform-server`).
- `@angular/platform-server` runs on Node only: server parity and hydration are
  `*.ssr.dom.test.ts` (jsdom project); the server platform installs domino's DOM classes as
  globals, and the fixtures restore jsdom's after each render.

### Pull requests

Each component batch is one pull request carrying both frameworks; changesets accumulate and no
version is bumped until both packages reach parity (one release).

## Risks

- Solid's event delegation runs handlers at `document`: a native listener that stops
  propagation below it hides the event from Solid handlers (as with React's root delegation;
  core's `dom/` modules already account for it).
- Solid 2 is a daily-RC; pinning 1.9 means a migration change later (lifecycle module, the
  `@solidjs/web` runtime move).
- Angular: a v22 partial build may not link in an Angular 21 application; if the scaffold
  cannot prove it, the peer range narrows to ≥ 22.
- Two more toolchains in the repository (Babel, `ngc`), each scoped to its package and its
  Vitest project.
