## Context

See proposal.md for motivation and specs/dialog/spec.md for behaviour. The research,
including the Bug history the scenarios cite, is in
[dialog.md](../../../docs/research/dialog.md). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` `machine-runtime` | `setup()`/`machine()`, `controllable()` for `open` (proposals, `$sync`, `$reverted`, `ChangeDetails.cancel()`), state-scoped effects, `start`/`stop` |
| `add-foundations` `component-contract`, `test-drivers`, `model-based-testing`, `react-adapter` | contract, `getDialog`, `testMachine`, `useMachine`, `mergeProps`, `render`, ids, `data-instance` |
| `add-a11y-foundations` | `core/dom/press` (trigger and close-trigger activation, `virtual` modality), `focusSafely`, `data-focus(-visible)`, `messages` + `RindProvider`, `partId`, dev logger, the a11y invariants |
| `add-overlay-infrastructure` | `overlayEffect` (layer push, dismiss, initial focus, restore), the stack-driven inert / scroll lock / Tab containment singletons, `presence` machine + `usePresence`, `Portal`, `LayerProvider`, traits `modal` and `presence` |

## Goals / Non-Goals

**Goals:**
- A two-state machine whose only DOM-touching effect is the overlay effect.
- Every Bug-history entry the spec cites has a test that reproduces it first.
- Reado's `Modal.tsx` and `Drawer.tsx` port by renaming imports.

**Non-Goals:**
- Hierarchical states; a `pending` state for async actions (Alert Dialog uses the
  existing proposal/cancel path); drawer gestures.

## Decisions

### 1. Machine

```
            TRIGGER_PRESS / OPEN / $sync(true)
  closed ──────────────────────────────────────► open
    ▲                                              │
    └──── TRIGGER_PRESS (non-modal) / CLOSE_TRIGGER_PRESS / ESCAPE_KEY /
          OUTSIDE_PRESS / OUTSIDE_FOCUS / PARENT_DISMISSED / CLOSE / $sync(false)
```

```ts
type DialogEvent =
  | { type: "TRIGGER_PRESS"; trigger: TriggerId; modality: Modality }
  | { type: "CLOSE_TRIGGER_PRESS"; modality: Modality }
  | { type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED"; request: DismissRequest }
  | { type: "OPEN" } | { type: "CLOSE" }                       // api.open() / api.close()
  | { type: "PARTS.MOUNT" | "PARTS.UNMOUNT"; part: "title" | "description"; id: string }

dialogMachine = setup({ guards, actions, effects }).machine({
  initial: "closed",
  values: { open: controllable({ states: { true: "open", false: "closed" } }) },
  states: {
    closed: { on: { TRIGGER_PRESS: { target: "open", actions: "setOpener" }, OPEN: { target: "open", actions: "clearOpener" } } },
    open: {
      effects: ["overlay", "nameCheck"],
      on: {
        TRIGGER_PRESS: { guard: "isNonModal", target: "closed", actions: "setCloseReason" },
        CLOSE_TRIGGER_PRESS: { target: "closed", actions: "setCloseReason" },
        ESCAPE_KEY: { target: "closed", actions: "setCloseReason" },
        OUTSIDE_PRESS: { target: "closed", actions: "setCloseReason" },
        OUTSIDE_FOCUS: { target: "closed", actions: "setCloseReason" },
        PARENT_DISMISSED: { target: "closed", actions: "setCloseReason" },
        CLOSE: { target: "closed", actions: "setCloseReason" },
      },
    },
  },
  on: { "PARTS.MOUNT": { actions: "registerPart" }, "PARTS.UNMOUNT": { actions: "unregisterPart" } },
})
```

- `details.reason` is the event type (runtime rule); connect writes
  `data-close-reason` as its kebab-case form. One vocabulary, two spellings.
- Context: `opener: TriggerId | null` (null for `OPEN` and `$sync`, which makes
  restore fall back to the element focused before open — mui/base-ui#4169),
  `closeReason`, `rendered: { title?: string; description?: string }` (ids of
  mounted parts — the only source of `aria-labelledby`/`-describedby` and of the
  name check, so shadow roots work: radix#3484).
- A vetoed dismissal never reaches the machine: the overlay effect calls the
  consumer's `onEscapeKeyDown` / `onInteractOutside` and only sends the event if
  `request.canceled` is false. `onOpenChange`'s `cancel()` is the runtime's.
- Props read by guards/effects: `modal` (default `true`), `closeOnEscape` (`true`),
  `closeOnInteractOutside` (default `modal`), `initialFocus`, `finalFocus`,
  `keepMounted`. Modality switches the overlay options, not code paths
  (open/closed principle): `layer.modal = modal`, `dismiss.outsidePress =
  closeOnInteractOutside`, `dismiss.outsideFocus = false` (non-modal dialogs are
  worked alongside the page; light-dismiss surfaces are Popover's job).
- The definition comes from `buildDialogMachine({ kind, closeEvents, defaults, extend })`,
  where `extend` (requested by add-drawer) adds guarded close events, extra values and
  context, `open` entry actions, effects and handlers, root-level handlers (e.g.
  `$reverted`) and extra part names — all static data, so the graph stays complete;
  evaluated once at module load (still a static graph): `dialogMachine` is
  `kind: "dialog"`; `add-alert-dialog` builds `alertDialogMachine` from the same
  function with two extra close events and different prop defaults, so the two
  never drift apart (reka-ui#2702 broke only the copied AlertDialog).
- *Alternative*: one `CLOSE { reason }` event (dialog.md's first sketch) — rejected:
  the runtime puts the event type in `details.reason`, and per-cause events let the
  model graph enumerate causes without argument classes.

### 2. The overlay effect and dialog-only additions

`overlay` effect = `overlayEffect(env, { id, kind: "dialog", modal, parent, opener,
elements, dismiss, initialFocus, finalFocus, modality })`. Dialog-only logic it
wraps:

- **Parent** (spec: Parent Layer): the React `LayerProvider` exposes the chain of
  ancestor layers with their kinds; the dialog passes the nearest `dialog` /
  `alertdialog` id, skipping menu/popover/listbox/tooltip, so a dialog rendered in
  a menu item is a root layer (radix#1836, #3317).
- **Inside vs. dismiss surface**: `elements()` returns the content (and the
  positioner/backdrop for outside-hiding), while a press whose target *is* the
  backdrop or the positioner itself (not a descendant of the content) is reported
  as outside because Dialog registers backdrop and positioner as dismiss surfaces
  (`dismissable-layer` → "Dismiss Surfaces", add-overlay-infrastructure task 12.2).
- **initialFocus**: `"title"` / `"content"` resolve to the part element; for the
  title, connect adds `tabindex="-1"` while `initialFocusTarget === "title"`.
  React `autoFocus` is honoured by the overlay's "focus already moved" rule because
  React focuses during commit, before the effect starts (radix#1615,
  react-spectrum#8791). We recommend `data-autofocus` (preventScroll, after
  positioning: react-spectrum#4898).
- **nameCheck** effect: one frame after open, if `rendered.title` is unset and the
  content has neither `aria-label` nor `aria-labelledby`, log one dev warning via the
  injected logger. Never throws (radix#2986).

### 3. Connect

| Part | Attributes (beyond `data-scope`/`data-part`/`data-instance`) |
|---|---|
| trigger | `type=button`, `aria-haspopup=dialog`, `aria-expanded` (opener only), `aria-controls` while content mounted, `data-state`, press + focus attrs |
| backdrop | `aria-hidden=true`, `data-state`, layer meta; `hidden` (renders nothing in React) when non-modal |
| positioner | `data-state`, `data-modal`, layer meta; `style.pointerEvents = "none"` when non-modal |
| content | `role=dialog`, `id`, `tabindex=-1`, `aria-modal` (modal only), `aria-labelledby`/`aria-describedby` = consumer ids + rendered part ids, `data-state`, `data-modal`, `data-close-reason`, layer meta; `style.pointerEvents = "auto"` when non-modal |
| title / description | `id` (registers on mount/unmount) |
| close-trigger | `type=button`, `aria-label` = `messages.close` only when it renders no content, press + focus attrs |

Layer meta (`data-nested`, `data-has-nested`, `--layer-index`,
`--nested-layer-count`) comes from `layer.meta()` with the kind family
`{dialog, alertdialog}`.

**Submit-type closing parts** (spec: Forms Inside Dialogs): when the rendered element
is a submit button with a form owner, the press handler does not send on `click`;
it sends on that form's `submit` event (or after the click task when the submit is
invalid and prevented), so the form is still connected when it submits
(radix#1109, #1779).

### 4. React parts

`Dialog.Root` (provides the service and a `LayerProvider` scope), `Trigger`,
`Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `CloseTrigger`; generic
`Portal` from the overlay change. Each animated part uses `usePresence`; defaults
are lazy mount + unmount after exit (Reado passes `lazyMount unmountOnExit` today;
both are dropped in the port), `keepMounted` keeps parts mounted and `hidden`.
`Title` renders `h{level}` (`level` prop ?? 2) with attributes from add-heading's
`headingProps`; `Content` wraps its children in `Heading.Level` at the title's
level + 1 (from add-heading). `Root` also accepts a `ref`-style `api` (`open()`, `close()`) for programmatic use.

### 5. Contract and driver

```ts
export const dialogContract = contract(dialogMachine, {
  scope: "dialog",
  anatomy: ["trigger", "backdrop", "positioner", "content", "title", "description", "close-trigger"],
  locate: { role: "dialog", name: true },
  traits: ({ props }) => ["layer", "restores-focus", "presence", ...(props.modal === false ? [] : ["modal"] as const)],
  actions: {
    open: { pointer: …click trigger, touch: …tap trigger, keyboard: …focus trigger + Enter, done: isOpen && hasFocus },
    close: { pointer: …, keyboard: …, done: !isOpen },
    pressEscape, pressOutside, tab, shiftTab, waitForUnmount,
  },
  queries: { isOpen, isModal, title, description, hasFocus, isTopmost, closeReason },
  events: { TRIGGER_PRESS: "open", CLOSE_TRIGGER_PRESS: "close", ESCAPE_KEY: "pressEscape", OUTSIDE_PRESS: "pressOutside" },
})
```

`getDialog(target, { name })` is generated. The model run uses props sets
`{ modal: true }`, `{ modal: false }`, `{ closeOnEscape: false }`,
`{ closeOnInteractOutside: false }`.

### 6. Resolved open questions (dialog.md)

| Question | Decision | Why |
|---|---|---|
| Native `<dialog>` | No (JS layer) | native-platform.md Recommendation |
| Keep `aria-modal` | Yes, modal only; modality from `inert` | overlay design; WebKit iframe bug left to a quirk if seen |
| Initial focus default | Overlay default (first tabbable; content on touch); `initialFocus="title"` for long content | APG; Base UI touch rule |
| Non-modal outside press / focus | Neither closes by default | Non-modal dialogs are worked alongside the page (zag#2957, ark#3892); Popover is the light-dismiss surface |
| Positioner required for scrolling? | No; optional scroll container, `overscroll-behavior: contain` applies to it | radix#2798 |
| iOS VO refocus hack | Not in v1; manual device check | overlay decision; BU#5296 shows blur/refocus side effects |

## Risks / Trade-offs

- [Backdrop presses must dismiss although the backdrop belongs to the layer] →
  resolved in add-overlay-infrastructure: dismiss surfaces (task 12.2).
- [Dialog and Alert Dialog must stack together] → resolved in
  add-overlay-infrastructure: stacking family `dialog` (task 12.1).
- [Skipping non-dialog ancestors as parents means a popover beneath a dialog it
  opened closes on outside focus] → expected; documented with zag#2933's setup.
- [Deferring submit-type closes to `submit`] → a submit that never fires (invalid
  form with native validation) leaves the dialog open, which is what users want.
- [VoiceOver + Chrome does not speak the title on open (radix#3348, open)] → manual
  tier-1 check; no workaround until reproduced.

## Migration Plan

New API. Reado: replace `@ark-ui/react/dialog` imports with `@rind-ui/react`, drop
`lazyMount`/`unmountOnExit`, change `onOpenChange={(d) => …(d.open)}` to
`onOpenChange={(open) => …}`.
