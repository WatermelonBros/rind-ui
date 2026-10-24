# 0014 — Solid and Angular adapters

Status: accepted · 2026-10-24

## Context

[0013](0013-vue-svelte-adapters.md) brought Vue and Svelte to parity with React through the
shared core. Solid and Angular are the next two frameworks people compare headless libraries
on (Kobalte, Ark UI Solid; ng-primitives, Angular Aria, Radix NG, Spartan). Research:
[solid-adapter.md](../research/solid-adapter.md), [angular-adapter.md](../research/angular-adapter.md).

## Decision

- Two packages, `@rind-ui/solid` (`solid-js` ≥ 1.9, < 2) and `@rind-ui/angular`
  (`@angular/core` and `@angular/common` ≥ 21), parts layers only, built one component at a
  time in the order of 0013's port until they match `@rind-ui/react`. Both join the
  Changesets fixed version group; the two ship in one release when both reach parity.
- Same anatomy and part names as React. Solid: components (`<Toggle.Root>`) from module
  namespaces, `render` functions for element substitution. Angular: attribute directives on the
  consumer's element (`<button rindToggleRoot>`), exported in a const tuple per component
  (`imports: [Toggle]`), `exportAs` for template state.
- Controlled values in each framework's idiom: Solid `pressed` + `onPressedChange`; Angular an
  `input()` + `output()` pair (`pressed` / `pressedChange`, so `[(pressed)]` works), never
  `model()`.
- No new runtime dependency: each depends on `@rind-ui/core` and its framework (peers).
  Development only:
  - Solid: `solid-js`, `babel-preset-solid` and `@babel/core` 7 (a Rolldown plugin in the tsdown
    build and in the hydration fixtures), `vite-plugin-solid` (Vitest, scoped to
    `packages/solid`).
  - Angular: `@angular/core`, `@angular/common`, `@angular/compiler`,
    `@angular/compiler-cli` (`ngc` partial compilation), `typescript@~6.0` beside 7 (as
    `@angular/compiler-cli` 22 requires, like svelte-check), `@analogjs/vite-plugin-angular`
    (Vitest, AOT: JIT misses signal inputs).
- Packaging: Solid ships JSX under the `solid` export condition and DOM-compiled JS as
  `default`, per component (the consumer's compiler makes the server build); Angular ships
  partially compiled per-file ESM with `.d.ts`.
- Solid 2 is a release candidate: it waits for a stable release and its own change.
- Testing as in 0013: the same contract models (`testMachine`) and drivers against each
  framework's parts, markup parity with React through `canonicalHtml` (after stripping each
  framework's own hydration attributes), server render and hydration fixtures.

## Consequences

- Five parts layers over one core: a machine or connect fix reaches all of them.
- The repository carries two more toolchains (Babel for Solid JSX, `ngc` for Angular), both
  scoped to their package.
- The site's framework selector gains two entries, enabled per component from each package's
  `exports`.
