## Why

Accordion is shipped by seven of the nine libraries and is wave 1. Its own bugs
come from three shortcuts:

- re-implementing the collapsible (Bits);
- modelling it as a selectable collection (Kobalte, old React Spectrum);
- putting keyboard handling on the root (Base UI, Reka).

The APG pattern also changed on 2026-04-29 (w3c/aria-practices#3434), when it
removed the optional arrow, Home and End keys. Specifying it right after
Collapsible lets it be a thin group over Collapsible's machine.

Research note: [docs/research/accordion.md](../../../docs/research/accordion.md),
built on [docs/research/collapsible.md](../../../docs/research/collapsible.md)
and the cross-cutting accessibility, assistive-technology and native-platform
notes.

Depends on:

- `add-foundations`;
- `add-a11y-foundations` (press, modality, logical keys with RTL, focus
  attributes, hidden content, ids);
- the `presence` capability of `add-overlay-infrastructure`;
- **`add-collapsible`**: each item is a Collapsible, and its content uses the
  `content-size` module.

## What Changes

- A public **Accordion** component:
  - a root machine owning a controllable `value: string[]` (`multiple`,
    `collapsible`);
  - items that each run a controlled Collapsible service;
  - connect for the parts it adds (`Header`, the trigger lock, the region rule);
  - React parts `Root`, `Item`, `Header`, `Trigger`, `Content`, `Indicator`;
  - a contract and a generated driver (`getAccordion`);
  - model-based tests, stories, a theme stylesheet and a docs page.
- Headings have a configurable level (`h3` default). Panels are labelled
  regions when APG's landmark rule allows it, and drop role and name while
  closed.
- Arrow, Home and End navigation between headers is **off by default**
  (current APG). It is available as `keyboardNavigation`, handled only on
  triggers.

## Capabilities

### New Capabilities

- `accordion`: the Accordion component, which covers:
  - heading structure, region rule, roles and keyboard;
  - value semantics for single, multiple and non-collapsible modes;
  - disabled and locked items;
  - optional header navigation;
  - `data-*` per part;
  - the contract (driver actions and queries) and its invariants.

### Modified Capabilities

None. `collapsible` is introduced by the unarchived `add-collapsible`; this
change composes it and does not alter its requirements.

## Non-goals

- Changing Collapsible's behaviour. Hide modes, size variables, find-in-page,
  focus on close and exit presence are inherited as specified there.
- Typeahead, selection semantics, or a collection-backed accordion.
- Escape to collapse (no APG basis; kobalte#577).
- Auto-scrolling an opened panel into view (radix#3418, base-ui#4173).
- A native `<details name>` implementation (avoided; see the research note).
- Framework adapters other than React; fx.

## Impact

- New code:
  - `packages/core/src/components/accordion/` (machine, connect, contract);
  - `packages/react/src/accordion/`;
  - the `getAccordion` export in `packages/testing`;
  - `packages/theme/src/accordion.css`;
  - stories and the docs page.
- Reuses `packages/core/src/components/collapsible/` and
  `core/dom/content-size.ts` without changing them.
- No new dependencies.
