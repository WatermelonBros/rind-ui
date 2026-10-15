## Why

rind-ui has a scaffolded monorepo and no behaviour yet. Every one of its ~100
components will stand on the same foundations: a state-machine runtime, the
framework adapter that binds it, and the contract/driver layer that makes
components testable by design. Getting these wrong once means getting every
component wrong, so they are specified and built first, on their own, before any
component change starts.

Research notes this change is based on:
[machine-runtime](../../../docs/research/machine-runtime.md) ·
[testing](../../../docs/research/testing.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

## What Changes

- A framework-agnostic **state-machine runtime** in `@rind-ui/core`: static,
  fully typed definitions; controlled/uncontrolled values handled by the runtime;
  state-scoped effects with cleanup; delayed transitions on an injected scheduler;
  an injected environment; a synchronous run-to-completion service that adapters
  bind to.
- The **React adapter** foundations in `@rind-ui/react`: binding a service to
  React, per-part selectors, prop normalisation, merging of consumer props, SSR-safe
  ids, element substitution.
- The **contract** abstraction in `@rind-ui/core`: anatomy, location, actions with
  per-modality implementations and postconditions, queries, state observations,
  event mapping, traits — written against an environment interface with no DOM.
- `@rind-ui/testing`: **DOM (Testing Library) and Playwright adapters**, typed
  **drivers** generated from contracts, the **`@rind-ui/testing/setup`** entry for
  jsdom/happy-dom, machine **graph extraction** and the **model-based test runner**
  with generic invariants (including accessibility invariants).
- Test infrastructure for the repo: Vitest browser mode (Playwright) as the primary
  suite, a jsdom suite that exercises `@rind-ui/testing/setup`, and Storybook's
  Vitest addon so stories run as tests with axe.
- A **reference fixture**: a minimal `disclosure` machine, contract and React parts
  used only by the foundation tests, to prove every layer end to end. It is not a
  public component (Collapsible gets its own change).

## Capabilities

### New Capabilities

- `machine-runtime`: defining, typing, running and controlling component state
  machines; delayed transitions; effects; the environment; the service interface.
- `react-adapter`: binding services to React, selectors, prop normalisation and
  merging, ids, element substitution.
- `component-contract`: the machine-readable description of a component (anatomy,
  location, actions, queries, states, events, traits), the environment interface
  it runs against, and the instance-scoping attributes.
- `test-drivers`: drivers generated from contracts, the DOM and Playwright
  adapters, and the jsdom/happy-dom environment setup.
- `model-based-testing`: graph extraction, path generation, the `testMachine`
  runner with a headless oracle, and generic invariants.

### Modified Capabilities

None — this is the first change.

## Non-goals

- Any public component. Dialog, Collapsible and the rest each get their own change.
- Overlay infrastructure (focus trap, dismiss layers, scroll lock, presence,
  portal, inert) — its own change, `add-overlay-infrastructure`, once the native
  platform research settles `<dialog>`/`popover`.
- Accessibility infrastructure (interaction modality / focus-visible, press,
  announcer, messages and locale, logical keys and IME guard, visually hidden) —
  its own change, `add-a11y-foundations`, right after this one.
- Collections (`core/collection`) — first needed by Listbox/Select/Menu.
- Floating positioning (`@floating-ui/dom`).
- Framework adapters other than React.
- Docs site, `llms.txt` generation, agent skill, MCP server.
- Random-walk testing with shrinking; a Playwright `test.extend` fixture.
- fx.

## Impact

- New code in `packages/core` (`machine/`, `contract/`, `env/`), `packages/react`,
  `packages/testing`, `apps/storybook`.
- New dev dependencies: Vitest, `@vitest/browser-playwright`, Playwright,
  `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/react`,
  jsdom, `@storybook/addon-vitest`, axe-core.
- `@rind-ui/testing` peer dependencies, each optional: `@testing-library/dom`,
  `@testing-library/user-event`, `playwright`/`@playwright/test` (types only).
- No runtime dependencies added to `@rind-ui/core` or `@rind-ui/react`.
