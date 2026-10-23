# 0013 — Vue and Svelte adapters

Status: accepted · 2026-10-23

## Context

[0002](0002-architecture.md) kept the core framework-free so that other adapters could be added
"when there is demand". The demand is here: rind-ui is React-only, and most headless libraries
people compare it with ship Vue (Reka, Ark) or Svelte (Bits, Melt, Ark) bindings. Research:
[framework-adapters.md](../research/framework-adapters.md).

## Decision

- Two packages, `@rind-ui/vue` (Vue ≥ 3.5) and `@rind-ui/svelte` (Svelte ≥ 5.29), built one
  component at a time until they match `@rind-ui/react`. Each is a parts layer only: machines,
  connect, contracts and drivers are shared and unchanged.
- Same anatomy and part names as React (`Toggle.Root`, `Dialog.Content`), exported as module
  namespaces from the package root and from `@rind-ui/<framework>/<component>`.
- Each framework's own idioms instead of React's: Vue `v-model:<value>` + `<value>Change`
  events, `asChild`, scoped slots; Svelte `bind:<value>` (function bindings for fully
  controlled use), `child`/`children` snippets, attachments for element refs.
- The framework-neutral glue the adapters share (prop merging with `preventRindHandler`,
  the part registry, provider config resolution) lives in `@rind-ui/core/internal` under
  `adapter/`. React keeps its own copies for now; moving it onto the shared helpers is a
  separate change.
- No new runtime dependency: the packages depend on `@rind-ui/core` and the framework (peer).
  Development only: `svelte`, `@sveltejs/vite-plugin-svelte` (Vitest), `@sveltejs/package`
  (build), `svelte-check` with TypeScript 6 beside 7 (svelte-check's `--tsgo` needs both).
- Testing: the same drivers and the same model-based `testMachine` runs against each
  framework's render, in jsdom and real browsers. A component is ported when its contract
  model passes in both frameworks.
- The site reads each package's `exports` to know which components a framework ships, and
  disables the others in its framework selector.

## Consequences

- Behaviour stays in one place: a fix in a machine or connect reaches all three frameworks.
- Every component costs two more parts layers and their tests; the per-framework tests stay
  small because the contract model does the heavy lifting.
- A component's docs page lists the frameworks that ship it; until parity, some pages are
  React-only.
