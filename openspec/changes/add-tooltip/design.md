## Context

See proposal.md for why and
[docs/research/tooltip.md](../../../docs/research/tooltip.md) for the sources,
bug history and decisions (binding unless this document says otherwise). What
this change builds on:

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, controllable `open`, delayed transitions (`after`) on the injected scheduler, state- and service-scoped effects, contracts, drivers, `testMachine` |
| `add-a11y-foundations` | `HOVER.START/END` (mouse/pen only, iOS emulated-mouse quirk), `PRESS.START`, modality tracker (incl. window-refocus detection), `focusSafely`, `data-focus-visible`, `partId()`, `messages`, `notComposing`, a11y invariants (`no-touch-hover`, `focus-does-not-commit`) |
| `add-overlay-infrastructure` | layer stack (`kind: "tooltip"`, parent from layer context), dismiss (Escape, outside press), presence, `Portal`, `layer` trait |
| `add-floating-positioning` | `env.position.track()` with the `popup` preset and `side: "top"`, connect helpers, `positioningQueries`, `anchored` trait, `fakePositioning()` |

## Goals / Non-Goals

**Goals:**
- One four-state machine; delays are declared `after` transitions so the graph
  shows them and model tests drive them with fake time.
- `hover-intent` and `delay-group` as small `core/dom` modules behind injected
  capabilities, usable by Hover Card and later submenus without change.

**Non-Goals:**
- Provider/Group parts, cursor following, multi-trigger (proposal Non-goals).

## Decisions

### 1. Machine

```
            HOVER.START [groupWarm] / FOCUS [keyboardIntent] / OPEN
   closed ─────────────────────────────────────────────────────────► open
     │  ▲                                                             │ ▲
     │  └──── HOVER.END / PRESS.START / CLOSE ── opening ─after openDelay┘ │
     └──── HOVER.START [not suppressed, not in transit elsewhere] ──►┘     │
   open ── HOVER.END [not keyboardFocused] ──► closing ── after closeDelay ──► closed (pointer-leave)
   closing ── HOVER.START / FOCUS [keyboardIntent] ──► open
   open|closing ── BLUR [not pointerInZone] ──► closed (blur)
   open|closing ── PRESS.START [closeOnPress] ──► closed (trigger-press, suppressHover)
   opening|open|closing ── CLOSE {escape-key|outside-press|group|disabled|api} ──► closed
```

```ts
type TooltipEvent =
  | { type: "HOVER.START"; modality: "pointer" }
  | { type: "HOVER.END" }
  | { type: "FOCUS"; modality: Modality; cause: "key" | "layer" | "window" | "other" }
  | { type: "BLUR" }
  | { type: "PRESS.START"; modality: Modality }
  | { type: "OPEN" }
  | { type: "CLOSE"; reason: "escape-key" | "outside-press" | "group" | "disabled" | "api" }
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean }
```

- Context: `openedBy` (`hover | focus | api`), `keyboardFocused`,
  `pointerInZone`, `suppressHover` (set by a trigger press, cleared by the next
  `HOVER.END` from the trigger), `instant`.
- Guards: `keyboardIntent` = `modality === "keyboard" && cause === "key"`;
  `groupWarm` (asks the delay group); `suppressed`; `closeOnPress`;
  `notDisabled`.
- Delays: `openDelay` (700), `closeDelay` (300), read from props when the state
  is entered.
- Effects: `delayGroupMembership` (service-scoped: join on start, leave on stop —
  zag#3390), `layer` and `hoverIntent` and `trackPosition` in `open` and
  `closing`. `closed` and `opening` have no document-level effect (performance
  requirement); `opening` uses only the `after` timer and trigger handlers.
- Entry of `open`: `group.opened(self)`; exit of `open|closing` to `closed`:
  `group.closed(self, skipDelay)`.
- `disabled` prop change → `CLOSE { reason: "disabled" }` through `onProps`.

### 2. Knowing why focus arrived (`cause`)

Tooltip (and Hover Card) must tell a Tab from a layer's initial focus or focus
restore, and from the window regaining focus — all of which can carry `keyboard`
modality.

- The focus cause comes from `add-a11y-foundations` (`interaction-modality` →
  "Focus Cause"): rind-ui's safe focus operation records `layer` / `navigation` /
  `programmatic`, and the overlay's initial focus and restore pass `layer`
  (`focus-containment`). Tooltip only reads `FOCUS.cause`; it adds no focus-cause
  code of its own.
- The modality tracker already classifies window refocus; connect asks it
  (`env.modality.isWindowRefocus(event)`) and reports `cause: "window"`.
- Connect builds `FOCUS { modality, cause }` from those; `other` covers
  programmatic focus by the app (also not opening unless modality is keyboard and
  a key caused it).

*Alternatives:* React Aria's `react-aria-focus-scope-restore` DOM event (works,
but couples components through DOM events — the Reka #2868 lesson); checking
`:focus-visible` (snelsi's RX#2248 workaround — programmatic focus after a key
still matches it).

### 3. `hover-intent` module

**Stable API.** Menu (submenus), Hover Card and later Navigation Menu consume this
capability; the interface below is the contract between them. Changes are additive
only (new optional fields); the per-document singleton key is versioned
(`@1`). Consumers depend on: `track()` options, `onLeave`/`onEnter` semantics
("zone left" / "zone re-entered", never sent while an open descendant layer
exists), `isInTransit(doc)`, and the trigger-handler rule (movement-based
`HOVER.START`, `pointerleave` → `HOVER.END`) exported as `hoverIntent.triggerProps()`.
Delays live in each consumer's machine as `after` transitions, not in the module.

```ts
// core/env/hover-intent.ts
export interface HoverIntentCapability {
  readonly hoverIntent: {
    /** While open: tracks the zone and reports leave / re-enter. */
    track(options: {
      readonly trigger: () => Element | null
      readonly elements: () => readonly Element[]     // positioner, content, arrow
      readonly layer: LayerHandle                     // descendants count as inside; open child blocks leave
      readonly onLeave: () => void                    // machine: HOVER.END
      readonly onEnter: () => void                    // machine: HOVER.START
    }): () => void
    /** Read by trigger handlers while closed. */
    isInTransit(doc: Document): boolean
    /** Trigger handlers for connect: movement-based HOVER.START, pointerleave → HOVER.END, mouse/pen only. */
    triggerProps(send: (e: { type: "HOVER.START" | "HOVER.END" }) => void): HoverTriggerProps
  }
}
```

- Per-document singleton (`Symbol.for("rind-ui.hover-intent@1")`) holding the
  active grace polygon, so `isInTransit` works across instances and copies.
- Trigger handlers (connect): `pointermove` with `pointerType` mouse/pen and real
  movement (coordinates changed since the last event on that element) sends
  `HOVER.START` unless `isInTransit`; `pointerleave` sends `HOVER.END`. Synthetic
  boundary events after scroll carry no movement and are ignored (ariakit#1662).
- `track()` (open/closing only): `pointermove`/`pointerover` on the document
  (capture, passive), last pointer position kept; on trigger or content
  `pointerleave` builds the grace polygon from the exit point (padding 4 px each
  side) and the target rect — Radix's hull algorithm, chosen over React Aria's
  hull-of-both-rects because it stays narrow for wide content (reka-ui#2203) and
  for submenus later; scroll (capture) and `visualViewport`/window resize
  re-evaluate with the last position; `pointerleave` on `documentElement` and
  window `blur` → leave; containment via `event.composedPath()` and
  `layer.contains()`; while `layer.meta().hasNested` (an open descendant), leave
  is not reported.
- *Alternatives:* Base UI's velocity-based safe polygon (better for menus with
  many items, more tuning; revisit with submenus — it only changes the polygon
  test); Ariakit's `disablePointerEventsOnApproach` (mutates styles of page
  elements, rejected like body `pointer-events`).

### 4. `delay-group` module

```ts
// core/env/delay-group.ts
export interface DelayGroupMember { replace(): void }          // machine: CLOSE { reason: "group" }
export interface DelayGroupCapability {
  readonly delayGroup: {
    join(member: DelayGroupMember): {
      isWarm(): boolean
      opened(): void                                           // closes the other open member (instant)
      closed(skipDelay: number): void                          // starts the warm window
      leave(): void                                            // = closed(skipDelay) if open
    }
  }
}
```

- Stored per document under `Symbol.for("rind-ui.delay-group@1")`; plain object,
  no DOM events (reka-ui#2868); timers through the injected scheduler; a new
  `closed()` replaces a pending window; `skipDelay <= 0` → cold at once
  (radix#3873); the window is independent of close delays (react-spectrum#9517).
- `instant` is computed in the machine from `isWarm()` at open time and from a
  `replace()`, and exposed as `data-instant`.

### 5. Always-mounted content

The React `Content` part always renders (inside `Positioner`, inside the
optional `Portal`); presence runs in `keepMounted` mode, so after the exit
animation the positioner and content get `hidden`. Connect adds the content id to
the trigger's `aria-describedby` / `aria-labelledby` only once the content
reports mounted (portal mounts after hydration), so SSR markup never dangles.
Positioning, layer and hover tracking run only in `open|closing`, so a closed
tooltip costs one hidden element and the trigger handlers.

*Alternative:* render a separate hidden description node next to the trigger and
mount the visual popup only when open (two copies of the text — radix#3689's
"content mounted twice" complaint, and label/description could diverge).

### 6. Development warnings

Run once per mount in development builds through the injected logger: native
`disabled` or non-focusable trigger; tabbable descendants in content; trigger
name equal to the description (computed with the core accname subset);
`type: "label"` with a consumer `aria-label`.

### 7. Contract

```ts
export const tooltipContract = contract("tooltip", {
  anatomy: ["trigger", "positioner", "content", "arrow"],
  locate: { part: "trigger", role: true, name: true },        // getTooltip(screen, { name: "Bold" })
  actions: {
    show: { pointer: ({ part, time }) => part("trigger").hover().then(() => time.advance("openDelay")),
            keyboard: ({ part }) => part("trigger").focusWithTab(),
            touch: { none: "tooltips never open on touch (covered by the no-touch-hover invariant)" },
            done: q => q.isOpen() },
    hide: { pointer: …unhover + advance closeDelay, keyboard: ({ keyboard }) => keyboard.press("Escape"), done: q => !q.isOpen() },
    hoverContent, pressTrigger, pressEscape,
  },
  queries: { isOpen, text, description, label, isInstant, ...positioningQueries },
  states: { closed: { isOpen: false }, opening: { isOpen: false }, open: { isOpen: true }, closing: { isOpen: true } },
  events: {
    "HOVER.START": "show", "HOVER.END": "hide", FOCUS: "show", BLUR: { skip: "covered by show/hide keyboard twins (Tab away)" },
    "PRESS.START": "pressTrigger", OPEN: { skip: "api only" }, CLOSE: "pressEscape",
    "POSITION.PLACED": { skip: "emitted by positioning, not a user step" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: ["layer", "anchored", "timed"],
  invariants: [closedContentHiddenAndReferenced, contentNeverFocused],
})
```

- `timed`: the tooltip has no auto-hide timer, but its close delay is a timer
  that must not elapse while the trigger or content is hovered or the trigger has
  keyboard focus (WCAG 1.4.13 persistent). Tooltip is the first timed component,
  so this change implements the `timed` invariant in `@rind-ui/testing`
  (deferred from `add-foundations`): it advances the scheduler past every pending
  delay while the oracle says "hovered or focused" (and while
  `document.hidden`), and fails if a hide transition fires. Toast reuses it.

`focusWithTab` (focus the preceding tabbable, press Tab) is added to the
environment's part handle in both adapters by this change, because the keyboard
twin of hovering is "Tab onto it", which must carry `keyboard` modality and
`cause: "key"`.

### 8. Shared modules used

`core/dom`: `hover` and `press` (a11y foundations), `modality`, `focus-safely`,
`layer-stack`, `dismiss`, `presence`, `portal`, `position`, and the new
`hover-intent`, `delay-group` (focus cause comes from add-a11y-foundations). No `core/collection` module.

## Risks / Trade-offs

- [Always-mounted content adds one hidden node per tooltip] → measured in the
  200-tooltip perf test; no listeners or observers while closed.
- [Tagging layer focus moves touches overlay modules] → a one-line call in two
  places, covered by tests in this change; the overlay specs are unchanged.
- [Escape closes a hover-opened tooltip before a dialog (two presses)] → required
  by WCAG 1.4.13 dismissible; documented.
- [Grace polygon from the exit point can be tight for tiny triggers] → 4 px exit
  padding plus the 300 ms close delay; tunable later without spec change.
- [`hidden` description targets and VoiceOver] → accname says they count; tier-1
  manual check.

## Migration Plan

Reado's Ark tooltips: `openDelay`/`closeDelay` map directly (pass 400/150 to
keep today's feel), `interactive` disappears (always hoverable), `closeOnClick` →
`closeOnPress`, `positioning` maps to `positioning`.
