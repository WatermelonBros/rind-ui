## Why

rind-ui ships React, Vue and Svelte from one framework-free core
([0002](../../../docs/decisions/0002-architecture.md), [0013](../../../docs/decisions/0013-vue-svelte-adapters.md)).
Solid and Angular are the next two frameworks headless libraries are chosen on. Research:
[solid-adapter.md](../../../docs/research/solid-adapter.md),
[angular-adapter.md](../../../docs/research/angular-adapter.md). Decision:
[0014](../../../docs/decisions/0014-solid-angular-adapters.md).

## What Changes

- New package `@rind-ui/solid` (`solid-js` ≥ 1.9, < 2): components with reactive props, a
  `render` function for element substitution, `on<Value>Change` callbacks, children as a
  function of the state.
- New package `@rind-ui/angular` (Angular ≥ 21): attribute directives on the consumer's
  element (`<button rindToggleRoot>`), `input()` + `output()` value pairs (`[(pressed)]`),
  `exportAs` for template state, DI for context.
- Both expose React's anatomy and part names, from the package root and per component
  (`@rind-ui/solid/toggle`, `@rind-ui/angular/toggle`), and add components in the order of the
  Vue/Svelte port, both frameworks in the same pull requests, until they match `@rind-ui/react`.
- Each component's contract model (`testMachine`) and markup parity with React run against the
  Solid and the Angular parts in jsdom and real browsers.
- One release for both packages, when both reach parity (changesets only until then).

## Capabilities

### New Capabilities

- `solid-adapter`: binding services to Solid, prop normalisation and merging, element
  substitution, stable ids, provider, per-component exports.
- `angular-adapter`: the same for Angular directives.

### Modified Capabilities

_(none: component behaviour is unchanged; every component's own spec applies to each adapter)_

## Non-goals

- Solid 2 (a release candidate; its own change once stable).
- Angular `ControlValueAccessor` / Signal Forms integration (a follow-up change).
- Lit or other adapters.
- The docs site's framework selector (the site agent's work; it reads each package's
  `exports`).
