## Why

Popover is a wave-1 component shipped by all nine libraries, and the first
anchored layer with interactive content that rind-ui builds on the overlay
infrastructure and floating positioning. Its bug history is dominated by one
thing the infrastructure deliberately left open — where a portalled, non-modal
panel sits in the Tab order (Radix #4128, Headless UI #3231, Base UI #5715) —
plus trigger/dismiss races and focus-restore gaps. Specifying it now gives
Hover Card, Navigation Menu and the AI Citation primitive a tested base.

Research: [docs/research/popover.md](../../../docs/research/popover.md) (sources,
bug history, accessibility, decisions) · cross-cutting
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md).

**Depends on** `add-foundations` (machine runtime, contracts, drivers,
`testMachine`), `add-a11y-foundations` (press, modality, focus-visible, ids,
messages, logical keys), `add-overlay-infrastructure` (layer stack, dismiss,
focus containment and restore, outside inert, scroll lock, presence, portal) and
`add-floating-positioning` (`popup` preset, positioner/arrow parts, CSS variables,
contract fragment). This change specifies only component-level behaviour on top
of them.

## What Changes

- A `popover` component in `@rind-ui/core` (machine, connect, contract) and
  `@rind-ui/react` (parts): `Root`, `Trigger`, `Anchor`, `Indicator`,
  `Positioner`, `Content`, `Arrow`, `Title`, `Description`, `CloseTrigger`
  (plus the shared `Portal`).
- Non-modal by default (`role="dialog"`, page stays operable); `modal` makes it
  a modal dialog through the overlay infrastructure (inert outside, scroll lock,
  Tab wraps).
- Trigger toggles; Escape, outside press and outside focus dismiss through the
  layer stack, each vetoable, with a typed close reason on every
  `onOpenChange`.
- Focus moves into the content after the first placement; it returns to the
  trigger on every close path unless the user moved focus elsewhere.
- Name from the Title part, consumer labelling, or (non-modal only) the trigger.
- A new shared capability, **`non-modal-tab-order`**: a non-modal layer's
  content takes its place in the Tab sequence right after its trigger, without
  sentinel elements. First consumer: Popover; reused by `add-hover-card` and
  later by Navigation Menu.
- Contract (`popoverContract`) and driver with the overlay and positioning
  traits; stories, theme stylesheet, docs page.

## Capabilities

### New Capabilities

- `popover`: the Popover component — parts, states, open/close behaviour,
  modality, focus, labelling, ARIA and `data-*` per part, contract and
  driver.
- `non-modal-tab-order`: the logical Tab order of portalled non-modal layer
  content relative to its trigger (enter, leave forward, leave backward, nested
  layers), shared by every non-modal anchored layer.

### Modified Capabilities

None. The capabilities used (`machine-runtime`, `component-contract`,
`test-drivers`, `model-based-testing`, `react-adapter`, `press-interactions`,
`interaction-modality`, `keyboard-interactions`, `element-ids`, `i18n-messages`,
`layer-stack`, `dismissable-layer`, `focus-containment`, `outside-inert`,
`scroll-lock`, `presence`, `portal`, `overlay-testing`, `floating-positioning`)
belong to unarchived changes and are used as specified there.

## Non-goals

- Opening on hover (Base UI `openOnHover`) — that is Hover Card (`add-hover-card`).
- Multiple triggers or detached triggers sharing one popover (Zag
  `triggerValue`, Base UI `handle`); additive later with Dialog's multi-trigger
  work.
- A `Backdrop` part and a `modal: "trap-focus"` middle mode (Base UI) — no
  consumer yet.
- Closing on scroll (React Aria `useCloseOnScroll`): the popover stays attached
  through positioning (research: RA#9467).
- Native `popover` attribute, `commandfor`, top-layer promotion (avoided in
  native-platform.md).
- Treating interaction inside a same-origin iframe as outside (Base UI #5410) —
  a dismiss-layer decision for `add-overlay-infrastructure`.
- Toggletip and Tooltip behaviour (`add-tooltip`).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/popover/{popover.machine,popover.connect,popover.contract}.ts`,
  `packages/core/src/dom/non-modal-tab-order.ts`, `packages/react/src/popover/*`,
  driver export in `@rind-ui/testing`, `packages/theme/src/popover.css`,
  stories under `apps/storybook`, a docs page.
- Uses `@floating-ui/dom` only through the positioning capability; no new
  runtime dependency.
- `docs/components.md`: Popover status → `spec`.
