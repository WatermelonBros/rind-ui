## Why

Collapsible (the APG Disclosure pattern) is shipped by all nine libraries in
[components.md](../../../docs/components.md). It is wave 1, and Accordion,
Reasoning and Navigation Menu triggers are built from it. Every library has the
same bug class: measuring height for animations, mount and replay animations,
content that is unreachable when closed, and `aria-*` that drift from state. So
it is specified once, carefully, as the first public disclosure.

Research note: [docs/research/collapsible.md](../../../docs/research/collapsible.md)
(with [accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md),
[native-platform](../../../docs/research/native-platform.md) §6 and §10).

Depends on:

- `add-foundations`: machine runtime, controllables, contracts, drivers,
  `testMachine`, React adapter.
- `add-a11y-foundations`: press, modality, focus attributes, hidden content
  and find-in-page reveal, ids, platform and preferences.
- The `presence` capability of `add-overlay-infrastructure`: exit animations.

## What Changes

- A public **Collapsible** component:
  - a two-state machine (`closed`/`open`) with a controllable `open`;
  - connect;
  - React parts `Root`, `Trigger`, `Content` and `Indicator`;
  - a contract and a generated driver (`getCollapsible`);
  - model-based tests, stories, a theme stylesheet and a docs page.
- **Closed content stays mounted and findable by default**
  (`closedContent: "until-found" | "hidden" | "unmount"`). Find-in-page opens
  it with `reason: "find-in-page"`.
- A shared **content-size** module in `core/dom`. It exposes the content's
  natural size as CSS custom properties:
  - `0px` when closed;
  - measured px during the enter and exit animations;
  - `auto` when settled.

  This lets themes animate height with CSS transitions, with no
  mount-animation suppression. Accordion reuses it.
- Focus moves to the trigger when the content closes with focus inside it.

## Capabilities

### New Capabilities

- `collapsible`: the Collapsible component, which covers:
  - roles, keyboard and focus;
  - hide modes and find-in-page;
  - size custom properties and animation behaviour;
  - `data-*` per part;
  - controlled and uncontrolled `open`;
  - the contract (driver actions and queries) and its invariants.

### Modified Capabilities

None. The capabilities this builds on are introduced by the unarchived
`add-foundations`, `add-a11y-foundations` and `add-overlay-infrastructure`.

## Non-goals

- Accordion. Its own change, `add-accordion`, reuses this machine, connect and
  the content-size module.
- Partially collapsed content (Zag `collapsedHeight`, reka#2320).
- Several triggers for one content (base-ui#4282, Ariakit).
- `onOpenChangeComplete`. Presence's `onExitComplete` covers exit.
- An `orientation` prop. The width variable covers horizontal reveals.
- A native `<details>`/`<summary>` implementation (avoided; see the research
  note).
- JavaScript-driven animation, and `interpolate-size` in components (theme only).
- Framework adapters other than React; fx.

## Impact

- New code:
  - `packages/core/src/components/collapsible/` (machine, connect, contract);
  - `packages/core/src/dom/content-size.ts`;
  - `packages/react/src/collapsible/`;
  - `packages/testing` (generated `getCollapsible` export);
  - `packages/theme/src/collapsible.css`;
  - stories in `apps/storybook`;
  - the docs page.
- No new dependencies.
