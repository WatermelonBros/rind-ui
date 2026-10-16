## Context

See proposal.md for motivation and specs/scroll-area/spec.md for behaviour. Research,
the library comparison and the Bug history the scenarios cite:
[scroll-area.md](../../../docs/research/scroll-area.md). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, delayed transitions through the scheduler, effects, `view(props)`, contracts (`{ skip }`), drivers, `testMachine`, React adapter (ids, per-part selectors, `data-instance`) |
| `add-a11y-foundations` | `Environment.modality()` (touch modality → every scroll is a user scroll; hover only for mouse/pen), `StyleInjection.nonce`, `Environment.reducedMotion()` (theme only), `data-focus-visible` on the Viewport, dev logger, generic invariants |
| `add-slider` | `pointer-drag` (`core/dom/pointer-drag.ts`) for thumb drag and `jump` track presses; `test-drivers` pointer steps `box()` and `pointer(phase, { at, pointerType })` |
| `add-overlay-infrastructure` | the sequential tab-order computation of `core/dom/focus-scope.ts` (request 1) to decide "Content has a tabbable element", consistent with focus containment treating keyboard-focusable scrollers as tab stops (react-spectrum#10395) |
| `add-theme-system` | stylesheet convention, `decoration` family, duration tokens, forced-colors rules |

## Goals / Non-Goals

**Goals:**
- The browser does all scrolling; the component only measures, draws and forwards
  wheels that land on its own scrollbars.
- No per-frame machine snapshots: geometry is written to the DOM by one `core/dom`
  module; the machine sees only discrete facts.
- One cleanup owns every listener, observer and animation frame.

**Non-Goals:**
- Hierarchical states, scroll restoration, virtualization, imperative scroll helpers.

## Decisions

### 1. Machine: flat activity states, type-agnostic

```
                 POINTER.ENTER · FOCUS.IN · SCROLLBAR.ENTER · SCROLL(user)
   idle ───────────────────────────────────────────────────────────────► engaged
    ▲                                                                       │ ▲
    │ after hideDelay                    LEAVE/FOCUS.OUT/SCROLLBAR.LEAVE     │ │ SCROLL(user) (reenter:
    │                                    [!scrolling && !engagedBy(type)]   │ │  restarts scrollEnd)
 lingering ◄────────────────────────────────────────────────────────────────┘ │
    │  after scrollEnd [!engagedBy(type)] (from engaged) ─────────────────────► lingering
    └── POINTER.ENTER · FOCUS.IN · SCROLLBAR.ENTER · SCROLL(user) ──────────────┘ → engaged
   any ── DRAG.START{axis} ──► dragging ── DRAG.END · DRAG.CANCEL ──► [engagedBy] engaged : lingering
   root: METRICS{overflow, edges, tabbable, measured} · VIEWPORT.FOCUS · VIEWPORT.BLUR
```

```ts
type ScrollAreaEvent =
  | { type: "POINTER.ENTER" | "POINTER.LEAVE"; pointerType: PointerType }   // Root, mouse/pen only reach the machine
  | { type: "SCROLLBAR.ENTER" | "SCROLLBAR.LEAVE"; axis: Axis }
  | { type: "FOCUS.IN" | "FOCUS.OUT" }                                        // focus inside the Root
  | { type: "VIEWPORT.FOCUS" | "VIEWPORT.BLUR" }
  | { type: "SCROLL"; axis: Axis | "both"; user: boolean }
  | { type: "DRAG.START"; axis: Axis } | { type: "DRAG.END" } | { type: "DRAG.CANCEL" }
  | { type: "TRACK.PRESS"; axis: Axis; side: "back" | "forward"; mode: "page" | "jump" }
  | { type: "METRICS"; overflow: AxisFlags; edges: EdgeFlags; tabbable: boolean }
```

- **Context**: `hovered`, `focusInside`, `viewportFocused`, `onScrollbar: Axis | null`,
  `scrolling: Axis | "both" | null`, `dragAxis: Axis | null`, `measured`, `overflow`,
  `edges`, `tabbableContent`, `tabStop` (latched: set by METRICS, cleared on
  `VIEWPORT.BLUR` only when the rule no longer holds).
- **Delays** (scheduler): `scrollEnd` = 100 ms on `engaged` (self-transition with
  `reenter` restarts it), `hideDelay` = `props.hideDelay` (600) on `lingering`.
- **Guards**: `isUserScroll`, `engagedBy` (hover/auto/always: `hovered || focusInside ||
  onScrollbar`; scroll: `onScrollbar`), `isScrolling`.
- **Visibility is computed in `view`**, not stored: `always` → true; `auto` →
  `overflow[axis]`; `hover` → `overflow[axis] && state ≠ idle`; `scroll` →
  `overflow[axis] && (state ∈ {lingering, dragging} || scrolling || onScrollbar)`. All
  require `measured` except `always`.
- `SCROLL` with `user: false` is a targetless no-op (the thumb is already updated by the
  DOM module), so programmatic scrolls never engage (BU#983).
- *Alternatives:* per-type components (Radix — four code paths, presence remounts behind
  BITS#1374); visibility left entirely to CSS (Base UI — no hide delay, every consumer
  writes timers in CSS transitions; we keep Base UI's attributes *and* add `data-state`);
  Zag's `idle | dragging` with timers in refs (timers outside the graph cannot be
  model-tested).

### 2. `core/dom/scroll-metrics.ts` — the only module that touches layout

```ts
interface ScrollMetricsCapability {
  track(parts: { root; viewport; content; scrollbar: { x?; y? }; thumb: { x?; y? }; corner? },
        send: (e: ScrollAreaEvent) => void, opts: { nonce?: string }): { measure(): void; stop(): void }
}
```

- Inject the layered rule once per document (keyed, shared with `touch-action.ts` —
  the existing injector becomes `injectStyle(doc, key, css, nonce)`, `textContent`):

```css
@layer {
  [data-scope="scroll-area"][data-part="viewport"] { overflow: auto; scrollbar-width: none }
  [data-scope="scroll-area"][data-part="viewport"]::-webkit-scrollbar { display: none }
  [data-scope="scroll-area"][data-part="content"] { position: relative }
}
```

- Triggers, all coalesced into one `requestAnimationFrame` (scheduler): passive `scroll`
  on the viewport; `ResizeObserver` on viewport, content and content's direct children
  (re-observed on child-list mutation); `MutationObserver` on content (`childList`,
  `subtree`, attributes `tabindex`, `disabled`, `hidden`, `inert`, `contenteditable`,
  `href`) for tabbability; `measure()`.
- One pass: **read** `scrollWidth/Height`, `clientWidth/Height`, `scrollLeft/Top`,
  computed `overflow-x/y`, `direction`, `flex-direction`, `overscroll-behavior-x/y`,
  scrollbar padding and thumb rendered size; **then write** thumb `transform`,
  `--rind-scroll-area-thumb-size`, overflow-edge variables, corner variables. `send
  METRICS` only when a discrete fact differs from the last one sent.
- Range normalisation: `reversedX = (direction === "rtl") !== (flexDirection ===
  "row-reverse")`, `reversedY = flexDirection === "column-reverse"`; `min = reversed ?
  −max : 0`; physical fraction `(pos − min) / max`, clamped, `max === 0 → 0`.
- Tabbable content: `tabbables(content).length > 0` (request 1).
- User scroll marking: `wheel`, `touchstart`, `pointerdown`, `keydown` on the viewport
  set a flag cleared 100 ms after the last scroll; touch modality forces `user: true`
  (Base UI: WebKit momentum catches dispatch no events).
- Wheel forwarding: non-passive listener on each scrollbar element (spec "Wheel Over
  Scrollbars"); `deltaMode` 1 → ×16 px, 2 → ×client length.
- Drag: on thumb `pointerdown` (primary mouse, pen, touch) → `env.pointerDrag.start(track,
  e, { axis, dir, grabOffset: pointer − thumbCentre, inset: thumbSize / 2 }, onMove)`;
  `pointer-drag` reports a logical fraction (from inline start, from the bottom for
  vertical), so `physical = vertical ? 1 − f : dir === "rtl" ? 1 − f : f` and `pos = min
  + physical × max`. Moves write `scrollTop/Left` directly; the machine receives only
  `DRAG.START/END/CANCEL`. `scroll-snap-type` saved and set to `none` for the drag and
  `jump` presses, restored on end/cancel. `pointer-drag` is used as specified: no
  extension needed.
- Track press `page`: `scrollBy` of one client length toward the press (instant).
  `mousedown` `preventDefault` on scrollbar parts.

*Alternatives:* geometry in the machine (one snapshot per scroll frame, the BU#3534
re-render cascade); a rAF loop while scrolling (Radix — the leak in RX#1973); CSS
scroll-driven animations (no Firefox yet — open question in research).

### 3. Connect

| Part | Element | Notes |
|---|---|---|
| Root | `div` | `position: relative`; `data-*` per spec; corner variables; `pointerenter/leave` (mouse/pen) and `focusin/focusout` (related target outside) → events; passes `data-variant/size/tone` |
| Viewport | `div` | `tabIndex` from `tabStop` unless the consumer sets it; `role="region"` iff named; `focus`/`blur` → `VIEWPORT.*`; dev warning for an unnamed tab stop |
| Content | `div` | no inline style |
| Scrollbar | `div` | `aria-hidden`, `position: absolute`, logical insets (`inset-inline-end: 0` for vertical, `bottom: 0` + corner variables), `user-select: none`, track `pointerdown` (mouse/pen) → `TRACK.PRESS`; `pointerenter/leave` → `SCROLLBAR.*` |
| Thumb | `div` | `aria-hidden`, `touch-action: none`, `pointerdown` → drag start |
| Corner | `div` | `aria-hidden`, rendered only when both Scrollbar parts exist; `data-state` |

### 4. Contract

```ts
export const scrollAreaContract = contract(scrollAreaMachine, {
  scope: "scroll-area",
  locate: [{ role: "region", name: true, part: "viewport" }, { text: true, part: "content" }],
  traits: ["directional"],
  invariants: [tabStopRule, hiddenPartsNotFocusable, oneDraggingAxis, viewportNotPresentational],
  actions: { focusViewport, scroll, dragThumb, pressTrack, hover, unhover },
  queries: { hasOverflow, isScrollbarVisible, atStart, atEnd, isDragging, isTabStop },
  events: {
    "POINTER.ENTER": "hover", "POINTER.LEAVE": "unhover",
    "SCROLLBAR.ENTER": { skip: "hover over a scrollbar part, covered by dragThumb" },
    "SCROLLBAR.LEAVE": { skip: "as SCROLLBAR.ENTER" },
    "FOCUS.IN": "focusViewport", "FOCUS.OUT": { skip: "tab out, driver test" },
    "VIEWPORT.FOCUS": "focusViewport", "VIEWPORT.BLUR": { skip: "tab-stop latch, browser test" },
    SCROLL: "scroll", "DRAG.START": "dragThumb", "DRAG.END": "dragThumb",
    "DRAG.CANCEL": { skip: "pointer-drag cancel paths, unit test" },
    "TRACK.PRESS": "pressTrack", METRICS: { skip: "measurement, driven by layout" },
  },
})
```

Props classes for `testMachine`: each `type`, `trackPress: "jump"`, both axes, RTL,
`column-reverse`, text-only content, button content, no overflow. jsdom runs use a fake
`scrollMetrics` capability that emits scripted `METRICS`; geometry runs in browser mode.

### 5. Theme

`packages/theme/src/scroll-area.css`, `decoration` family (no variant/size matrix —
`theme-variants` already lists "future decorative parts" there, so no family change):
`--rind-scroll-area-scrollbar-size`, `-scrollbar-padding`, `-track-bg`, `-thumb-bg`,
`-thumb-hover-bg`, `-thumb-active-bg`, `-thumb-radius`, `-thumb-min-size` (applied as
`min-block-size`/`min-inline-size`, which the measure respects through the rendered
size), `-corner-bg`, `-fade-duration`. Thumb `block-size: max(var(--rind-scroll-area-thumb-size), var(--rind-scroll-area-thumb-min-size, 18px))`.
`data-state="hidden"` → `opacity: 0; pointer-events: none` with the duration token.
Forced colors: thumb `CanvasText` + `forced-color-adjust: none`. `data-tone="danger"`
tints the thumb. Target size: the scrollbar is an equivalent of native scrolling (2.5.8
exception); the theme widens it on `data-hovering`.

## Risks / Trade-offs

- [A descendant deeper than Content's direct children widens without resizing any
  observed box → horizontal thumb stale] → MutationObserver catches DOM changes;
  `measure()` is exported for the rest; documented ceiling (research Known pitfalls).
- [MutationObserver with `subtree` on very large content] → work is one rAF-coalesced
  measure per frame; virtualized lists change few nodes.
- [Custom thumb lags on iOS (async scroll events, BU#3185)] → documented recipe to keep
  native bars on touch (override the layered rule under `(pointer: coarse)`).
- [`tabbables()` walk on every content mutation] → only when the subtree changed and
  only up to the first tabbable found.
- [Firefox fires `click` on the element under the pointer after a captured drag
  (radix-ui/primitives#2777)] → fixed in Firefox 140; no workaround.

## Requests to other changes

1. **`add-overlay-infrastructure`** (`focus-containment`): export the sequential
   tab-order computation used by Tab wrapping as a named `core/dom` helper
   (`tabbables(container): HTMLElement[]`, including keyboard-focusable scrollers), so
   Scroll Area decides "Content has a tabbable element" with exactly the order focus
   containment uses. APPLIED (coordinator, 2026-10-14): add-overlay-infrastructure `focus-containment`
   "Exported Tab Order Helper", task A.5.

## Migration Plan

New API. Radix / Reka / Bits: same parts; `scrollHideDelay` → `hideDelay`; the implicit
`display: table` wrapper is gone — render `ScrollArea.Content`. Base UI: same parts and
`data-overflow-*` attributes; `data-state` added. Ark: `scrollToEdge`/`scrollTo` → call
`Element.scrollTo` on the viewport ref. Reado: nothing to migrate.

## Open Questions

- Whether `trackPress` should default to `jump` on platforms whose native setting is
  "jump to the spot" — no platform API exposes the setting; `page` stays the default.
