## Context

See proposal.md for why. The component-level research and its bug history are in
[docs/research/popover.md](../../../docs/research/popover.md); its Decisions
section is binding unless this document says otherwise. Everything below the
component is already specified:

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, controllable `open` with proposals, `$sync`, `$reverted`, `ChangeDetails.cancel()`; state-scoped effects; `contract()` with per-modality actions and postconditions; drivers; `testMachine` with `layer`/`restores-focus` traits |
| `add-a11y-foundations` | press events (`PRESS` with `modality`) on Trigger and CloseTrigger; `focusSafely`; `data-focus`/`data-focus-visible`; `partId()`; `messages`; logical keys and `notComposing` |
| `add-overlay-infrastructure` | `overlayEffect(env, options)` (layer push, dismiss, initial focus, cleanup order release → un-inert → restore), stack-driven inert/scroll-lock/Tab-wrap singletons for modal layers, `DismissRequest`, presence machine, `Portal`, `LayerProvider`, `modal`/`presence` traits, DOM-clean invariant |
| `add-floating-positioning` | `env.position.track()`, `POSITION.PLACED { first }`, `popup` preset, `positionerProps`/`arrowProps`/`anchorProps`, `setPlacement`, `positioningQueries`, `anchored` trait, `fakePositioning()` |

## Goals / Non-Goals

**Goals:**
- A two-state machine whose effects are all injected infrastructure; the
  component adds only toggling, reasons, labelling, the modality switch and the
  non-modal Tab order.
- `non-modal-tab-order` as a small `core/dom` module with its own browser tests,
  ready for Hover Card.

**Non-Goals:**
- Hover opening, multiple triggers, backdrop (proposal Non-goals).

## Decisions

### 1. Machine: two states, effects selected by props

```ts
type PopoverCloseReason =
  | "trigger" | "close-trigger" | "escape-key" | "outside-press" | "outside-focus"
  | "parent-dismissed" | "api"

type PopoverEvent =
  | { type: "TRIGGER.PRESS"; modality: Modality }              // from press-interactions
  | { type: "OPEN"; modality: Modality }                       // api
  | { type: "CLOSE"; reason: PopoverCloseReason }              // dismiss requests, close trigger, api
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean }
  | { type: "POSITION.REPOSITION" }
  | { type: "PARTS.CHANGED"; title: boolean; description: boolean; closeTrigger: boolean }

popoverMachine = setup({ guards: { isModal, isDisabled, isFirstPlacement }, … }).machine({
  initial: "closed",
  values: { open: { closed: false, open: true } },             // controllable
  states: {
    closed: {
      on: {
        "TRIGGER.PRESS": { guard: { not: "isDisabled" }, target: "open", actions: ["recordOpenModality"] },
        OPEN: { guard: { not: "isDisabled" }, target: "open", actions: ["recordOpenModality"] },
      },
    },
    open: {
      effects: ["overlay", "trackPosition", "nonModalTabOrder", "warnModalWithoutClose"],
      on: {
        "TRIGGER.PRESS": { target: "closed", actions: ["setCloseReasonTrigger"] },
        CLOSE: { target: "closed", actions: ["setCloseReason"] },
        "POSITION.PLACED": [
          { guard: "isFirstPlacement", actions: ["setPlacement", "focusInitial"] },
          { actions: ["setPlacement"] },
        ],
        "POSITION.REPOSITION": { actions: ["reposition"] },
        "PARTS.CHANGED": { actions: ["setRenderedParts"] },
      },
    },
  },
  onProps: { disabled: { guard: "isDisabled", event: { type: "CLOSE", reason: "api" } } },
})
```

- The controllable runtime turns `closed → open` into an `onOpenChange(true,
  { reason: "trigger" })` proposal and `open → closed` into
  `onOpenChange(false, { reason })`; the reason is the close reason recorded by
  the transition's action, so `ChangeDetails.reason` (the event type per the
  runtime) is overridden by the component's typed reason. *Alternative:* map event
  types to reasons in connect — rejected, the reason must exist when the proposal
  is made.
- `overlay` calls `overlayEffect` with `kind: "popover"`, `modal: props.modal`,
  `parent` from the layer context, `opener: trigger`, `elements: [positioner,
  content]`, `isInside: trigger | anchor | persistentElements`, `initialFocus:
  () => false` (the machine focuses on first placement, below), and maps each
  `DismissRequest` to `CLOSE { reason }` after the consumer callbacks had their
  chance to veto. Modal vs non-modal is one boolean passed to the stack — no code
  fork: inert, scroll lock and Tab wrap follow from `topmostModal()`.
- `nonModalTabOrder` is a no-op effect when `modal` is true (the effect reads the
  prop; the graph stays the same for both modes, so model tests share paths).
- **Focus waits for placement**: `focusInitial` runs on the first
  `POSITION.PLACED` (floating-positioning design §2) through
  `focusInitial(env, content, pick, openModality)` from focus containment.
- `PARTS.CHANGED` comes from the parts' mount/unmount (adapter) and is re-checked
  on every entry to `open` (ark#4182).
- The restore target is the trigger by default; `finalFocus(reason)` overrides.
  Restore itself is done by `overlayEffect` cleanup, so every exit from `open`
  (controlled `$sync`, `stop()`) restores — the zag#1746/#1747/#1788 class.

### 2. `non-modal-tab-order` module

```ts
// core/dom/non-modal-tab-order.ts
export interface NonModalTabOrderOptions {
  readonly trigger: () => HTMLElement | null
  readonly content: () => HTMLElement | null
  readonly layer: LayerHandle            // to skip descendant layers' content
}
export function trackNonModalTabOrder(env: Environment, o: NonModalTabOrderOptions): () => void
```

- Two `keydown` listeners (trigger, content), bubble phase, ignoring
  `defaultPrevented`, modifier combos other than Shift, and composing events.
- "Next after the trigger" uses the sequential-order helper from focus
  containment (task 3.1 of `add-overlay-infrastructure`) over the trigger's root
  (document or shadow root), excluding nodes inside `layer.contains()`.
- Moves focus with `focusSafely` (keyboard modality preserved), then the
  existing outside-focus dismissal closes the layer — no special close path.
- *Alternatives:* sentinel spans (Radix/Base UI/Headless UI — axe and VoiceOver
  problems, AT note cause F, BU#5715); Ariakit's `preserveTabOrder` (uses
  focus-trap elements); rendering the content inline after the trigger (breaks
  positioning in overflow containers and contradicts "portalling is optional,
  behaviour identical").

### 3. Labelling

Connect computes `aria-labelledby`: Title id if rendered → consumer value →
(non-modal) trigger id. Description id appended to consumer `aria-describedby`.
Modal with no name source → `env.logger.error` once per open (development
build only), and the generic invariant fails in tests. *Alternative:* copy the
trigger's text into `aria-label` for modal (AT note cause E) — rejected: duplicates
the source of truth, and modal popovers should have a heading.

### 4. Parts and attributes

Connect owns every attribute listed in the spec's Data Attributes and ARIA
requirements; positioner and arrow props come from `positionerProps` /
`arrowProps`; layer metadata (`data-nested`, `--layer-index`, …) from the layer
handle's `meta()` (overlay infra design §2). The `Trigger` gets `anchorProps`
(`anchor-name`) unless an `Anchor` part is rendered, which then gets them.
`Title` renders `h{level}` (`level` prop ?? 2) with add-heading's `headingProps`;
`Content` wraps its children in a `Heading.Level` at the title's level + 1 (from
add-heading).

`popover` connect takes an optional `scope` (default `"popover"`) used for `data-scope` on every part prop, so composites
(Date Picker, Date Range Picker) render the Popover's props under their own scope (requested by add-date-picker). The `open`
controllable is documented as parent-coordinator friendly: a composite may own `open` and receive each request through
`onOpenChange`; nothing in the machine assumes the popover is the only writer.

### 5. Contract

```ts
export const popoverContract = contract("popover", {
  anatomy: ["trigger", "anchor", "indicator", "positioner", "content", "arrow", "title", "description", "close-trigger"],
  locate: { part: "trigger", role: "button", name: true },     // getPopover(screen, { name })
  actions: {
    open:  { pointer: ({ part }) => part("trigger").click(), keyboard: ({ part, keyboard }) => part("trigger").focus().then(() => keyboard.press("Enter")), done: q => q.isOpen() && q.isPlaced() },
    close: { pointer: …, keyboard: …, done: q => !q.isOpen() },
    closeWithButton, toggle, pressEscape, pressOutside, tab, shiftTab, reposition, waitForUnmount,
  },
  queries: { isOpen, isModal, title, description, hasFocus, isTopmost, closeReason, ...positioningQueries },
  states: { closed: { isOpen: false }, open: { isOpen: true } },
  events: {
    "TRIGGER.PRESS": "toggle", CLOSE: "pressEscape", OPEN: { skip: "api only; covered by $sync" },
    "POSITION.PLACED": { skip: "emitted by positioning" }, "POSITION.REPOSITION": "reposition",
    "PARTS.CHANGED": { skip: "mount bookkeeping" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: ({ props }) => ["layer", "restores-focus", "presence", "anchored", ...(props.modal ? ["modal"] as const : [])],
})
```

The keyboard implementation of `open` focuses the trigger through the adapter's
key input (Tab from the preceding element) where the environment supports it, so
the press carries `keyboard` modality.

### 6. Shared modules used

`core/dom`: `overlay`, `layer-stack`, `dismiss`, `focus-scope`, `focus-restore`,
`inert-outside` and `scroll-lock` (via the stack, modal only), `presence`,
`portal`, `position`, `press`, `modality`, `focus-safely`, `keyboard`, and the new
`non-modal-tab-order`. No `core/collection` module.

## Risks / Trade-offs

- [iOS VoiceOver swipes in DOM order, so portalled content is reached at the end of
  the page (AT note Q2)] → tier-1 manual check; mitigation if needed is a portal
  target next to the trigger, no spec change.
- [Tab interception fights an app that also handles Tab on the trigger] → we skip
  `defaultPrevented` events; documented.
- [Name fallback to the trigger can be vague ("Open")] → docs recommend a Title;
  the trigger's name is still better than an unnamed dialog.
- [Positioning before focus delays focus by a frame] → accepted (floating
  positioning design).

## Migration Plan

New component; Reado migrates from Ark's Popover (`modal`, `closeOnInteractOutside`,
`closeOnEscape`, `initialFocusEl`, `finalFocusEl`, `positioning` map one to one;
`autoFocus: false` becomes `initialFocus={() => false}`).
