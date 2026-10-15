## Why

Dialog, Alert Dialog, Drawer, Popover, Menu, Select, Combobox, Tooltip, Hover Card,
Tour and Toast all need the same behaviour underneath: a stack of layers, dismissal
by Escape and outside interaction, focus containment and restore, hiding the
outside from assistive technology, scroll lock, exit animations and portals. These
pieces are where the other headless libraries have shipped most of their overlay
bugs (body `pointer-events` left stuck, focus lost on close, scroll lock never
released, the dialog beneath closing during an exit animation). They are specified
once here, framework-agnostic, before Dialog — the first component — is built on
them.

Research this change is based on:
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) (main
note: sources, bug history, accessibility, decisions) ·
[dialog](../../../docs/research/dialog.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

**Depends on `add-foundations`** (machine runtime and injected `Environment`,
contracts and the `Env` interface, drivers, `@rind-ui/testing/setup`, `testMachine`
and its generic invariants) **and on `add-a11y-foundations`** (the announcer's
keep-visible rule, the safe programmatic focus operation, interaction modality,
`notComposing`, the quirks registry). It must be applied after both.

## What Changes

- `@rind-ui/core/dom` gains framework-agnostic modules, each a plain function that
  receives the injected `Environment` (or the document it resolves) and returns a
  cleanup, used by machines as injected effects:
  - a **layer stack**, one per document, with explicit parentage — the single
    source of truth for "topmost", "nested" and "inside";
  - **dismiss**: Escape, outside press and outside focus routed to the topmost
    layer, vetoable, with typed reasons;
  - **focus containment**: initial focus, Tab wrapping inside the topmost modal
    layer, recovery when the focused node is removed, and focus restore with a
    fallback chain;
  - **outside hiding** with `inert` (never `aria-hidden` alone, never body
    `pointer-events`), ref-counted, keeping live regions and marked top-layer
    regions exposed;
  - **scroll lock**, ref-counted per document, with exact style restore,
    scrollbar compensation and an iOS touch policy that never blocks zoom;
  - **presence**: a small shared machine plus an exit-wait effect over
    `getAnimations()` (CSS transitions, keyframes and Web Animations);
  - **portal target resolution**, including the nearest open modal `<dialog>`,
    top-layer popover or fullscreen element.
- `@rind-ui/react` gains a generic `Portal` part and a `usePresence` binding.
- `@rind-ui/testing` gains contract traits and invariants for layers (`modal`,
  `presence`, a "DOM clean after close" check that also runs under Strict Mode)
  and driver support for presses outside layers; in jsdom the runner checks the
  attributes it sets and reports that inert behaviour is only verified in a real
  browser.
- `docs/research/overlay-infrastructure.md` is completed (Bug history,
  Accessibility, native-platform reconciliation) and marked done.

## Capabilities

### New Capabilities

- `layer-stack`: registering open layers per document, explicit nesting, topmost
  and topmost-modal queries, release on close, styling metadata.
- `dismissable-layer`: Escape, outside press and outside focus dismissal of the
  topmost layer, vetoes, reasons, and the edge cases (IME, touch, scrollbars,
  text selection, opening click).
- `focus-containment`: initial focus, Tab containment in modal layers, recovery
  when focus is removed, focus restore and its fallback chain.
- `outside-inert`: making everything outside the topmost modal layer inert, what
  stays exposed, nodes added while open, exact restore.
- `scroll-lock`: preventing page scroll while a modal layer is open, layout-shift
  compensation, iOS behaviour, zoom, exact restore.
- `presence`: keeping closing content mounted until its exit animations finish,
  re-opening during exit, and close-time semantics.
- `portal`: where portalled content renders, SSR and hydration, native top-layer
  interop, direction and language inheritance.
- `overlay-testing`: the `modal` and `presence` contract traits, their invariants
  and the environment support overlays need in the test drivers.

### Modified Capabilities

None. (`add-foundations` is not archived yet; this change only adds capabilities
and builds on the `layer` and `restores-focus` traits it already defines.)

## Non-goals

- Any public component. Dialog, Alert Dialog, Drawer, Popover and the rest each get
  their own change; this change ships the modules, their tests and a test fixture.
- Native `<dialog>.showModal()`, `popover`, `closedby`, invoker commands and
  `CloseWatcher` (decided against for v1 in native-platform.md); the
  `popover="manual"` top-layer spike before Wave 2.
- Floating positioning (`@floating-ui/dom`) and anchored-layer geometry.
- Non-modal "Tab out returns to the trigger" focus handling — first needed by
  Popover, specified there.
- The announcer itself (`add-a11y-foundations`); this change only fixes how
  overlays interact with it.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/dom/{layer-stack,overlay,dismiss,focus-scope,focus-restore,inert-outside,scroll-lock,presence,portal}.ts`
  and `packages/core/src/presence/` (presence machine); `packages/react/src/{portal,use-presence}.tsx`;
  `packages/testing/src/traits/overlay.ts`; a test-only fixture in
  `packages/testing/fixtures/layer/`.
- `Environment` gains no new required capability: modules use the `dom` and
  `scheduler` capabilities from `add-foundations`, plus an optional `platform`
  hint (iOS detection) that defaults to feature detection.
- No new runtime dependencies.
