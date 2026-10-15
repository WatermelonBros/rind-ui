# Scroll Area — research

Status: done · Wave: 2

Custom-drawn scrollbars over a **native** scroll container: the browser still scrolls
(wheel, touch, momentum, keyboard, find-in-page, focus-into-view), the component hides
the native scrollbars and draws its own thumb and track, positioned from measurements.
Its difficulty is not ARIA (there is almost none) but keeping every native affordance
intact — keyboard scrolling, zoom, forced colors, RTL, reversed flex layouts, scroll
snap, nested scrollers, server rendering — while measuring cheaply.

Sources: shallow clones read 2026-10-14 (paths repo-relative). Bug history: `gh search
issues` over the ten trackers in [README.md](README.md) with `scroll area`,
`ScrollArea`, `scroll-area`, `scrollable region focusable`; ~170 hits, ~45 relevant, 36
read in full (`gh api repos/<repo>/issues/<n>` plus comments).

## Pattern

- WAI-ARIA APG: **none**. accessibility.md §1.5 lists Scroll Area under "no APG pattern:
  native scroll, must stay keyboard-scrollable". ARIA's `scrollbar` role exists (a
  focusable widget with `aria-controls`, `aria-valuenow`, `aria-orientation`), but every
  library hides custom scrollbars from AT instead, because the native scroll region
  already is the accessible scroll mechanism and a second, pointer-only control would be
  a virtual-cursor stop that does nothing (BU#5585).
- Roles and attributes required:
  - The viewport is the scroll container. When it has scrollable overflow and **no
    focusable descendant**, it must itself be keyboard-focusable (`tabindex="0"`), or
    keyboard users cannot scroll it: WCAG 2.1.1, axe
    [`scrollable-region-focusable`](https://dequeuniversity.com/rules/axe/4.10/scrollable-region-focusable).
    Chromium and Firefox now do this natively for scrollers without focusable
    children (keyboard-focusable scrollers, cited in RA#10395); **Safari does not**, and
    a custom focus trap that walks its own tab order skips them (RA#10395, open).
  - A focusable viewport with `role="presentation"` is a conflict (focusable elements
    ignore presentational roles; Aria Toolkit / Deque flag it, BU#5812). A focusable
    region should have a name; `role="region"` + a name is the documented technique.
  - Scrollbars, thumbs and the corner: `aria-hidden="true"`, never focusable.
- Keyboard interactions required: **the native ones, untouched** — Arrow keys,
  PageUp/PageDown, Home/End, Space/Shift+Space scroll the focused (or focus-containing)
  scroller. The component intercepts no key.

## How the others built it

Shipping: Ark/Zag, Radix, Base UI, Reka UI, Bits UI (components.md). React Aria,
Headless UI, Ariakit and Kobalte ship none (React Aria relies on native scrolling; its
only interaction is FocusScope's tab walker, RA#10395).

### Radix (`packages/react/scroll-area/src/scroll-area.tsx`, 1,191 lines)

- Parts: `Root`, `Viewport`, `Content` (implicit wrapper unless
  `disableImplicitContentElement`), `Scrollbar` (`orientation`), `Thumb`, `Corner`.
  Props: `type: "auto" | "always" | "scroll" | "hover"` (default `hover`),
  `scrollHideDelay` (600 ms), `dir`, `nonce`.
- State: per-type React components. `hover`: pointerenter/leave on the root with a
  hide timer. `scroll`: a tiny string machine `hidden → scrolling → idle → hidden` with
  `interacting` while the pointer is on the scrollbar; scroll end = 100 ms debounce.
  `auto`: overflow check debounced 10 ms on ResizeObserver. Presence mounts/unmounts
  scrollbars and the thumb.
- Hiding native scrollbars: an injected `<style>` (`scrollbar-width:none`,
  `::-webkit-scrollbar{display:none}`) via `dangerouslySetInnerHTML` with `nonce`.
  Viewport `overflowX/Y` is `scroll` only when that axis' Scrollbar part is mounted,
  else `hidden`.
- Content wrapper is `display: table; min-width: 100%` so its box tracks both axes —
  the single largest bug source (RX#926, #2964, #2722, #3129, #2783, #3470, #3247).
- Thumb position: `translate3d` written in a rAF loop started on `scroll` and stopped
  100 ms after the last one ("avoid scroll-linked effects"); the loop leaked when the
  debounce was cancelled on unmount (RX#1973, open).
- Drag: pointer capture on the scrollbar, pointer position → scroll position with a
  linear scale, `document.body.style.webkitUserSelect = "none"` during the drag
  (Safari selects text under capture). Track press jumps the thumb centre to the
  pointer. Thumb min size 18 px ("matches macOS").
- Wheel over a scrollbar: a **document-level** non-passive `wheel` listener forwards
  delta to the viewport and `preventDefault`s while inside bounds — ignores the
  viewport's `overscroll-behavior` (RX#1667, open).
- Corner sized from scrollbar thicknesses, published as CSS variables (never reset to 0
  until RX#2383).
- Viewport: **no tabindex, no role**: keyboard focus depends on the browser.
- Problems: column-reverse layouts (RX#1585, open), `max-height` needs to be on the
  Viewport (RX#2307), style tag re-rendering (RX#3417), trusted types (RX#3117, open),
  `overflow` shorthand warnings (RX#2059), no macOS bounce (RX#2493).

### Base UI (`packages/react/src/scroll-area/**`, 1,734 lines)

- Parts: `Root`, `Viewport`, `Content`, `Scrollbar` (`orientation`, `keepMounted`),
  `Thumb`, `Corner`. **No `type` prop**: scrollbars always render when the axis
  overflows; visibility is left to CSS through `data-hovering` and `data-scrolling`
  (per axis, 500 ms `SCROLL_TIMEOUT`). `overflowEdgeThreshold` prop.
- `Viewport` (`viewport/ScrollAreaViewport.tsx`): `tabIndex: hiddenState.x &&
  hiddenState.y ? -1 : 0` (focusable whenever any axis overflows — even when the
  content has buttons), no role since BU#5812 (it was `presentation`). Hidden state
  defaults to "hidden" until measured (BU#3829, BU#4103, fix in #4107) — the earlier
  default made dialogs focus the viewport and then lose focus when the measure removed
  its tabindex (BU#4205).
- One `computeThumbPosition` reads `scrollHeight/clientHeight/scrollTop`, padding of the
  scrollbar and margin of the thumb, writes `translate3d` and **overflow-edge CSS
  variables** (`--scroll-area-overflow-y-start` …, registered with
  `CSS.registerProperty({ inherits: false })` except in WebKit, for fade masks) and
  `data-overflow-{x,y}-{start,end}`. RTL: `scrollLeft` from 0 to −max, normalised from
  the inline start (`utils/scrollEdges`), direction from `DirectionProvider` (BU#1189,
  BU#5300: an RTL page without the provider froze the horizontal thumb).
- Re-measure: ResizeObserver on the viewport, and on `Content` (BU#4696: the viewport's
  box does not change when its children grow — without `Content` the thumb went stale);
  waits for finite subtree animations once.
- Drag (`root/ScrollAreaRoot.tsx`): delta from press position, capture on the thumb,
  `buttons % 2 === 0` ends the drag; **disables `scroll-snap-type` during the drag and
  track jump** (snap quantises the assigned position), restores after.
- Track press (`scrollbar/ScrollAreaScrollbar.tsx`): jump to centre, then continue as a
  drag; `onMouseDown` `preventDefault` ("native scrollbars don't move focus");
  `aria-hidden` on the scrollbar (BU#5585); `touch-action: none`, `user-select: none`.
- Wheel: listener **on the scrollbar element**, ignores `ctrlKey` (pinch-zoom /
  Ctrl+wheel zoom), lets the event chain at an edge, handles RTL's negative range.
- Programmatic vs user scroll: `data-scrolling` only after wheel/pointer/key in the
  viewport (BU#983); in touch modality every scroll is user-driven ("WebKit consumes a
  touch that catches an in-flight momentum scroll … without dispatching any DOM
  events").
- Safari rubber-band: thumb shrinks against the pinned edge (BU#4682).
- CSP: `<style>` element with nonce from a CSP provider (BU#3550).
- Problems: forced reflow cascades with many instances (BU#3534), thumb attaching to
  the cursor without a press (BU#5371), horizontal scrollbar hijacking vertical page
  pans on touch (BU#2825, fixed with `pointer-events: none` until scrolling), iOS lag
  and no rubber band (BU#3185, open: "disable custom scrollbars on mobile").

### Zag / Ark (`packages/machines/scroll-area/src/*`, 556-line machine)

- Parts: `root`, `viewport`, `content`, `scrollbar`, `thumb`, `corner`. Machine states
  `idle` / `dragging`; context `hovering`, `scrollingX/Y`, `hiddenState`, `atSides`,
  `cornerSize`, `thumbSize`. Effects: `trackContentResize` (ResizeObserver),
  `trackViewportVisibility` (IntersectionObserver), `trackWheelEvent`.
- API: `isAtTop/Bottom/Left/Right`, `hasOverflowX/Y`, `getScrollProgress()`,
  `scrollToEdge({ edge, behavior })`, `scrollTo()` — imperative helpers over the
  viewport.
- Viewport: `role="presentation"` **and** `tabIndex: hiddenX || hiddenY ? undefined : 0`
  — focusable only when *both* axes overflow, so the common vertical-only area is not a
  tab stop at all, and when it is, it carries the presentational-role conflict of
  BU#5812.
- `data-dragging` was stamped on both axes (ZG#3418). Column-reverse negative
  `scrollTop` (ZG#3073: maintainer believed browsers use positive values; a reporter
  showed Chrome 146/Firefox 149 negative).

### Reka UI / Bits UI (Radix ports)

- Reka (`packages/core/src/ScrollArea/*.vue`): Radix's anatomy and types plus **`glimpse`**
  (shows on pointer enter, hides after the delay even while hovered). Viewport
  `:tabindex="0"` unconditionally — a tab stop even with no overflow. Bugs: corner state
  lost across hover cycles (RK#2669), vertical padding math (RK#2301), thumb not
  repositioned when content size changes (RK#2303), detached nodes after navigation
  (RK#2420), Firefox scrollbar visible (missing `scrollbar-width: none`, RK#317),
  wish to hide bars when `overflow: hidden` is set (RK#2802, open), scrollbar-presence
  state (RK#1749, open).
- Bits (`lib/bits/scroll-area/scroll-area.svelte.ts`): Radix's design; no tabindex.
  Bugs: leaked document wheel listeners (BITS#2116), stuck `webkitUserSelect` and
  pointer capture after a fast drag (BITS#1900), resize callback after unmount
  (BITS#2121), thumb jumping on re-entry in `hover` mode because the thumb remounts
  (BITS#1374), Windows Firefox missing scrollbar (BITS#540).

### Reado

No scroll area component. `src/styles/app.css` styles **native** scrollbars
(`scrollbar-width: thin`, `scrollbar-color`, `::-webkit-scrollbar`), a user setting
`scrollbar: auto | always | hidden` toggles the CodeMirror scroller with
`scrollbar-width`, tab strips hide the bar (`Tabs.tsx`), and `DiffView` draws an
"overview ruler" of change ticks next to the native scrollbar. Lessons: CSS covers most
of what an app needs; Scroll Area is for overlay scrollbars, fade masks from overflow
edges and decorations along the track. Nothing migrates; the ruler is a future consumer
of the track geometry variables.

## Accessibility

Applying [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md):

- **Keyboard (2.1.1).** Native scrolling is the keyboard path; the custom scrollbars are
  pointer conveniences. Rule: the viewport is a tab stop exactly when it overflows on a
  scrollable axis and contains no tabbable element — the same rule Chromium/Firefox
  apply natively, made explicit so Safari and custom focus scopes agree (RA#10395; our
  focus-containment already includes such scrollers, add-overlay-infrastructure).
  Base UI (always when scrollable) adds an extra stop before the first button; Zag
  (both axes) misses the vertical-only case; Reka (always) adds a stop with no overflow;
  Radix depends on the browser and fails in Safari.
- **Focus never lost by remeasuring.** The tabindex must not be present before the
  first measure (a dialog may pick it as initial focus) and must never be removed while
  the viewport holds focus (BU#4205).
- **Name and role.** No role by default (generic; not `presentation`, BU#5812). With a
  consumer name (`aria-label`/`aria-labelledby`) the viewport becomes
  `role="region"`, which makes it a named landmark-ish group that SR users can find and
  that tells them what the focused stop is. Unnamed focusable viewport → dev warning.
- **Hidden parts.** Scrollbars, thumbs, corner: `aria-hidden="true"`, no focusable
  content (BU#5585). They are not in the contract's keyboard path; the viewport is.
- **Pointer cancellation (2.5.2)** does not apply: a scrollbar drag is a continuous
  native-equivalent gesture; native scrollbars do not revert either (BU#4433, maintainer
  answer). **Target size (2.5.8)**: the scrollbar is an equivalent of native scrolling
  (wheel, touch, keys), so the "equivalent" exception applies; the theme still keeps a
  usable thickness and widens on hover.
- **Dragging movements (2.5.7)**: the single-pointer alternative is track press and the
  keyboard/wheel path.
- **Forced colors.** Hiding native scrollbars removes the system-coloured ones; a custom
  thumb painted with `background-color` is forced to the background and vanishes (cause
  K). Theme: `forced-color-adjust: none` on the thumb with `CanvasText`, track border
  in `CanvasText`. The hiding rule lives in an anonymous cascade layer, so a consumer can
  re-enable native scrollbars under `forced-colors: active` with one rule.
- **Zoom.** Ctrl+wheel and trackpad pinch (a `wheel` with `ctrlKey`) are never
  intercepted (Base UI). The viewport keeps the default `touch-action`; only the thumb
  gets `touch-action: none`, so pinch-zoom and page pans over the track keep working
  (BU#2825).
- **Motion.** Show/hide is CSS (`data-state`), wrapped in the reduced-motion duration
  tokens; no JS smooth scrolling.
- **RTL.** `scrollLeft` runs 0 → −max; the thumb's inline position mirrors. Direction is
  read from the viewport's computed style at measure time, so an RTL page without a
  provider still works (BU#5300).
- **Hidden inputs inside.** Absolutely positioned hidden form inputs whose containing
  block is outside the scroller extend the page's scroll area (ARK#3705, RX#3588,
  RX#4041): Content is `position: relative` by default.
- **Screen reader quirks.** None specific beyond Firefox exposing scroll containers as
  tab stops (assistive-tech §1.3, RA#3633), which our rule matches.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#10395](https://github.com/adobe/react-spectrum/issues/10395) | Scrollable text in a modal can't be reached or scrolled by keyboard | FocusScope's own Tab walker skips browser keyboard-focusable scrollers | Open (PR #8796 stale) | Viewport gets an explicit `tabindex=0` under the native rule; our focus scope includes such scrollers |
| Base UI | [#4205](https://github.com/mui/base-ui/issues/4205) | Non-scrollable area breaks a dialog's focus trap | Viewport tabbable by default, dialog focuses it, measure removes tabindex, focus lost | Fixed (#4220) | No tabindex before measure; never remove it while focused |
| Base UI | [#5812](https://github.com/mui/base-ui/issues/5812) | A11y checker flags focusable `role=presentation` viewport | Presentational role on a focusable element is ignored | Fixed (role removed) | No role; `region` only when named |
| Base UI | [#5585](https://github.com/mui/base-ui/issues/5585) | Scrollbar counted as an extra item by SR | Scrollbar exposed in AX tree | Fixed (`aria-hidden`) | Scrollbars/thumb/corner `aria-hidden` |
| Base UI | [#4433](https://github.com/mui/base-ui/issues/4433) | Request: release outside reverts drag (2.5.2) | — | Closed: native scrollbars don't revert | No revert on release outside |
| Base UI | [#4696](https://github.com/mui/base-ui/issues/4696) | Thumb stale after a Collapsible inside closes | Only the viewport is observed; its box doesn't change | Closed: use `Content` | Observe Content and its children, not just the viewport |
| Base UI | [#3829](https://github.com/mui/base-ui/issues/3829) | `data-has-overflow-*` set before measuring → layout shift | Optimistic default | Fixed (#4107) | No overflow attributes until measured |
| Base UI | [#4103](https://github.com/mui/base-ui/issues/4103) | Thumb flashes at wrong size on remount/SSR | Rendered before measure | Fixed: hidden until hydrated/measured | Scrollbars `data-state=hidden` until the first measure |
| Base UI | [#5300](https://github.com/mui/base-ui/issues/5300) | Horizontal thumb never moves on an RTL page | Direction only from provider; negative `scrollLeft` clamped to 0 | Answered: add provider | Read direction from computed style; normalise ranges |
| Base UI | [#1189](https://github.com/mui/base-ui/issues/1189) | Ignores DirectionProvider | Computed style read once on mount | Fixed | Re-read direction on each measure |
| Base UI | [#983](https://github.com/mui/base-ui/issues/983) | `data-scrolling` during programmatic scroll-into-view | No user/programmatic distinction | Fixed | SCROLL carries `user`; only user scrolls engage |
| Base UI | [#2825](https://github.com/mui/base-ui/issues/2825) | Horizontal scrollbar blocks vertical page pan on touch | `touch-action: none` on the whole track | Fixed (pointer-events until scrolling) | `touch-action: none` on the thumb only; touch track presses ignored |
| Base UI | [#3185](https://github.com/mui/base-ui/issues/3185) | Laggy thumb, no rubber band on iOS | Async scroll events, hidden native bar | Open | Non-goal: document `type="scroll"`; native bars on touch via the layered rule |
| Base UI | [#4682](https://github.com/mui/base-ui/issues/4682) | No overscroll feedback on the thumb | Clamped position | Fixed (Safari-only shrink) | Non-goal; position is clamped, never NaN |
| Base UI | [#5371](https://github.com/mui/base-ui/issues/5371) | Thumb follows cursor without a press | Drag state not ended on a buttonless move | Fixed (#5374) | pointer-drag ends on `buttons === 0` |
| Base UI | [#2329](https://github.com/mui/base-ui/issues/2329) | Drag stuck after clicking track with text selected (Windows) | Selection swallowed `pointerup` | Fixed (`user-select: none`) | `user-select: none` on scrollbar parts |
| Base UI | [#3534](https://github.com/mui/base-ui/issues/3534) | Forced reflow cascade with many areas | Interleaved DOM reads/writes per instance | Fixed | Measure reads then writes, rAF-coalesced; no per-frame snapshot updates |
| Base UI | [#3550](https://github.com/mui/base-ui/issues/3550) | Breaks strict CSP | Inline `<style>` | Fixed (nonce) | One injected rule with the environment nonce |
| Base UI | [#1099](https://github.com/mui/base-ui/issues/1099) | Bars not updated on viewport resize | Spread props lost the observer ref | Closed (not reproduced) | Observers live in core/dom, not in consumer-spread props |
| Radix | [#926](https://github.com/radix-ui/primitives/issues/926) | Ellipsis content bursts the container | Implicit `display: table` wrapper | Workarounds | No `display: table`; measure the viewport's scroll size |
| Radix | [#2964](https://github.com/radix-ui/primitives/issues/2964) / [#2783](https://github.com/radix-ui/primitives/issues/2783) | Can't disable `display: table`; breaks `position: sticky` | Same wrapper | Fix reverted (#3225) | Content has no layout-changing inline style |
| Radix | [#3247](https://github.com/radix-ui/primitives/issues/3247) | Patch release added an element, broke `h-full` | Implicit wrapper | Closed | Content is an explicit part |
| Radix | [#1667](https://github.com/radix-ui/primitives/issues/1667) | Wheel over the track ignores `overscroll-behavior` | Forwarding `preventDefault`s blindly | Open | Respect the viewport's `overscroll-behavior` at edges |
| Radix | [#1585](https://github.com/radix-ui/primitives/issues/1585) | Thumb frozen in `column-reverse` | Assumes `scrollTop ∈ [0, max]` | Open | Normalise the physical range (negative for reversed axes) |
| Radix | [#1973](https://github.com/radix-ui/primitives/issues/1973) | Memory leak in Thumb | rAF loop never cancelled when debounce cleared on unmount | Open | One effect owns rAF/observers/listeners with one cleanup |
| Radix | [#2383](https://github.com/radix-ui/primitives/issues/2383) | Corner CSS vars stuck after a bar hides | Never reset | Fixed | Corner vars 0 whenever either bar is hidden |
| Radix | [#2307](https://github.com/radix-ui/primitives/issues/2307) | Doesn't work with `max-height` on root | Size must be on the viewport | Docs | Document: size the Viewport |
| Radix | [#2777](https://github.com/radix-ui/primitives/issues/2777) | Releasing a drag over a button clicks it (Firefox) | Firefox capture bug (bmo 1885232) | Fixed in Firefox 140 | No workaround; noted in pointer-drag pitfalls |
| Radix | [#2059](https://github.com/radix-ui/primitives/issues/2059) | React warning mixing `overflow` shorthands | Inline longhands vs consumer shorthand | Closed | No inline overflow; the layered rule sets it |
| Radix | [#3117](https://github.com/radix-ui/primitives/issues/3117) | Trusted Types violation | `<style>` via `innerHTML` | Open | Inject with `textContent` + nonce |
| Radix | [#2493](https://github.com/radix-ui/primitives/issues/2493) | No macOS bounce on the bar | Clamped thumb | Closed | Non-goal |
| Zag | [#3418](https://github.com/chakra-ui/zag/issues/3418) | `data-dragging` on both axes | Read from state, not axis | Fixed | Dragging axis in context; attribute per axis |
| Zag | [#3073](https://github.com/chakra-ui/zag/issues/3073) | `column-reverse` thumb wrong | Negative `scrollTop` | Closed (disputed) | As RX#1585 |
| Ark | [#3705](https://github.com/chakra-ui/ark/issues/3705) | Checking a checkbox inside scrolls the page | Hidden input's containing block outside the scroller | Workaround: `position: relative` | Content is `position: relative` |
| Bits | [#2116](https://github.com/huntabyte/bits-ui/issues/2116) | Leaked non-passive document wheel listeners | Document listener re-registered in effects | Fixed upstream | Wheel listener on the scrollbar element only |
| Bits | [#1900](https://github.com/huntabyte/bits-ui/issues/1900) | Text unselectable, thumb stuck after fast drag | `body.webkitUserSelect` and capture not restored | Fixed | Never touch `body`; pointer-drag cleans up on every end path |
| Bits | [#1374](https://github.com/huntabyte/bits-ui/issues/1374) | Thumb jumps on re-hover in `hover` type | Thumb remounted by presence, position re-applied late | Fixed (`forceMount`) | Scrollbars stay mounted while the axis overflows; visibility via `data-state` |
| Bits / Reka | [BITS#540](https://github.com/huntabyte/bits-ui/issues/540), [RK#317](https://github.com/unovue/reka-ui/issues/317) | Native scrollbar visible in Firefox | Only `::-webkit-scrollbar` hidden | Fixed | `scrollbar-width: none` first, webkit pseudo as fallback |
| Reka | [#2802](https://github.com/unovue/reka-ui/issues/2802) | Bars shown on an `overflow: hidden` axis | Overflow judged by sizes only | Open | An axis overflows only if its computed overflow is `auto`/`scroll` |
| Reka | [#2303](https://github.com/unovue/reka-ui/issues/2303) | Thumb position stale after content size change | Position recomputed on scroll only | Fixed | Every measure writes both size and offset |

## Known pitfalls

- **The viewport's box does not change when content grows** (BU#4696, RK#2303), and a
  wide child does not change a block Content's box either — the reason Radix used
  `display: table`, which broke ellipsis, sticky and `h-full` (RX#926/#2783/#3247). We
  measure `scrollWidth/Height` of the viewport and only use observers as *triggers*:
  ResizeObserver on viewport, Content and Content's direct children, plus a
  MutationObserver on Content. A deeper descendant that widens without resizing a
  direct child is the known ceiling (`measure()` is the escape hatch).
- **Negative scroll ranges**: RTL horizontal and `column-reverse` / `row-reverse`
  report `scroll{Left,Top}` from 0 to −max. Work in physical coordinates with
  `min = reversed ? −max : 0`.
- **Measuring before hydration** produces flashes and wrong tab stops (BU#3829, #4103,
  #4205).
- **Listeners outside the component** leak (RX#1973, BITS#2116, BITS#2121); `body`
  style changes stick (BITS#1900).
- **Scroll snap** quantises programmatic positions during drags (Base UI).
- **Touch**: a full-track `touch-action: none` blocks page pans (BU#2825); iOS scroll
  events are async, so the custom thumb lags (BU#3185).
- **Hidden inputs** inside (ARK#3705, RX#3588).

## Testing notes

- jsdom has no layout: `scrollHeight` etc. are 0. The model test drives the machine's
  measured facts through a fake `scroll-metrics` capability; geometry, wheel, drag and
  tab-stop rules run in Vitest browser mode (real layout, real `scroll` events, RTL and
  `column-reverse`).
- Pointer steps from add-slider's `test-drivers` (`box()`, `pointer(phase, { at })`)
  drive thumb drags and track presses.
- axe `scrollable-region-focusable` must pass in every story; a story with a button-only
  content must have **no** viewport tab stop.
- Driver: locate by region name or by contained text; actions `focusViewport`,
  `scroll(axis, to)`, `dragThumb(axis, fraction)`, `pressTrack(axis, side)`, `hover`;
  queries `hasOverflow(axis)`, `isScrollbarVisible(axis)`, `atStart/atEnd(axis)`,
  `isTabStop()`.

## Decisions

- **Parts**: `Root`, `Viewport`, `Content`, `Scrollbar` (`orientation`), `Thumb`,
  `Corner`. Content is explicit and required for re-measuring (no implicit wrapper, no
  `display: table`).
- **Native scroll stays**: the viewport is a normal `overflow: auto` scroller; we never
  intercept keys, never `preventDefault` touch on the viewport, never smooth-scroll in
  JS. Hiding native scrollbars and `overflow: auto` come from **one injected rule** in an
  anonymous cascade layer with the environment's CSP nonce (`textContent`, not
  `innerHTML`), so any consumer rule wins (e.g. native bars under forced colors).
  `scrollbar-width: none` plus `::-webkit-scrollbar { display: none }` for Safari < 18.2.
- **Tab stop rule**: `tabindex="0"` iff measured ∧ some axis overflows ∧ no tabbable
  descendant; kept while the viewport is focused; consumer `tabIndex` wins. Tabbability
  uses the same sequential-order helper as focus containment (request to
  add-overlay-infrastructure to export it).
- **Role**: none; `role="region"` when `aria-label`/`aria-labelledby` is given; dev
  warning for an unnamed tab-stop viewport.
- **Machine** (`idle | engaged | lingering | dragging`), type-agnostic; `type` (`hover`
  default, `scroll`, `auto`, `always`) and `hideDelay` (600 ms) decide visibility in
  connect. Scroll end is a 100 ms delayed transition; hide is `hideDelay`. Both through
  the scheduler. `glimpse` (Reka) not adopted.
- **Measurement in `core/dom/scroll-metrics.ts`**: reads in one pass, writes thumb size
  and offset and overflow-edge variables directly (no snapshot per frame), and sends
  `METRICS` to the machine only when a discrete fact changes (overflow per axis, edges,
  tabbable content).
- **Drag** via add-slider's `pointer-drag`: track = surface, `grabOffset` = press − thumb
  centre, `inset` = half the thumb; logical fraction → physical (vertical `1 − f`, RTL
  `1 − f`), → scroll position. Snap disabled during drag. Moves never enter the machine.
- **Track press**: `page` (default, one viewport length toward the press, native
  behaviour) or `jump` (centre then drag); mouse/pen only.
- **Wheel over a scrollbar**: forwarded on the scrollbar element; never with `ctrlKey`;
  at an edge it chains unless the viewport's `overscroll-behavior` on that axis is
  `contain`/`none`; horizontal bar uses `deltaX || deltaY`.
- **`data-*`**: Root `data-hovering`, `data-scrolling`, `data-overflow-x/-y`,
  `data-overflow-{x,y}-{start,end}`; Scrollbar `data-orientation`, `data-state`
  (`visible|hidden`), `data-scrolling`, `data-dragging` (its axis only), `data-hovering`;
  Thumb `data-orientation`, `data-dragging`; Corner `data-state`. CSS vars
  `--rind-scroll-area-thumb-size/-offset`, `--rind-scroll-area-corner-width/-height`,
  `--rind-scroll-area-overflow-{x,y}-{start,end}`.
- **Contract**: actions/queries as in Testing notes; traits `directional`; invariants:
  tab-stop rule, hidden parts never focusable, `data-dragging` on at most one axis.
- **Deliberately different**: explicit tab-stop rule (vs. always / never / both-axes);
  no `display: table`; no document-level wheel listener; no `body` style changes; no
  presence remounting of thumbs; overflow judged from computed `overflow`; reversed
  ranges normalised; Content `position: relative`.

## Open questions

- Scroll-driven animations (`animation-timeline: scroll()`, Chrome 115, Safari 26,
  Firefox preview) could position the thumb in CSS with zero JS per frame; revisit when
  Firefox ships.
- Native bars on touch devices (BU#3185): a documented layered-CSS recipe, or a prop?
- Press-and-hold repeat paging on the track (native behaviour) — wait for demand.
