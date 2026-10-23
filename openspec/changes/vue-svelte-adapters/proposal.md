## Why

rind-ui ships React only. Its core (machines, connect, contracts, drivers) was built
framework-free so other adapters could follow ([0002](../../../docs/decisions/0002-architecture.md));
Vue and Svelte are the two most asked-for. Research:
[docs/research/framework-adapters.md](../../../docs/research/framework-adapters.md). Decision:
[0013](../../../docs/decisions/0013-vue-svelte-adapters.md).

## What Changes

- New package `@rind-ui/vue` (Vue ≥ 3.5): render-function components, `v-model:<value>` and
  `<value>Change` events, `asChild`, scoped slots carrying the part's state.
- New package `@rind-ui/svelte` (Svelte ≥ 5.29): runes components, `bind:<value>`, `child` and
  `children` snippets, element refs through attachments.
- Both expose the React anatomy and part names as module namespaces, from the package root and
  per component (`@rind-ui/vue/toggle`), and add components one at a time (both frameworks
  together) until they match `@rind-ui/react`.
- `@rind-ui/core/internal` gains the framework-neutral adapter helpers (prop merging, part
  registry, provider config) the two adapters share.
- Each component's contract model (`testMachine`) runs against the Vue and Svelte parts in jsdom
  and real browsers.

## Capabilities

### New Capabilities

- `vue-adapter`: binding services to Vue, prop normalisation and merging, element substitution,
  stable ids, provider, per-component exports.
- `svelte-adapter`: the same for Svelte 5.

### Modified Capabilities

_(none: component behaviour is unchanged; every component's own spec applies to each adapter)_

## Non-goals

- Solid, Angular, Lit adapters.
- Moving `@rind-ui/react` onto the shared adapter helpers (a separate change).
- The docs site's framework selector (the site agent's work; it reads each package's `exports`).
- Vue 2, Svelte 4 or the Options API.
