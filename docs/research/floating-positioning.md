# Floating positioning — research

Status: done · Wave: 1 (infrastructure; first consumers Select, Menu / Context Menu, Tooltip — see [0002](../decisions/0002-architecture.md#build-order))

Covers how an anchored popup is **placed** next to its anchor and kept there:
placement, offsets, collision avoidance (flip / shift / size), arrow, hiding
when the anchor is hidden, tracking (scroll, resize, layout shift), virtual
anchors (pointer, caret, text selection), RTL, positioning strategy, the
first frame, CSS variables for sizing and animation, the visual viewport
(pinch-zoom, on-screen keyboard), iframes, shadow roots, top layer. Consumers:
Popover, Tooltip, Hover Card, Menu, Context Menu, Menubar, Select, Combobox,
Navigation Menu, Date Picker, Color Picker, Tour, Mentions, Citation.

Layering (portal, stack, dismiss, focus) is
[overlay-infrastructure.md](overlay-infrastructure.md); this note only places
pixels. [0002](../decisions/0002-architecture.md) fixes the engine:
`@floating-ui/dom` (latest 1.8.0, 2026-07-11). Everything around it is ours.

Sources read (shallow clones; React Aria files fetched from `main` because the
local clone is sparse):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/utilities/popper/src/{get-placement,middleware,get-styles,get-anchor,types}.ts`; callers in `machines/{menu,select,combobox,tooltip,popover,tour,date-picker,color-picker}/src/*.machine.ts` |
| Radix (Reka is a line-by-line Vue port) | `radix/packages/react/popper/src/popper.tsx`, `popper.test.tsx`; `reka-ui/packages/core/src/Popper/PopperContent.vue` |
| Base UI | `base-ui/packages/react/src/internals/useAnchorPositioning.ts` (853 lines), `utils/{hideMiddleware,adaptiveOriginMiddleware,CommonPositionerCssVars,useAnchoredPopupScrollLock}.ts`, `internals/constants.ts`, `*/positioner/*.tsx`; commit history of the hook (60 PRs) |
| React Aria | `packages/react-aria/src/overlays/{useOverlayPosition,calculatePosition,useCloseOnScroll,usePopover}.ts` |
| Headless UI | `packages/@headlessui-react/src/internal/floating.tsx` |
| Ariakit | `packages/ariakit-react-components/src/popover/popover.tsx` |
| Kobalte | `packages/core/src/popper/popper-root.tsx` |
| Bits UI | `src/lib/bits/utilities/floating-layer/use-floating-layer.svelte.ts` |
| Floating UI | release notes 1.7.5 → 1.8.0; issue tracker |

## Pattern

- WAI-ARIA APG pattern: none — positioning is visual. It must not change the
  accessibility tree, DOM order or focus order (those belong to portal and
  focus management).
- WCAG criteria it serves: **1.4.10 Reflow** (popups usable in a 320 CSS px
  viewport — accessibility rule 28), **1.4.4 Resize Text**, **2.4.11 Focus Not
  Obscured (Minimum)** (a popup must not hide the focused anchor), **1.4.13
  Content on Hover or Focus** (placement must leave the trigger reachable so
  hover content can be dismissed/hovered).
- Keyboard: none of its own. Requirement on it: a popup opened with the
  keyboard is placed *before* focus moves into it (no scroll jump).

## How the others built it

### Zag / Ark (`@zag-js/popper`)

- API: `getPlacement(anchor, positioner, options) → cleanup`, called from a
  machine **effect** in the open state (`trackPositioning`) and from a
  `reposition` action. Options: `placement`, `strategy` (default `absolute`),
  `gutter` (8), `shift`, `offset`, `flip` (bool or fallback list), `slide`,
  `overlap`, `sameWidth`, `fitViewport`, `overflowPadding` (8), `arrowPadding`,
  `boundary`, `listeners` (autoUpdate options), `hideWhenDetached`,
  `getAnchorElement` / `getAnchorRect` (virtual), `updatePosition` (custom),
  `onComplete` (writes `currentPlacement` to context).
- Middleware order: offset → flip → shift(limitShift) → arrow → shiftArrow →
  transformOrigin → size → hide → rects.
- Writes **CSS variables imperatively** on the positioner: `--x`, `--y`,
  `--reference-width/height`, `--available-width/height`, `--transform-origin`,
  `--z-index`; arrow gets `top/left` and `[side]: calc(100% + var(--arrow-offset))`.
  `getPlacementStyles()` (spread by connect) sets `position`, `top:0; left:0`,
  `transform: translate3d(var(--x), var(--y), 0)`, `min-width: max-content`,
  and parks the positioner at `translate3d(0,-100vh,0)` until a placement exists.
- Notable: coordinates rounded to device pixels (`roundByDpr`); a CSS var is
  only rewritten when it changed by ≥ 0.5 px (fewer style recalcs on scroll,
  zag#2904); content z-index measured once, not per update; `defer: true`
  waits one frame so the positioner exists; middleware rebuilt only when the
  floating node changes. Context menu: anchor = 0×0 rect at `anchorPoint`,
  `listeners: false` (a point never moves). Submenus: `right-start`/`left-start`
  by direction, gutter 0.
- Problems: boundary resolved once at middleware creation, so a late-mounted
  boundary is ignored (zag#3119); forced reflows while scrolling (zag#2904 →
  `sizeMiddleware: false` escape hatch); "Select not repositioned on resize"
  (zag#1212); Ark: portal inside sticky ancestor misplaced (ark#3504), menu
  first open after SSR lands top-left (ark#1104), context menu with `asChild`
  never positions (ark#3636), horizontal placement flips to the other
  horizontal side instead of going vertical on mobile (ark#4160).

### Radix (Reka, and Bits' floating-layer copy it)

- API: `Popper` / `PopperAnchor` (element or `virtualRef`) / `PopperContent`
  (`side`, `sideOffset`, `align`, `alignOffset`, `arrowPadding`,
  `avoidCollisions`, `collisionBoundary`, `collisionPadding` (0), `sticky`
  (`partial` | `always`), `hideWhenDetached`, `updatePositionStrategy`
  (`optimized` | `always` = rAF loop), `onPlaced`) / `PopperArrow`.
- Strategy **`fixed`** by default ("so users don't have to pick and we also
  avoid focus scroll issues"); Reka exposes `positionStrategy`, Bits `strategy`.
- Middleware: offset(sideOffset + arrowHeight) → shift(limitShift unless
  sticky=always) → flip → size (writes `--radix-popper-available-*`,
  `--radix-popper-anchor-*`) → arrow → transformOrigin → hide.
- First frame: wrapper at `translate(0, -200%)` and **content `animation:
  none` until `isPositioned`**, so enter animations don't start from the wrong
  side. Arrow hidden when it cannot be centred (`centerOffset !== 0`).
- `dir` copied onto the portalled wrapper because Floating UI reads RTL from
  the element's own `dir`.
- Problems: many Popper-based components on one page → "Maximum update depth
  exceeded" from an effect without deps that set state (radix#3858); anchor in
  a fixed header detaches on scroll with `absolute`-era code (radix#781);
  content overflows a short viewport because nothing caps its height
  (radix#3492); `--radix-popper-available-width` not updated when the viewport
  grows back (radix#2019); context-menu transform-origin only ever top-left /
  top-right (radix#3066, open); scrollable menu: occluded submenu stays
  visible (radix#3237); RTL Select content misaligned (radix#2172); align
  switched from flip to shift in 1.0 with no way back (radix#1568); arrow off
  centre under `scale` animation in Safari ≤ 15.3 (radix#800).

### Base UI (`useAnchorPositioning`, Positioner parts)

- API on every `*.Positioner`: `anchor` (element | ref | virtual | function),
  `positionMethod` (`absolute`), `side` (incl. logical `inline-start`/
  `inline-end`), `sideOffset` / `alignOffset` (number or function of
  `{side, align, anchor, positioner}`), `align`, `collisionBoundary`
  (`clipping-ancestors`), `collisionPadding` (5), `sticky`, `arrowPadding` (5),
  `disableAnchorTracking`, `collisionAvoidance` `{ side: flip|shift|none, align:
  flip|shift|none, fallbackAxisSide: start|end|none }` — defaults differ per
  family: `POPUP_COLLISION_AVOIDANCE` (fallback axis `end`) for popovers and
  tooltips, `DROPDOWN_COLLISION_AVOIDANCE` (fallback axis `none`) for scrollable
  lists (menu, select, combobox) because they should cap their height rather
  than jump to the side axis.
- Output: `data-side`, `data-align`, `data-anchor-hidden`, CSS vars
  `--available-width/height`, `--anchor-width/height`, `--transform-origin`,
  `--positioner-width/height` (size animations, Navigation Menu).
- Notable, each one born from a bug:
  - shift/flip order depends on alignment (centred → shift first, aligned →
    flip first) per Floating UI's guidance;
  - **1 px bias toward the preferred side applied to `flip()` only** — an input
    centred by the iOS keyboard otherwise flips its popup upward; the bias once
    leaked into shift/size and made `--available-height` 1 px short
    (base-ui#5143);
  - **seeds `--available-width: 100vw; --available-height: 100vh`** so a
    consumer's `max-height: min(20rem, var(--available-height))` is valid on the
    first pass; without it `flip()` measured the uncapped list and chose the
    wrong side (base-ui#5118 / #5120);
  - **unpositioned = `position: fixed; top: 0; left: 0; opacity: 0`**, never
    stale coordinates from a previous open or a 0×0 measurement — stale coords
    overflowed the layout viewport and made mobile Chrome zoom the page out
    (base-ui#5299); opacity rather than `visibility` because visibility breaks
    focus (base-ui#3975);
  - fixed until positioned prevents `autoFocus` scroll jumps (#3250);
  - `--anchor-width` snapped to the device-pixel grid (#4082);
  - `shift()` uses Floating UI's **`layoutViewport`** root boundary for
    Navigation Menu and root Context Menu so pinch-zoom doesn't drag the popup
    around; `flip()`/`size()` keep the visual viewport so the keyboard is still
    avoided (#4485);
  - `data-anchor-hidden` also true when the anchor has no layout box
    (`display: none` → 0×0 at 0,0) (#3267);
  - `disableAnchorTracking` must also drop ancestor-scroll updates (#5478);
  - `lazyFlip` locks the flipped side while a filterable popup resizes (#5372);
  - context menu uses `fixed`; submenus allow cross-axis shift.
- Open problems: combobox flip → "ResizeObserver loop completed with
  undelivered notifications" (base-ui#5831); popup opened inside a Dialog
  whose enter animation scales → measured wrong / RO loop (#5805); moving
  virtual anchor never re-tracked (#4534); local portal briefly scrolls its
  ancestor and flickers (#5829); Positioner moves while arrowing through a
  menu partly off-screen (#1432); request for side lock on open (#3656);
  request to omit Positioner for CSS anchoring (#1663); imperative
  `updatePosition()` request (#5347); `alignItemWithTrigger` inconsistent at
  non-100 % browser zoom (#4290); `side="bottom"` with `--available-height`
  sized popup goes right because "right has more room" (#4159).

### React Aria (`useOverlayPosition` + `calculatePosition`) — its own engine

- API: `placement` (`bottom start`, `end top`, … logical, translated by
  locale), `offset`, `crossOffset`, `containerPadding` (12), `shouldFlip`,
  `boundaryElement` (body), `scrollRef`, `maxHeight`, `arrowSize`,
  `arrowBoundaryOffset`, `getTargetRect` (virtual), `onClose`.
- Why not Floating UI: the engine predates it (2020) and does things a
  middleware pipeline doesn't express directly — it **writes `top/left/bottom/
  maxHeight` synchronously in a layout effect** ("so we don't have to delay
  autoFocus scrolling or delay applying preventScroll"), computes `maxHeight`
  against the boundary *and* `visualViewport`, anchors from the bottom when
  placed on top (`bottom:` instead of `top:` so growth goes upward), and keeps
  the focused item's scroll offset stable across a reposition (scroll anchor).
  It handles containing blocks (`transform`, `will-change`, `contain`) itself.
- Tracking: window resize, ResizeObserver on overlay and target, visualViewport
  `resize`/`scroll` (iOS keyboard) with a 500 ms "is resizing" window during
  which scroll doesn't close; **skips updates while pinch-zoomed differently
  from when it opened** (`visualViewport.scale !== lastScale`).
  `useCloseOnScroll`: non-modal popovers **close** when an ancestor of the
  trigger scrolls (ignoring inputs, whose caret scrolls).
- Problems: popover shifts when the iOS address bar shows/hides (rsp#2343),
  Android keyboard leaves combobox popover behind (rsp#4088), enter animation
  prevented the first positioning entirely (rsp#8781), trackpad zoom drift
  (rsp#5757), wrong `top` inside a native `<dialog>` after page scroll
  (rsp#4539), `scrollbar-gutter: stable` from scroll lock offsets `left`
  placements (rsp#10131, open; #9199), popover outgrows the window when its
  content grows (rsp#7732, open), fast sweep across PreviewTriggers leaves one
  unpositioned top-left (rsp#10680, open), custom boundary: page scroll skews
  flipping (rsp#10639, open).

### Headless UI (`anchor` prop)

- API: `anchor="bottom start"` or `{ to, gap, offset, padding }`; values may be
  CSS lengths/vars (`--anchor-gap`, `--anchor-offset`, `--anchor-padding`,
  `--anchor-max-height`) resolved to px by reading computed style. `to:
  "selection"` aligns the selected option over the button (macOS-style) with
  Floating UI's `inner` middleware (deprecated upstream).
- `strategy: absolute`, **`transform: false`** (top/left — no blurry text, no
  containing block for fixed descendants), offset → shift → flip → size
  (`max-width/max-height` inline, `overflow: auto`). A MutationObserver rounds
  fractional `max-height` up to avoid a 1 px scrollbar.
- Problems: CSS `zoom` on body misplaces options (headlessui#3447);
  `--button-width` wrong while a parent animates (headlessui#3598); options
  width flickers (headlessui#3834, open).

### Ariakit, Kobalte

- Ariakit `Popover`: Zag-like options (`gutter`, `shift`, `flip`, `slide`,
  `overlap`, `sameWidth`, `fitViewport`, `fixed`, `getAnchorRect`,
  `updatePosition`), CSS vars `--popover-*`. Two lessons worth copying:
  **every pass is cancellable** — `autoUpdate` cleanup doesn't abort an
  in-flight `computePosition`, so stale results are dropped before any write;
  and **focus enters only after the first placement** (`unstable_placing`,
  ariakit#7625) to prevent scroll jumps. It re-reads the content z-index for
  two frames because it can change after mount.
- Kobalte: Zag's option set on Solid; `--kb-popper-*` vars.

### Floating UI itself

- `computePosition` is **async** (a promise per pass) — results must be
  checked for staleness.
- `autoUpdate(reference, floating, update, { ancestorScroll, ancestorResize,
  elementResize (ResizeObserver), layoutShift (IntersectionObserver on the
  reference), animationFrame })`. It does **not** listen to `visualViewport`.
- 1.8.0: `rootBoundary: "layoutViewport"` (stable under pinch-zoom and the
  on-screen keyboard, honours `scrollbar-gutter: stable`); autoUpdate refreshes
  layout-shift observer on root resize; explicit-`undefined` options accepted
  under `exactOptionalPropertyTypes` (we need that).
- Top layer: `isTopLayer` checks `:popover-open` / `:modal`; elements in the
  top layer have the viewport as containing block, so **`absolute` gives wrong
  collisions there** (floating-ui#2781); regression in `clippingAncestors` for
  top-layer elements (#3410); `isTopLayer` slow on WebView2 at 135 % scaling
  (#3502); RTL + native popover + `transform` misplaced (#3418, #3221).

## Accessibility

Applying [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md) to positioning:

- **Reflow / 320 px (rule 28).** Collision avoidance is on by default; `size`
  always runs and exposes `--rind-available-width/height`; the theme caps
  popups with `max-width: var(--rind-available-width)` /
  `max-height: min(<x>, var(--rind-available-height))` and scrolls inside. The
  default collision padding (8 px) leaves room for a 24 px target outside the
  popup to dismiss it on touch. Scrollable lists cap height instead of jumping
  to the perpendicular axis (Base UI dropdown default).
- **Resize text (200 %).** Floating and anchor size changes are tracked with
  ResizeObserver; browser zoom changes device-pixel rounding, so rounding uses
  the live `devicePixelRatio` (base-ui#4290, #4082).
- **Focus not obscured (2.4.11).** Default collision avoidance never shifts the
  popup over its anchor on the side axis (no `overlap` unless asked); a
  tooltip or hover card therefore never covers the focused trigger.
- **No scroll jump on keyboard open.** Initial focus moves only after the first
  placement is written; until then the popup sits at the viewport origin with
  `position: fixed` and opacity 0 (Ariakit #7625, Base UI #3250, React Aria's
  synchronous write). Opacity, not `visibility`/`display`, so the element stays
  focusable (base-ui#3975).
- **Hidden anchor.** When the anchor scrolls out of its clipping container we
  expose `data-anchor-hidden`; content that contains focus is never hidden by
  positioning (a keyboard user would lose their place); the component decides
  whether to close.
- **Pinch-zoom (low-vision users).** Positioning must not follow the visual
  viewport while the user zooms — shift against the layout viewport (Base UI
  #4485, FU 1.8 `layoutViewport`; React Aria skips updates at a new scale).
  Flip/size keep the visual viewport so the on-screen keyboard is avoided.
- **Screen magnifiers** (ZoomText/Fusion ≈ 2–3 % of AT users) follow focus;
  placement adjacent to the anchor keeps the popup in the magnified area — a
  reason not to centre popups on the viewport on small screens by default.
- **Motion.** Positioning never animates coordinates itself; it provides
  `--rind-transform-origin` and holds enter animations until placed (Radix:
  `animation: none` until positioned) so a reduced-motion theme can drop them
  without touching JS.
- **RTL.** Logical sides (`inline-start`/`inline-end`) and `start/end` align
  resolve against the anchor's direction; the portalled positioner carries
  `dir` (Floating UI reads the element's own direction). Submenus open to the
  inline end.
- **Forced colors.** The arrow is a real element (theme draws it with
  border/SVG `currentColor`), not a box-shadow, so it survives
  `forced-colors: active`.
- **Native.** CSS anchor positioning (Baseline 2026-01: Chrome/Edge 125,
  Firefox 147, Safari 26) cannot do arrows, shift/sliding, virtual anchors or
  tell JS which fallback won (needed for `data-side` and transform-origin) —
  see [native-platform.md §4](native-platform.md). It changes nothing in the
  accessibility tree either way.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3858](https://github.com/radix-ui/primitives/issues/3858) | "Maximum update depth exceeded" with 50+ tooltips/menus on a page | Every anchor `setState` in a dep-less effect on mount | Callback ref instead of effect | Closed instances do **zero** positioning work; tracking starts in the open state only |
| Zag | [#2904](https://github.com/chakra-ui/zag/issues/2904) | Forced reflows and style recalcs on every scroll | size middleware + style writes + z-index read per update | Write vars only on ≥0.5 px change; z-index once; `sizeMiddleware:false` | Skip unchanged writes; never read computed style per pass |
| Zag | [#3119](https://github.com/chakra-ui/zag/issues/3119) | Late-mounted boundary ignored | Boundary resolved once at middleware creation | Resolve lazily per pass | Options are read live on every pass |
| Zag | [#1212](https://github.com/chakra-ui/zag/issues/1212) | Select not repositioned on window resize | Listener missing | autoUpdate listeners | Resize is a tracked input |
| Ark | [#1104](https://github.com/chakra-ui/ark/issues/1104) | First open after SSR appears top-left | Positioning not started after hydration | Fixed | Positioning starts on open, client-only; never SSR coordinates |
| Ark | [#3504](https://github.com/chakra-ui/ark/issues/3504) | Tooltip in sticky container misplaced | Strategy/containing-block mismatch | Closed | Auto-select `fixed` for anchors in fixed contexts; browser test with sticky/fixed anchors |
| Ark | [#4160](https://github.com/chakra-ui/ark/issues/4160) | Horizontal popover flips to the other horizontal side on mobile when vertical has room | Fallback list only on the same axis | Closed (fallback config) | Perpendicular-axis fallback, configurable per component family |
| Radix | [#781](https://github.com/radix-ui/primitives/issues/781) | Popover from a fixed header detaches on scroll | `absolute` coordinates while anchor is fixed | Radix moved to `fixed` by default | Same as Ark#3504 |
| Radix | [#3492](https://github.com/radix-ui/primitives/issues/3492) | Long popover cut off by short viewport | No height cap by default | Consumer CSS | Theme caps with `--rind-available-height`; scenario at 320×480 |
| Radix | [#2019](https://github.com/radix-ui/primitives/issues/2019) | `--available-width` stale after viewport grows | Update not triggered when constrained element can't grow | Closed | Viewport resize always recomputes, independent of element resize |
| Radix | [#3066](https://github.com/radix-ui/primitives/issues/3066) | Context menu transform-origin only top-left/top-right | Origin from side only; zero-size anchor + shift | Open | Origin computed from the anchor point, corner-aware |
| Radix | [#3237](https://github.com/radix-ui/primitives/issues/3237) | Submenu stays visible when its item scrolls out of the menu | `hide` checked viewport, not clipping ancestors | Default boundary for hide = clipping ancestors | Anchor-hidden detection uses clipping ancestors |
| Radix | [#2172](https://github.com/radix-ui/primitives/issues/2172) | RTL Select content misaligned | Portalled node lost `dir` | `dir` on wrapper | Positioner carries resolved `dir` |
| Radix | [#1568](https://github.com/radix-ui/primitives/issues/1568) | Align no longer flips start↔end | Changed shift/flip policy | Won't fix | Align-axis policy is an option (`flip`/`shift`/`none`) |
| Radix | [#800](https://github.com/radix-ui/primitives/issues/800) | Arrow off-centre during scale animation (Safari) | Measuring arrow in a scaled ancestor | Safari 15.4 | Arrow measured on positioner, animation on content; positioner never transformed by consumers |
| Base UI | [#5118](https://github.com/mui/base-ui/issues/5118) / [#5120](https://github.com/mui/base-ui/pull/5120) | Combobox opens upward with room below | `--available-height` undefined on pass 1 → `max-height` invalid → uncapped measure → flip | Seed vars with `100vw/100vh` | Seed size vars before the first pass |
| Base UI | [#5299](https://github.com/mui/base-ui/pull/5299) | Mobile Chrome zooms out / popup misplaced on reopen | Stale coords from previous open or 0×0 measure overflow layout viewport | Unpositioned = fixed at viewport origin | Never reuse coordinates across opens |
| Base UI | [#3958](https://github.com/mui/base-ui/issues/3958) / #3975 | Flash at origin before positioned | Visible before first pass | `opacity: 0` (not visibility — focus) | Hidden-but-focusable until placed |
| Base UI | [#5143](https://github.com/mui/base-ui/pull/5143) | Collision padding 1 px off on preferred side | iOS-keyboard bias leaked into shift/size | Bias only in flip | Preferred-side bias applies to the flip decision only |
| Base UI | [#4485](https://github.com/mui/base-ui/pull/4485) | Popup drifts while pinch-zooming | shift against visual viewport | `layoutViewport` for shift | shift → layout viewport; flip/size → visual viewport |
| Base UI | [#3267](https://github.com/mui/base-ui/pull/3267) | `data-anchor-hidden` false for `display:none` anchor | 0×0 rect at origin not treated as hidden | Treat as hidden | Anchor without a box = hidden |
| Base UI | [#5478](https://github.com/mui/base-ui/pull/5478) | `disableAnchorTracking` still follows scroll | Option dropped in a refactor | Restored + test | Each tracking input has its own test |
| Base UI | [#5831](https://github.com/mui/base-ui/issues/5831) | "ResizeObserver loop completed" on every flip | size write resizes the observed floating element in the same frame | Open | Self-resize updates coalesce to the next frame; tests fail on window `error` |
| Base UI | [#5805](https://github.com/mui/base-ui/issues/5805) | Combobox inside scaling Dialog misplaced / RO errors | Measured inside an animating transform | Open | Recompute when ancestor animations/transitions end |
| Base UI | [#4534](https://github.com/mui/base-ui/issues/4534) | Moving virtual anchor not tracked | Virtual anchors can't be observed | Open | Virtual anchors: explicit `reposition()` or frame tracking |
| Base UI | [#1432](https://github.com/mui/base-ui/issues/1432) | Menu jumps while arrowing items | Highlight scroll → reposition re-runs shift | Open | Content-internal scroll doesn't reposition; side locked while open for lists |
| Base UI | [#3656](https://github.com/mui/base-ui/issues/3656) | Popover jumps sides as content changes | Flip re-evaluated on every resize | Open (feature) | `sideLock: "open"` |
| Base UI | [#4290](https://github.com/mui/base-ui/issues/4290) | Item-aligned Select inconsistent at browser zoom | Sub-pixel rounding at non-integer DPR | Fixed | Round with live DPR; tests at DPR 1.25 |
| Base UI | [#5829](https://github.com/mui/base-ui/issues/5829) | Opening in a local portal scrolls ancestor, flickers | Focus/layout before placement inside scroll container | Open | Same as "placed before focus" |
| React Aria | [#8781](https://github.com/adobe/react-spectrum/issues/8781) | Popover never positioned during enter animation | Position skipped while animating, no retry | Fixed | Every open gets a pass after animations settle |
| React Aria | [#2343](https://github.com/adobe/react-spectrum/issues/2343), [#4088](https://github.com/adobe/react-spectrum/issues/4088) | iOS address bar / Android keyboard misplace popup | Layout vs visual viewport | visualViewport listeners | Track `visualViewport` resize/scroll |
| React Aria | [#5757](https://github.com/adobe/react-spectrum/issues/5757) | Trackpad zoom drifts popover | Followed visual viewport | Skip at new scale | See Base UI #4485 |
| React Aria | [#4539](https://github.com/adobe/react-spectrum/issues/4539) | Wrong `top` inside native `<dialog>` after scroll | Top-layer containing block | Fixed | Floating in top layer → `fixed` |
| React Aria | [#10131](https://github.com/adobe/react-spectrum/issues/10131) | Left placement offset by `scrollbar-gutter: stable` | ICB vs viewport coordinate mismatch | Open | Recompute after scroll lock; FU 1.8 handles gutter |
| React Aria | [#7732](https://github.com/adobe/react-spectrum/issues/7732) | Popover outgrows window as content grows | Max height not recomputed on own resize | Open | Floating element resize is a tracked input |
| React Aria | [#10680](https://github.com/adobe/react-spectrum/issues/10680) | Preview unpositioned top-left after fast sweep | Pass for a previous anchor won the race | Open | Stale passes dropped; anchor change restarts tracking |
| Floating UI | [#2781](https://github.com/floating-ui/floating-ui/issues/2781), [#3410](https://github.com/floating-ui/floating-ui/issues/3410) | Collisions wrong for `popover`/top layer | Containing block is the viewport | Use `fixed`; fixed regression | Top layer forces `fixed` |
| Floating UI | [#3502](https://github.com/floating-ui/floating-ui/issues/3502) | `computePosition` takes 1 s (WebView2, 135 %) | `getOffsetParent` slow for fixed elements | Fixed | Keep the engine current; a perf test bounds update count and pass time per open popup |
| Floating UI | [#3418](https://github.com/floating-ui/floating-ui/issues/3418), [#3200](https://github.com/floating-ui/floating-ui/issues/3200) | RTL misplaced (native popover; left scrollbar) | Direction/scrollbar side | Fixed | RTL browser tests incl. left scrollbar |
| Floating UI | [#2831](https://github.com/floating-ui/floating-ui/issues/2831), [#2922](https://github.com/floating-ui/floating-ui/issues/2922) | autoUpdate fires every 100 ms when clipped / during content animation | layoutShift IO refresh loop; RO on animating content | Fixed / by design | Watch update counts in a perf test |
| Floating UI | [#3497](https://github.com/floating-ui/floating-ui/issues/3497), HUI [#3447](https://github.com/tailwindlabs/headlessui/issues/3447) | CSS `zoom` misplaces popups | `offsetParent` across zoom boundary | Partly fixed in 1.7; gap open | Document limitation: CSS `zoom` on the floating element with `absolute` |
| Headless UI | [#3598](https://github.com/tailwindlabs/headlessui/issues/3598) | `--button-width` wrong in animating Dialog | Measured during parent scale | Closed | Same as Base UI #5805 |

## Known pitfalls

- **First frame.** Every library had a "flash at the wrong place" bug: render
  hidden-but-focusable at the viewport origin with `fixed`, block enter
  animations until placed, focus only after placement, and never carry
  coordinates over from a previous open.
- **Async passes.** `computePosition` resolves later; close, anchor change or
  unmount in between must discard the result (Ariakit, rsp#10680).
- **Size feedback loops.** `size` → `max-height` → ResizeObserver → `size` …
  produces RO-loop errors (base-ui#5831) and flip oscillation; seed the vars
  (base-ui#5118) and coalesce self-resize to the next frame.
- **Strategy.** `absolute` is cheapest for document-scrolled anchors; `fixed`
  is required in the top layer, for viewport-coordinate virtual anchors
  (context menu) and for anchors inside fixed/sticky contexts. Libraries
  that hard-coded one strategy all got bug reports for the other case.
- **Viewports.** Flip/size against the *visual* viewport (keyboard), shift
  against the *layout* viewport (pinch-zoom); listen to `visualViewport`
  because `autoUpdate` doesn't.
- **Transforms.** Measuring inside an animating `scale` gives wrong rects;
  transforms on the positioner itself become a containing block for
  non-portalled fixed descendants. Consumers animate the content, never the
  positioner.
- **Many instances.** Positioning is only alive while open.
- **Scrollbar gutter / scroll lock** change the viewport rect after the first
  pass → recompute when the layer stack's scroll lock toggles.
- **RTL** depends on the floating element's own `dir`; portals lose it.
- **CSS `zoom`** on ancestors of the floating element remains partially
  broken upstream.

## Top layer: settling the `popover="manual"` spike (positioning side)

[native-platform.md §2](native-platform.md) left open whether floating layers
should be promoted to the top layer with `popover="manual"`. What research
settles here:

1. **Positioning works in the top layer only with `fixed`** — the top layer's
   containing block is the viewport (floating-ui#2781, #3410, rsp#4539).
   Our positioning therefore detects a floating element that is (or is inside)
   a top-layer element (`:popover-open`, `:modal`, fullscreen) and uses
   `fixed` there. This also covers rind popups portalled into a consumer's
   native `<dialog>` (the Portal interop rule in native-platform.md) — needed
   regardless of the spike.
2. **Promotion is all-or-nothing for paint order.** A top-layer popup paints
   above every z-index layer, including a JS Dialog or toast region opened
   *later*. Mixing promoted popups with non-promoted JS dialogs breaks
   "opened later = on top" — exactly the incoherence the open question
   feared. It is only coherent if every rind layer (dialogs and toast region
   included) uses `popover="manual"`, with top-layer order = open order = our
   layer stack, and re-showing the toast region to keep it on top.
3. Remaining blockers are not positioning's: third-party UI (extensions, chat
   widgets) under the top layer (base-ui#485), jsdom having no `popover`.

**Decision (positioning):** positioning is top-layer-safe and never promotes
anything itself. **Recommendation to `add-overlay-infrastructure`:** no
promotion in v1 (portal + z-index for every layer); if promotion is ever
adopted, adopt it for all layers at once.

## Testing notes

- Layout is **only** asserted in Vitest browser mode (Chromium, Firefox,
  WebKit). jsdom has no layout (all rects 0, no ResizeObserver,
  IntersectionObserver or visualViewport): positioning must not throw there,
  must still mark the popup placed (so contract postconditions resolve) and
  contracts expose no geometry.
- Machines are tested in Node with a fake positioning capability that records
  requests and lets the test emit placements (side changes, anchor hidden).
- Browser fixtures: anchors at each viewport edge; 320×480 viewport; scroll
  container with the anchor scrolled out; fixed header and sticky anchors;
  RTL with a left scrollbar; `devicePixelRatio` 1.25 (Playwright
  `deviceScaleFactor`); scroll lock applying a gutter; a scaling parent
  animation; a virtual anchor (pointer point); a portal into a native modal
  `<dialog>`; a window `error` listener that fails the test on
  "ResizeObserver loop".
- What is not automatable: iOS keyboard and pinch-zoom (WebKit in Playwright
  has no software keyboard or real visual-viewport zoom). These go on the
  manual device checklist in assistive-tech-and-a11y-testing.md's style.
- Generic layout invariant (browser only), reusable by every anchored
  component: the floating box lies inside the visual viewport minus collision
  padding (or is capped to it), does not overlap its anchor on the side axis,
  sits on the side it reports in `data-side`, and an arrow, when centred,
  points at the anchor.

## Decisions

- **Engine:** `@floating-ui/dom` behind a small `core/dom/position` module.
  Not our own engine (React Aria's reasons — synchronous write, maxHeight,
  scroll anchor — are covered by: placement before focus, the size vars, and
  leaving scroll anchoring to the collection). Not CSS anchor positioning
  (gaps above); `anchor-name` is still exposed for opt-in CSS (native-platform
  decision) via a manual mode where we write no coordinates.
- **Machine integration:** an injected `position` capability used by a
  state-scoped effect in the open state(s). Discrete results (side, align,
  anchor hidden, placed) come back as one event when they change; continuous
  values (coordinates, available size, anchor size, transform origin, arrow
  offset) are written as CSS custom properties by `core/dom/position`, never
  through the machine (no event per scroll frame). The capability is not part
  of `domEnvironment()` so Dialog-only bundles don't carry Floating UI.
- **Parts:** `positioner` (wraps content, carries coordinates), `arrow`
  (optional). Content and arrow animate; positioner never does.
- **Options** (one shape for every component; component families pick
  defaults): `side` (`top|right|bottom|left|inline-start|inline-end`), `align`
  (`start|center|end`), `sideOffset`, `alignOffset`, `collisionPadding` (8),
  `collisionBoundary` (clipping ancestors), `collisionAvoidance` `{ side:
  flip|shift|none, align: flip|shift|none, fallbackAxis: start|end|none }`,
  `sticky`, `arrowPadding`, `strategy` (`auto|absolute|fixed`), `tracking`
  (`auto|frame|none`), `sideLock` (`none|open`), `inline` (multi-line inline
  anchors), `anchor` (element, virtual rect, point), `mode` (`auto|manual`).
- **`data-*`:** on positioner and content: `data-side` (physical),
  `data-align`, `data-anchor-hidden`, `data-placing` (until first placement).
  Arrow: `data-side`, `data-uncentered`.
- **CSS variables** (prefixed — they inherit into nested popups):
  `--rind-available-width`, `--rind-available-height` (seeded 100vw/100vh),
  `--rind-anchor-width`, `--rind-anchor-height` (DPR-snapped),
  `--rind-transform-origin`; anchors get `anchor-name: --rind-anchor-<id>`.
- **Contract:** a reusable query fragment — `side()`, `align()`,
  `isAnchorHidden()`, `isPlaced()` — read from attributes; geometry only in
  the browser-only layout invariant.
- **Deliberately different:** strategy `auto` instead of one hard-coded
  strategy; no z-index copying (theme styles the positioner); no automatic
  arrow-size offset (explicit `sideOffset`, as Base UI); closed popups cost
  nothing; top-layer-safe without promoting.
- **Out of scope here (owned by component notes):** Select's item-aligned
  mode (Base UI `alignItemWithTrigger`, Radix `item-aligned`, Headless UI
  `selection`), Navigation Menu's viewport size animation vars, closing on
  ancestor scroll (React Aria `useCloseOnScroll`) — component behaviour, fed by
  `data-anchor-hidden`.

## Open questions

None that change the spec. Device verification of the iOS keyboard bias and
pinch-zoom behaviour happens on the manual checklist once Select ships.

## Sources

- Floating UI releases: https://github.com/floating-ui/floating-ui/releases (dom 1.8.0, 2026-07-11)
- CSS anchor positioning support: https://web.dev/blog/web-platform-01-2026 (Firefox 147 → Baseline newly available); [native-platform.md §4](native-platform.md)
- Issues and PRs linked in the tables above.
