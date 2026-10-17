## Why

A Tour is the one overlay whose purpose is to let the user keep using the page behind
it: it points at a real element, dims the rest, and walks on step by step. Only Ark UI
ships a headless one, and Reado (which will migrate) has built two tours on it, an
onboarding tour and a project tour that opens files and scrolls an editor, and replaced
its backdrop, its target tracking and its positioning workarounds along the way. The
bug history across Ark/Zag, Shepherd, Driver.js, Joyride and Intro.js is dominated by
what the overlay infrastructure and floating positioning already solve (focus, inert,
tracking, first frame) plus four things specific to tours: **targets that are late, hidden,
replaced or lost**, **spotlight geometry** (overlapping holes, scrolling, resize), **focus
stolen from the page** and **modality chosen once for every step**. Specifying it now gives
Reado a tested replacement and the future AI onboarding primitives a base.

Research: [docs/research/tour.md](../../../docs/research/tour.md) (sources, bug history,
accessibility, decisions) · cross-cutting
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md).

**Depends on** `add-foundations` and `add-a11y-foundations` (archived: machine runtime,
contracts, drivers, press, modality, ids, messages), `add-overlay-infrastructure`,
`add-floating-positioning`, `add-dialog` and `add-heading` (archived: layer stack, dismiss,
focus containment and restore, outside inert, scroll lock, presence, portal, Title Heading
Level) and **`add-popover`** (unarchived: the `non-modal-tab-order` capability, reused with
the target as its trigger). This change specifies only tour behaviour on top of them; its
asks of other changes are listed in design.md under "Requests to other changes".

## What Changes

- A `tour` component in `@rind-ui/core` (machine, connect, contract) and `@rind-ui/react`
  (`useTour` and parts): `Root`, `Trigger`, `Backdrop`, `Spotlight`, `Positioner`,
  `Content`, `Arrow`, `Title`, `Description`, `ProgressText`, `Actions`, `ActionTrigger`,
  `CloseTrigger` (plus the shared `Portal`).
- Steps are data: anchored (target getter, positioned beside it, spotlighted), centred
  dialog steps, and `wait` steps that show nothing and are advanced by their effect. Back
  skips wait steps; Next on the last step completes; Next/Back are ignored while a step
  is being prepared.
- **Preparing a step**: wait (MutationObserver, timeout) for a target that is connected
  and rendered; async step effects with `show` / `update` / `next` / `goto` / `dismiss`,
  an `AbortSignal` and guaranteed cleanup on every exit path; a declared missing-target
  policy (`skip` | `stop` | `center`); the backdrop stays up between steps.
- **Spotlight and backdrop** from a pure cutout function: padded rounded target hole,
  optional second hole around the card, overlapping holes merged, clamped to the viewport,
  tracked with the card (no polling loop), never blocking scroll or touch; the target stays
  usable (optional pointer shield, never `inert`).
- **Per-step modality**: a centred step is a real modal dialog through the overlay
  infrastructure; an anchored step is a non-modal `role="dialog"` that follows its target
  in the Tab order; either can be forced.
- **Focus**: starts on the card, returns to the opener, is never stolen from the page on
  later steps, recovers when the focused action disappears; step changes that do not move
  focus are announced politely.
- Escape, arrow keys (RTL-aware, scoped to the card), outside press and outside focus
  (both off by default), each vetoable, with typed reasons on `onOpenChange`; controllable
  `open` and `stepId`.
- `scrollIntoView` honouring the author's `scroll-margin` / `scroll-padding`.
- Contract (`tourContract`), driver and model-based coverage; site examples, theme
  stylesheet, docs page with a migration table from Ark's Tour.

## Capabilities

### New Capabilities

- `tour`: the Tour component — steps, preparation, effects, wait steps, spotlight and
  backdrop, target interaction, positioning, per-step modality, dismissal, focus, keyboard,
  ARIA, announcements, actions, progress, data attributes, contract and driver.

### Modified Capabilities

None. The capabilities used (`machine-runtime`, `component-contract`, `test-drivers`,
`model-based-testing`, `react-adapter`, `press-interactions`, `interaction-modality`,
`keyboard-interactions`, `element-ids`, `i18n-messages`, `announcer`, `layer-stack`,
`dismissable-layer`, `focus-containment`, `outside-inert`, `scroll-lock`, `presence`,
`portal`, `overlay-testing`, `floating-positioning`, `hidden-content`, `heading`) are
archived and used as specified; `non-modal-tab-order` belongs to the unarchived
`add-popover` and is used as specified there, with one extension requested in design.md.

## Non-goals

- Hints, beacons and coachmarks that sit on the page without a flow (Driver `hints`,
  Intro.js `hint`, Joyride beacon): a different component.
- Highlighting several elements in one step (Shepherd `extraHighlights`, Joyride #487)
  and highlighting inside a same-origin iframe: additive later; no consumer yet.
- Persisting progress or "don't show again" (Intro.js cookie): the app owns it through
  `onStepChange` and `defaultStepId`; Reado already does.
- Multi-page / route tours; a recorder or authoring UI.
- Native `<dialog>.showModal()`, the `popover` attribute and `commandfor`
  (avoided in native-platform.md); CSS anchor positioning as the positioning mechanism.
- Making the target `inert` (Zag `preventInteraction`): the pointer shield keeps the
  target in the accessibility tree.
- `alertdialog` semantics and an `aria-live` card (Zag, Joyride).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/tour/{tour.machine,tour.connect,tour.contract}.ts`,
  `packages/core/src/components/tour/{spotlight-path,target}.ts` (pure cutout function; target
  readiness and waiting), `packages/core/src/dom/{wait-for-element,step-effect}.ts`,
  `packages/react/src/tour/*`, driver export in `@rind-ui/testing`,
  `packages/theme/src/tour.css`, site examples under `apps/site`, a docs page.
- Uses `@floating-ui/dom` only through the positioning capability; no new runtime
  dependency.
- `docs/components.md`: Tour status → `spec`.
