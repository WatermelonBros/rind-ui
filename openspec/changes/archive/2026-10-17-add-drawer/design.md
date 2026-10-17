## Context

See proposal.md for motivation, specs/drawer and specs/swipe-gesture for behaviour,
[drawer.md](../../../docs/research/drawer.md) for the research and the Bug history the
scenarios cite. Everything not listed here is the Dialog's design
(`add-dialog/design.md`): overlay effect, parentage, submit-type close parts, connect
rules, React presence, contract shape. This change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`open`, new `snapPoint`), `$sync`/`$reverted`, `ChangeDetails.cancel()`, state effects, contracts, drivers, `testMachine`, `useMachine` |
| `add-a11y-foundations` | `press` (trigger, close trigger, handle; `virtual` modality), `focusSafely`, `data-focus(-visible)`, `messages`, `partId`, `LocaleSource.dir()` for logical sides, `PlatformInfo`, `MotionPreference`, dev logger, a11y invariants |
| `add-overlay-infrastructure` | `overlayEffect`, layer stack (`kind: "drawer"`, family `drawer`, `meta()`), stack-driven inert / scroll lock / Tab containment, `overscroll-behavior: contain` on layer elements, presence + `usePresence`, `Portal`, traits `modal`, `presence` |
| `add-dialog` | `buildDialogMachine`, connect rules for the shared parts, React part implementations, contract helpers (shared as Alert Dialog does) |

## Goals / Non-Goals

**Goals:**
- The Dialog machine with one preset: no fork, two states, the gesture as events.
- One gesture module, `core/dom/swipe.ts`, reused by Toast without change.
- Zero machine events and zero renders per pointer move.

**Non-Goals:**
- Edge-swipe opening, `CloseWatcher`, the full virtual-keyboard choreography, swipe
  strength (proposal Non-goals).

## Decisions

### 1. Machine: a Dialog preset

```
           TRIGGER_PRESS / OPEN / $sync(true)
  closed ─────────────────────────────────────► open ◄─┐  SWIPE.START / SWIPE (settle) / SWIPE.CANCEL /
    ▲                                            │     │  HANDLE_PRESS / SNAP_POINT.SET / SIZE.CHANGE /
    │                                            └─────┘  NESTED.CHANGE   (self-transitions, actions only)
    └── Dialog's close events + SWIPE [swipeDismisses] (reason "SWIPE")
```

```ts
type DrawerEvent = DialogEvent
  | { type: "SWIPE.START"; modality: "pointer" | "touch" }
  | { type: "SWIPE"; direction: SwipeDirection | null; offset: number; velocity: number; size: number }
  | { type: "SWIPE.CANCEL" }
  | { type: "HANDLE_PRESS"; modality: Modality }
  | { type: "SNAP_POINT.SET"; value: SnapPoint }                                 // api.setSnapPoint()
  | { type: "SIZE.CHANGE"; content: number; viewport: number; rootFontSize: number }
  | { type: "NESTED.CHANGE"; count: number; frontmostSize: number; swiping: boolean }

export const drawerMachine = buildDialogMachine({
  kind: "drawer",
  closeEvents: [{ event: "SWIPE", guard: "swipeDismisses", actions: ["releaseToClose"] }],
  defaults: { side: "bottom", swipeThreshold: 0.5, swipeVelocityThreshold: 0.5, closeOnSwipe: true,
              snapToSequentialPoints: false },
  extend: {
    values: { snapPoint: controllable() },            // snapPoint / defaultSnapPoint / onSnapPointChange
    context: { swipe: "idle" as "idle" | "swiping" | "releasing", sizes, nested },
    open: {
      entry: ["resetSnapPoint"],
      effects: ["swipeTracking", "measureSize", "nestedMetrics", "keyboardInset"],
      on: {
        "SWIPE.START": { actions: "startSwipe" },
        SWIPE: { actions: ["settleSnapPoint", "endSwipe"] },   // after the guarded close above
        "SWIPE.CANCEL": { actions: "endSwipe" },
        HANDLE_PRESS: { guard: "hasSnapPoints", actions: "cycleSnapPoint" },
        "SNAP_POINT.SET": { actions: "setSnapPoint" },
        "SIZE.CHANGE": { actions: "setSizes" },
        "NESTED.CHANGE": { actions: "setNested" },
      },
    },
    on: { $reverted: { actions: "endSwipe" } },
    parts: ["close-trigger", "handle"],                // registered on mount, for the warning and handle form
  },
})
```

- **Swiping is context, not a state.** A `swiping` state would exit `open`, whose
  state-scoped overlay effect would clean up (layer release, focus restore) and restart;
  the runtime is flat (foundations decision). Context `swipe` drives `data-swiping`
  (`swiping`) and `data-swipe-dismiss` (`releasing`, then `closed` with reason `SWIPE`).
- **Guards are pure functions** in `snap-points.ts`, testable in Node:
  `resolveSnapPoints(points, sizes)` (fraction / px / rem, clamp, 1 px dedupe, order by
  size), `swipeDismisses(event, props, sizes, snapPoint)` (direction equals the side's
  edge, `closeOnSwipe`, offset ≥ `swipeThreshold × size` or velocity ≥
  `swipeVelocityThreshold`; with snap points, projected target below the smallest), and
  `settleTarget(...)` (closest after a 300 ms velocity projection, or sequential).
- **Controlled and vetoed releases.** `releaseToClose` is a transition action, so it runs
  for a controlled proposal too (runtime rule) and sets `swipe: "releasing"`: the
  content keeps its release position until `$sync(false)` (exit from there) or
  `$reverted` (`endSwipe` → settle). An uncontrolled `cancel()` runs no actions, so the
  `swipeTracking` effect, which reads context synchronously after its own `send`, sends
  `SWIPE.CANCEL` when the machine is still `open` with `swipe === "swiping"`.
- **Snap point reset** happens on entry to `open` (uncontrolled only), not on close, so
  the exit animation does not jump to the default point.
- *Alternatives:* a separate drawer machine (Zag: five states) — rejected, it forks the
  Dialog and drifts (reka-ui#2702 is the Alert Dialog precedent); a sibling swipe
  service — rejected, the dismiss decision needs the drawer's props and must be
  evaluated by the oracle.

### 2. `core/dom/swipe.ts` (shared, `swipe-gesture`)

```ts
export type SwipeDirection = "up" | "down" | "left" | "right"      // physical
export interface SwipeTracker { stop(): void; reset(): void }
export function trackSwipe(env: DomEnv & Scheduler, options: {
  element: () => HTMLElement | null
  directions: readonly SwipeDirection[]
  prefix: string                                       // --rind-<prefix>-swipe-x|y|progress
  alwaysFrom?: () => readonly Element[]                // e.g. the handle: starts even in [data-rind-no-swipe]
  canStart?: (target: Element) => boolean
  onStart(e: { modality: "pointer" | "touch" }): void
  onEnd(e: { direction: SwipeDirection | null; offset: number; velocity: number; size: number }): void
  onCancel(): void
  onProgress?(progress: number): void                  // per frame, never a machine event
}): SwipeTracker
```

- A `pointerdown` (mouse/pen) or `touchstart` listener on the element; document-level
  move/up listeners only while pending or active. Touch is tracked through touch
  events (the browser fires `pointercancel` when it takes a pan; Zag and Base UI do the
  same), mouse and pen through pointer events with `setPointerCapture`.
- Pending → active after a 6 px slop with a 2:1 axis bias (Base UI's numbers; Zag 6 px
  / 1.35). Scroll check at attribution: walk from the target (any `Element`) up to the
  swiped element through the composed tree, summing remaining scroll in the direction;
  the page is never included. `preventDefault` on `touchmove` only after attribution.
- Damping `sign(d) × |d|^0.5` against disallowed directions; first-move rebaseline.
- Velocity from `event.timeStamp`: samples in the last 100 ms, none older than 80 ms at
  release, no fixed per-sample floor (base-ui#5837). Change of mind: reversal ≥ 10 px
  from the furthest point → `direction: null`.
- Writes via `style.setProperty` only (CSSOM; CSP-safe, overlay scroll-lock rule).
- *Alternatives:* Zag's per-move machine events (renders per frame, base-ui#4863);
  Pointer Events only (iOS `pointercancel` on pan).

### 3. `core/dom/drawer-stack.ts`

A per-document registry (`Symbol.for("rind-ui.drawer-stack@1")`, same reasoning as the
layer stack) of **open** drawers keyed by layer id: border-box size, swiping flag, and
the latest progress. The `nestedMetrics` effect subscribes and sends `NESTED.CHANGE`
(discrete: count, frontmost size, swiping) to each drawer whose layer has drawer-family
descendants; progress is mirrored as a CSS variable onto the backdrop, the indent parts
and ancestors through `onProgress`, never through machines. Indent parts subscribe for
`data-active` (any modal drawer open) and register their elements for the progress
variable after mount (hydration-safe). Registration happens on open, removal on close
or stop (base-ui#5915). *Alternative:* Base UI's `Drawer.Provider` — rejected, the
document already knows its open drawers; no provider to forget.

### 4. Connect

As the Dialog's, scope `drawer`, plus the attributes in the spec's Data Attributes
requirement. Layer meta with family `drawer` (so dialogs do not count, base-ui#4492).
`handle`: `button` + press handlers + `aria-label` from messages when the resolved
snap points are ≥ 2, else `aria-hidden="true"` without handlers; `data-snap-point`.
`--rind-drawer-snap-offset` and `--rind-drawer-size` come from context (they change only
on settle or resize). `measureSize` uses a `ResizeObserver` (border-box) on the content
and `resize` on the window; `keyboardInset` listens to `visualViewport` resize/scroll
and writes the inset variable on the positioner (continuous, imperative, like position
vars).

### 5. React parts

`Drawer.Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`,
`CloseTrigger` are the Dialog's implementations with the drawer service; `Handle`,
`Indent`, `IndentBackground` are new. No other behaviour in parts. Title and Content
thereby get Dialog's heading rules (from add-heading): `h{level}` (default `h2`) via
`headingProps`, content children in a `Heading.Level` one deeper.

### 6. Contract and driver

```ts
export const drawerContract = contract(drawerMachine, {
  ...dialogContractParts("drawer"),            // locate dialog+name, traits, open/close/pressEscape/…
  actions: {
    ...dialogActions,
    swipe: { touch: ({ part }, dir, px) => part("content").drag(vector(dir, px), { pointerType: "touch", durationMs: 600, steps: 12 }),
             pointer: …same with "mouse",
             none: { keyboard: "keyboard alternatives are close, pressEscape and pressHandle" },
             done: (q) => q.isOpen().then((o) => !o) },
    pressHandle: { pointer, touch, keyboard: focus handle + Enter, done: snapPoint changed },
  },
  queries: { ...dialogQueries, snapPoint, side, isSwiping },
  events: { ...dialogEvents, SWIPE: { action: "swipe", args: (ctx) => [edgeOf(ctx.side), 0.8 * ctx.size] },
            HANDLE_PRESS: "pressHandle", "SWIPE.START": { skip: "part of swipe" }, "SWIPE.CANCEL": { skip: "unit tests" },
            "SNAP_POINT.SET": { skip: "api only" }, "SIZE.CHANGE": { skip: "layout" }, "NESTED.CHANGE": { skip: "layout" } },
})
```

Model runs use props sets `{}`, `{ modal: false }`, `{ snapPoints: [0.4, 1] }`,
`{ closeOnSwipe: false }`, `{ side: "inline-start" }` under both directions.

### 7. Shared modules used

`core/dom`: `layer-stack`, `overlay`, `dismiss`, `focus-scope`, `focus-restore`,
`inert-outside`, `scroll-lock`, `presence`, `portal` (overlay); `press`, `modality`,
`focus-safely`, `quirks` (a11y); new `swipe` and `drawer-stack`. No `core/collection`.

### Requests to other changes (ALL APPLIED: add-dialog tasks A.1–A.2, add-overlay-infrastructure task A.2)

1. **`add-dialog` — builder extension points.** `buildDialogMachine` (today: `kind`,
   `closeEvents`, `defaults`, `fixed`) must also accept: close events with a guard and
   actions; extra controllable `values`; extra `context`; extra `open` entry actions,
   effects and non-closing `on` handlers (ordered after the guarded close events);
   root-level `on` handlers (`$reverted`); extra registered part names. Alert Dialog is
   unaffected.
2. **`add-dialog` — Parent Layer.** The nearest open layer of kind `dialog`,
   `alertdialog` **or `drawer`** must be eligible as a dialog's parent, so a dialog
   opened from a drawer is its child (Escape, `parent-dismissed`); stacking families
   stay separate (`dialog` vs `drawer`).
3. **`add-overlay-infrastructure` — dismissable-layer.** Presses and focus inside
   elements matching the keep-visible rule's `[data-rind-top-layer]` (toast regions)
   must not count as outside for any layer (ark#2974). `add-toast` makes the same
   request; it is listed here because the Drawer spec depends on it.

## Risks / Trade-offs

- [The builder grows extension points] → they are data (events, guards, effects), so the
  graph stays static; Alert Dialog keeps using only `closeEvents`/`defaults`.
- [Scroll arbitration differs from native iOS sheets in edge cases] → numbers copied from
  Base UI after its 2026 bug run; iOS device check on the release checklist.
- [Android back leaves the page with the drawer open] → deferred `CloseWatcher` (as the
  Dialog); documented.
- [Keyboard inset alone may not keep the focused field visible on iOS Chrome
  (base-ui#5766)] → open question; additive.
- [Settle paths are not model-covered] → unit tests on the pure functions + browser
  scenarios.

## Migration Plan

Reado's `Drawer.tsx` (Ark `Dialog`): replace imports with `Drawer` from
`@rind-ui/react`, set `side="right"`, drop `lazyMount`/`unmountOnExit`, change
`onOpenChange={(d) => …(d.open)}` to `(open) => …`; its slide keyframes keep working on
`[data-state]`, or move to the theme's transform on `--rind-drawer-swipe-x`.

## Open Questions

- Whether the keyboard inset suffices or Base UI's field re-alignment is needed — after
  the iOS device check; additive capability either way.
