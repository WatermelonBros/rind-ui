## Context

`add-foundations` provides the machine runtime (state-scoped effects that can
only `send`, an injected Environment of small capability interfaces,
`domEnvironment()`), connect conventions, contracts and drivers.
`add-overlay-infrastructure` provides the portal (including the rule that
rind content is portalled into a consumer's top-layer element), the layer
stack (`subscribe`), presence and scroll lock. This change adds the geometry
layer between them. The research is in
[floating-positioning.md](../../../docs/research/floating-positioning.md). Its
**Decisions** section is binding unless this document says otherwise.

## Goals / Non-Goals

**Goals:**
- One positioning implementation for every anchored component, configured per
  component family through defaults. No component writes coordinates itself.
- Each lesson in the research's bug history is either a spec scenario or a
  browser test.
- Machines stay testable in Node, and closed popups cost nothing.

**Non-Goals:**
- Hierarchical states, hover intent, the item-aligned Select, and the
  Navigation Menu viewport. Those are decided in their component changes.
- Automating the iOS keyboard and pinch-zoom checks. They go on a manual
  device checklist, because Playwright WebKit can simulate neither.

## Decisions

### 1. Engine: `@floating-ui/dom`, wrapped

| Option | For | Against |
|---|---|---|
| **`@floating-ui/dom` 1.8 (chosen)** | Already allowed (0002). Handles containing blocks, clipping ancestors, the top layer, virtual elements, `inline`, `layoutViewport`. Every library except React Aria uses it, so its bugs get found and fixed upstream. | Async passes (we drop stale results); no `visualViewport` listening (we add it); one more dependency in core |
| Own engine (React Aria `calculatePosition`, about 850 lines) | Synchronous writes, built-in `maxHeight` and scroll anchoring | We would re-live the containing-block, zoom, RTL and top-layer bugs that Floating UI already fixed. Its advantages are covered here by placing before focus, seeding the size variables, and leaving scroll anchoring to the collection |
| CSS anchor positioning | No JavaScript; Baseline 2026-01 | No arrow, no shift, no virtual anchors. JavaScript cannot tell which fallback won, so there is no `data-side` or transform origin. Interop 2026 is still in progress. **Kept as the consumer opt-in `mode: "manual"`**, with anchor names always exposed |

The wrapper (`core/dom/position/`) owns:

- turning our options into a middleware list, in order: `inline?` → `offset` →
  flip/shift (order depends on alignment, per Floating UI's guidance) →
  `size` → `arrow` → transform origin → hide;
- the 1 px preferred-side bias, applied to `flip` only;
- `rootBoundary: "layoutViewport"` for `shift`, and the visual viewport for
  `flip` and `size`;
- writing variables only when they change, with device-pixel rounding;
- cancellation tokens for passes;
- the triggers Floating UI's `autoUpdate` lacks: `visualViewport`, the layer
  stack, and ancestor `animationend` / `transitionend`;
- moving self-resize updates to the next frame.

### 2. How positioning talks to the machine

```ts
// core/env/position.ts
export type Side = "top" | "right" | "bottom" | "left"
export type Align = "start" | "center" | "end"
export interface Placement { readonly side: Side; readonly align: Align; readonly anchorHidden: boolean }

export type AnchorSource =
  | { readonly kind: "part"; readonly part: string }      // resolved through env.dom, like other parts
  | { readonly kind: "virtual"; readonly get: () => VirtualAnchor | null }
  | { readonly kind: "point"; readonly x: number; readonly y: number }

export interface PositionRequest {
  readonly anchor: AnchorSource
  readonly positioner: string                              // part name
  readonly options: () => PositioningOptions               // read live each pass
  readonly onPlacement: (placement: Placement, first: boolean) => void
}

export interface PositionHandle { reposition(): void; stop(): void }
export interface PositionCapability {
  readonly position: { track(r: PositionRequest): PositionHandle; reposition(part: string): void }
}

// core/dom/position/index.ts
export function domPositioning(env: DomEnv & SchedulerEnv & LayerStackEnv): PositionCapability
```

Machine usage, here in the fixture. Real components follow the same pattern:

```ts
effects: {
  trackPosition: ({ env, props, send }) => {
    const handle = env.position.track({
      anchor: { kind: "part", part: "trigger" },
      positioner: "positioner",
      options: () => resolvePositioning(props.positioning, FIXTURE_DEFAULTS),
      onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
    })
    return () => handle.stop()
  },
},
states: { open: { effects: ["trackPosition"], on: { "POSITION.PLACED": { actions: "setPlacement" } } } }
```

- `onPlacement` fires on the first placement of each open, and then only when
  `side`, `align` or `anchorHidden` change. Continuous values go straight to
  CSS. This keeps the machine graph small (one event, no per-frame edges) and
  satisfies the spec's "scrolling does not notify the machine" scenario.
  *Alternative:* store `x`/`y` in context (Zag's `currentPlacement`, React
  state in Radix and Base UI). Rejected: a render or notification per scroll
  frame, which is the root of radix#3858 and zag#2904.
- **Not part of `domEnvironment()`.** Adapters add `domPositioning(env)` only
  for components whose machine type requires `PositionCapability`. The type
  system enforces this, because the machine's `env` type includes the
  capability. *Alternative:* add it to `domEnvironment()`. Rejected: every
  Dialog-only bundle would then carry Floating UI (~10 kB min+gz).
- `reposition()` on the component API (base-ui#5347, #4534) sends
  `POSITION.REPOSITION`. That event's action calls
  `env.position.reposition(positionerPart)`, and the capability looks up the
  tracking it owns for that part. This way no handle has to cross from the
  effect to an action. 
- **Initial focus waits for the first placement.** A component's open state
  runs its focus action on `POSITION.PLACED` with `first: true`, not on entry.
  This is the "placed before focus" rule, and it is visible in the graph.

### 3. Parts, connect helpers and the first frame

```ts
// core/dom/position/connect.ts
export function positionerProps(s: PlacementState, ids: Ids): PartProps   // style + data-* + dir
export function arrowProps(s: PlacementState): PartProps
export function anchorProps(ids: Ids): PartProps                          // anchor-name
```

- `PlacementState = { placed: boolean; side; align; anchorHidden; dir; open }`.
  It lives in each component's context and is set by a shared
  `setPlacement` action.
- The positioner's style before placement is `position: fixed; top: 0;
  left: 0; opacity: 0; pointer-events: none;`, plus the variables
  `--rind-available-width: 100vw` and `--rind-available-height: 100vh`. After
  placement it is `position: <strategy>; top: 0; left: 0; transform:
  translate(var(--rind-x), var(--rind-y))`. Connect emits the seeded variables
  as constant keys on every render. The DOM module overwrites them
  imperatively, so a framework style diff never wipes them (Base UI's
  comment explains the same trap). `--rind-x` and `--rind-y` are internal to
  the positioner style. They are not part of the public contract.
- Content gets `data-placing` while not placed. The theme's base rule
  `[data-placing] { animation: none !important; transition: none !important }`
  is not enough for consumers who skip the theme, so connect also sets
  `animation-name: none` inline on the content while it is placing.
- **Transform, not top/left.** A transform is cheaper per scroll pass and
  matches Zag, Radix and Ariakit. It works because the positioner is
  portalled and never transformed by consumers (Floating UI accounts for
  transformed containing blocks either way). *Alternative:* top/left
  (Headless UI). Rejected: a layout pass per update, for a gain only in
  setups we don't produce.
- No z-index copying. The theme sets `z-index` on `[data-part="positioner"]`
  using the layer stack's `--layer-index`, which comes from the overlay
  change. *Alternative:* copy the content's computed z-index (Zag, Radix,
  Ariakit). Rejected: a `getComputedStyle` per open, rAF re-checks, and a
  hidden coupling.

### 4. Defaults per family

The research shows that families need different defaults. Each component
change picks one preset, or overrides it:

| Preset | side / align | collisionAvoidance | sideLock | tracking | Used by |
|---|---|---|---|---|---|
| `popup` | bottom / center | flip, flip, fallbackAxis `end` | none | auto | Popover, Hover Card, Tooltip (top), Date/Color Picker, Tour |
| `dropdown` | bottom / start | flip, shift, fallbackAxis `none` | open | auto | Select, Combobox, Menu, Navigation Menu |
| `submenu` | inline-end / start | flip, shift, fallbackAxis `none` | none | auto | Menu / Context Menu submenus |
| `pointer` | right / start (point anchor) | flip, flip, fallbackAxis `none` | none | none | Context Menu root |

All presets use `collisionPadding: 8` and `strategy: "auto"`.

### 5. Strategy `auto`

`auto` resolves on each open. It checks, in order:

1. Is the floating element inside the top layer? This uses
   `closest(":popover-open, :modal")` and `document.fullscreenElement`, inside
   a `try` because old engines throw on unknown pseudo-classes.
2. Is the anchor a point, or a virtual element without a context element?
3. Does the anchor have a fixed ancestor? This is a single walk up the
   anchor's ancestors on open, not on every pass.

It does not re-resolve while open. *Alternative:* always `fixed` (Radix).
Rejected: during document scroll, an `absolute` popup moves with the page for
free, while a `fixed` one needs a pass per scroll event to keep up.

### 6. Top layer (`popover="manual"` spike, positioning side)

Settled in the research. Positioning is top-layer-safe through `auto` → `fixed`
and never promotes anything itself. The recommendation to
`add-overlay-infrastructure` is: no promotion in v1, and if promotion is ever
adopted, it applies to all layers at once. No spec in this change depends on
how that change decides.

### 7. Environment usage

- The `dom` capability resolves anchor and positioner parts. Window and
  document are always `ownerDocument.defaultView` of the elements, never
  globals, so iframes and shadow roots work.
- The `scheduler` capability supplies `requestAnimationFrame` for frame
  tracking and for coalescing self-resize updates.
- The layer stack's `subscribe` triggers repositioning when scroll lock
  toggles.
- In Node machine tests, `position` is a fake. `@rind-ui/testing` exports
  `fakePositioning()`, which records requests and offers
  `emit(placement, { first })`.

### 8. Contract and testing

- `positioningQueries` is a contract fragment that component contracts spread.
  It reads `data-side`, `data-align`, `data-anchor-hidden` and the absence of
  `data-placing` from the `positioner` part.
- `@rind-ui/testing` exports `layoutInvariant`. It registers under the trait
  `anchored`, runs only when the adapter reports real layout (browser mode),
  and is skipped elsewhere with a note in the run summary. It never fakes
  rectangles in jsdom.
- Test layers:
  - **Node:** pure helpers (option resolution, logical→physical sides,
    transform-origin maths, presets) and the fixture machine with
    `fakePositioning()`.
  - **Browser (Chromium, Firefox, WebKit):** every spec scenario, on a fixture
    page with these knobs: edge-placed anchors, a 320×480 viewport,
    `deviceScaleFactor: 1.25`, RTL with `scrollbar-gutter`/left scrollbar, a
    fixed header, a sticky anchor, a scroll container, an iframe, a shadow
    root, a native modal `<dialog>`, a scaling-dialog animation and a
    virtual-anchor marker. A global `error` listener fails on "ResizeObserver
    loop". `visualViewport` scenarios use Chromium's CDP
    `Emulation.setPageScaleFactor` and viewport resizes. They are marked
    Chromium-only, and WebKit is covered by the manual device checklist.
  - **jsdom:** the fixture driver's `open()`/`isPlaced()` through
    `@rind-ui/testing/setup`, proving the no-layout path doesn't throw.
  - **Perf:** 200 closed tooltips create no observers. One open popup during
    a 1000 px scroll does at most one pass per scroll event and rewrites
    variables only when they change.
- Model-based: the fixture's graph includes `POSITION.PLACED`. The generic
  invariant "focus enters the popup only after `first` placement" is checked
  on every path.

### 9. Where code lives

```
packages/core/src/env/position.ts            capability types
packages/core/src/dom/position/
  ├─ options.ts      PositioningOptions, presets, resolvePositioning()
  ├─ middleware.ts   our middleware list, transform-origin, hide
  ├─ strategy.ts     auto resolution
  ├─ track.ts        domPositioning(): passes, cancellation, tracking triggers
  └─ connect.ts      positionerProps / arrowProps / anchorProps
packages/core/src/contract/positioning.ts     positioningQueries
packages/testing/src/positioning.ts           fakePositioning, layoutInvariant
packages/testing/fixtures/anchored/           fixture machine, connect, contract, React parts
packages/theme/src/positioner.css             positioner/arrow base rules
```

## Risks / Trade-offs

- [Floating UI changes behaviour in a minor release] → Pin `^1.8.0`, and let
  the browser suite gate dependency bumps.
- [Async passes give one frame of lag on scroll with `fixed`] → `auto` prefers
  `absolute` for document-scrolled anchors. The layout invariant runs during
  scroll in a browser test.
- [CSS `zoom` on ancestors of the floating element with `absolute` is still
  misplaced upstream (floating-ui#3497)] → Documented limitation. `strategy:
  "fixed"` is the workaround.
- [iOS keyboard and pinch-zoom cannot be automated] → Manual device checklist
  before the first Wave 1 release, as for the overlay change.
- [Waiting for placement before focus delays focus by one microtask or frame]
  → Within the budget for an open. React Aria and Ariakit accept the same
  trade.

## Migration Plan

New code; nothing to migrate. Components adopt it in their own changes.
