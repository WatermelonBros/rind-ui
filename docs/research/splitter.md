# Splitter — research

Status: done · Wave: 3

Resizable panels: two or more panes laid out on one axis, with a focusable handle between
each pair that moves the boundary by pointer drag or keyboard. Shipped by Ark UI (Zag) and
Reka UI; react-resizable-panels (RRP) is the reference implementation both started from
(Zag's `resize-by-delta.ts`, `validate-sizes.ts`, `aria.ts` and Reka's `utils/` carry its
copyright header). The handle is the focusable `separator` of ARIA, the widget meaning that
[separator.md](separator.md) left to this component.

Sources: shallow sparse clones read 2026-10-18 —
`zag/packages/machines/splitter/src/*` (machine 796 lines, connect, `utils/*`),
`reka-ui/packages/core/src/Splitter/*` (`SplitterGroup.vue`, `SplitterPanel.vue`,
`SplitterResizeHandle.vue`, `utils/*`), `react-resizable-panels/lib/*` (v4: `components/`,
`global/event-handlers/*`, `global/mutable-state/*`). Bug history: `gh search issues` over
bvaughn/react-resizable-panels, chakra-ui/zag, chakra-ui/ark, unovue/reka-ui with
`nested`, `iframe`, `RTL`, `touch`, `layout shift`, `pixel`, `pointer capture`, `keyboard`,
`minSize`, `collapsible`, `hydration`, `cursor`, `splitter`; ~120 hits, 30 read in full.

## Pattern

- WAI-ARIA APG: [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/).
  A splitter separates a **primary pane** from a secondary one; its value is the primary
  pane's size.
- Roles and attributes:
  - `role="separator"`, focusable (`tabindex="0"`): the widget meaning of separator.
  - `aria-valuenow` (the primary pane's size; APG uses 0–100), `aria-valuemin`,
    `aria-valuemax` — required for a focusable separator.
  - `aria-controls` → the primary pane.
  - Name: `aria-label` / `aria-labelledby`; APG: "the splitter's accessible name matches
    the name of the primary pane".
  - `aria-orientation`: a **vertical** splitter is the line between panes laid side by side
    (it moves left/right); `horizontal` (the ARIA default) between stacked panes. The
    separator's orientation is therefore the *perpendicular* of the panel axis.
- Keyboard:
  - Left / Right: move a vertical splitter; Up / Down: move a horizontal splitter.
  - Enter: collapse the primary pane if it is not collapsed, else restore the splitter to
    its previous position.
  - Home (optional): primary pane to its smallest size (may collapse it); End (optional):
    to its largest (may collapse the secondary pane).
  - F6 (optional): cycle through window panes.
  - A *fixed* splitter (no continuous resize) supports only Enter, toggling.
- WCAG 2.5.7 Dragging Movements (AA): a drag needs a single-pointer alternative (a
  collapse button, preset sizes). 2.5.8 target size: a thin handle needs an expanded hit
  area ([accessibility.md](accessibility.md) table: `--rind-hit-area`).

## How the others built it

### react-resizable-panels (v4)

- Source: `lib/components/{group,panel,separator}/*`, `lib/global/event-handlers/*`,
  `lib/global/utils/adjustLayoutForSeparator.ts`.
- API: `Group` (`orientation`, `defaultLayout`, `onLayoutChange`, `onLayoutChanged`,
  `disabled`, `resizePreviewMode`), `Panel` (`minSize`, `maxSize`, `defaultSize`,
  `collapsible`, `collapsedSize`, `collapsedThreshold`, `groupResizeBehavior`,
  `disabled`, imperative `collapse/expand/resize/getSize`), `Separator`. `useDefaultLayout`
  persists through `localStorage` or a custom storage.
- State model: module-level mutable state (`mountedAxes`, `interactionState`), document
  listeners installed once per document (`mountAxis.ts`), layouts as `{ [panelId]: % }`.
  Hit regions: a press near a panel edge resizes even without a Separator element.
- Notable:
  - Constraints are numbers = **pixels**, strings without unit = percent, explicit units
    (`px`, `%`, `em`, `rem`, `vh`, `vw`) — and issue #726 shows users read numbers as
    percent.
  - The resize algorithm (`adjustLayoutByDelta`): clamp the delta by the growing side's
    room, shrink panels outward from the pivot until the delta is absorbed (each clamped,
    collapsible ones snapping to `collapsedSize` below the halfway point between collapsed
    and min), grow the pivot by what was absorbed, give any remainder further out, and
    reject the whole step if the total is no longer 100.
  - Keyboard step 5 %; Home/End as `±100` deltas; Enter toggles the primary item with the
    last expanded size (`expandedItemSizes`); F6 cycles **separators**; double click resets
    to `defaultSize`.
  - `aria-orientation` is the perpendicular of the group orientation (correct).
  - Pointer capture is set on the first `pointermove`, not on press, so a click without a
    drag still fires `click` (`onDocumentPointerDown.ts` comment).
  - `pointercancel`, `lostpointercapture`, window `blur` and `pagehide` abort the drag.
  - `onLayoutChanged` fires once per interaction (release), recommended for persistence;
    `onLayoutChange` on every move.
- Problems: see Bug history — most of the tracker is drag-lifecycle and layout-shift bugs
  from the global mutable state and percent/pixel conversion.

### Zag / Ark UI

- Source: `zag/packages/machines/splitter/src/splitter.machine.ts`, `splitter.connect.ts`,
  `utils/*`.
- API: `panels: [{ id, minSize, maxSize, collapsible, collapsedSize }]` on the root,
  `size` / `defaultSize` arrays, `onResize`, `onResizeStart`, `onResizeEnd`,
  `onCollapse`, `onExpand`, `keyboardResizeBy`, `orientation`, imperative
  `setSizes/collapsePanel/expandPanel/resizePanel`. Parts `root`, `panel`,
  `resizeTrigger` (id `"a:b"`), `resizeTriggerIndicator`. Optional `registry` for
  dragging at the intersection of nested splitters.
- State model: `idle | hover:temp | hover | dragging | focused`; context `size`,
  `dragState`, `keyboardState`. Constraints declared on the root are known on the server,
  so the root and panel styles render before hydration.
- Notable: the panel style is `flex: <size> 1 0px` (sizes as flex-grow, basis 0), so the
  handles' widths never break the 100 % total; a ResizeObserver on the root re-resolves
  pixel sizes; Safari does not focus a `div` on press, so the trigger focuses itself in
  `pointerdown`.
- Problems: `aria-orientation` equals the group orientation (the wrong axis); a `focused`
  state that `FOCUS` only enters from `idle` (zag#3223: hover first, then Tab — arrows
  ignored); keyboard step default 1 %, Shift 10 %; F6 cycles triggers.

### Reka UI

- Source: `reka-ui/packages/core/src/Splitter/SplitterGroup.vue` (952 lines),
  `SplitterPanel.vue`, `SplitterResizeHandle.vue`, `utils/*` (RRP v2 port).
- API: `SplitterGroup` (`direction`, `autoSaveId`, `storage`, `keyboardResizeBy` default
  10, `sizeUnit` `%`/`px`), `SplitterPanel` (`defaultSize`, `minSize`, `maxSize`,
  `collapsible`, `collapsedSize`, `order`, `@collapse`, `@expand`, `@resize`),
  `SplitterResizeHandle` (`disabled`, `hitAreaMargins`, `@dragging`).
- State model: panels register on mount (an order prop for conditional panels); layout is
  computed after registration, so the server render has no sizes.
- Notable: `data-state` `drag | hover | inactive` and `data-resize-handle-active`
  `pointer | keyboard` on the handle; stacking-order check so a popover over the handle
  does not start a drag.
- Problems: CSP violation from an injected cursor stylesheet (reka#2003); pixel sizing
  reported percent in events (reka#2481); hover stuck over an iframe (reka#2893, #2968).

## Accessibility

Applying [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md):

- **Role and value**: one focusable `separator` per handle with `aria-valuenow/min/max`.
  `min`/`max` are the primary pane's *effective* bounds — its own constraints narrowed by
  what the other panes can give or take (RRP's `calculateAriaValues`), rounded to whole
  numbers; RRP#740 shows the index bug to avoid (the pivot index, not the tuple index).
  Screen readers read a separator's value as a percentage (NVDA, JAWS: "splitter 30"),
  so the value is a percent of the group, 0–100.
- **Orientation**: perpendicular of the panel axis (RRP right, Zag wrong). Arrows follow
  the visual movement: ArrowRight moves a vertical splitter right, which grows the primary
  pane in LTR and shrinks it in RTL (the primary pane is on the right); ArrowDown moves a
  horizontal splitter down, which grows the top (primary) pane — the opposite of a
  vertical Slider, where Up increases (zag#2417 got this inverted).
- **Name**: the handle has no content; it needs `aria-label` or `aria-labelledby`
  (axe `aria-input-field-name` does not cover separator; a dev warning does).
- **Focus**: the handle is one tab stop each, in DOM order. A press focuses it without a
  ring (`focus-visible` stays keyboard-only), so the keyboard works after a click
  (zag#3090) — Safari does not focus a `div` on press.
- **Disabled**: no tab stop, `aria-disabled="true"`, no drag.
- **Forced colors**: the handle's line must be drawn with a system colour
  (`CanvasText`), and the focus ring with `Highlight`.
- **Motion**: no animation on resize; a collapse is instant (theme may transition only
  outside a drag, and never under `prefers-reduced-motion`).
- **Native platform**: no native splitter. CSS `resize` resizes one element by its corner,
  is not keyboard-operable and exposes nothing; it does not cover this.
- **2.5.7**: the drag needs a single-pointer alternative — the consumer's collapse button
  or preset-size buttons (controlled `sizes`); the docs show one.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RRP | #740 | `aria-valuemin`/`max` swapped on every separator but the first | panel index from `indexOf` on a 2-tuple, always 0 | fixed | compute ARIA bounds from the handle's own pivot index; test 3 panels |
| RRP | #688, #497, #645 | separator stuck active / move events lost when released over an iframe | iframe swallows pointer events; no capture | capture on first move | capture the pointer for the drag; end on `buttons === 0` (pointer-drag does) |
| reka | #2893, #2968 | hover state stuck when the pointer enters an iframe | `pointerleave` never fires into an iframe | fixed | no hover state in the machine; CSS `:hover` only |
| RRP | #760 | drag never ends on `pointercancel` or window blur | v4 rewrite dropped the listeners | fixed | cancel on pointercancel, lost capture, hidden document (pointer-drag) |
| RRP | #723 | right click during a drag leaves panels swallowing events | the drag ended on the secondary button's up | fixed | one pointer id; only its up ends the drag |
| RRP | #446, #135 | dragging the wrong way in RTL | pointer delta not mirrored | fixed | delta from pointer-drag's direction-aware fraction |
| Zag | #2417 | vertical: ArrowUp moves the handle down | key → delta sign inverted | fixed | own key map, tested per orientation and direction |
| Zag | #3223 | hover then Tab: arrows ignored | `FOCUS` handled only in `idle` | fixed | keys need no focus state: guards on props only |
| Zag | #3090, #3263 | click does not focus the trigger; then a regression report about keeping it | Safari does not focus on press | focus on press, ring keyboard-only | focus on press without ring |
| RRP | #751 | separator keeps focus after a drag, arrows go to it | focus on pointerdown | open debate | keep focus (consistent with click); documented |
| RRP | #692, #240, #295 | layout shift on SSR with `defaultSize` | sizes computed after panels register on the client | partly fixed | sizes declared on the Root render on the server: no registration needed |
| RRP | #714 | panels keep `flex-basis` from `defaultSize` after hydration | server and client style shapes differ | fixed | one style shape (`flex-grow`) from the same numbers on both sides |
| RRP | #536 | NaN layout in a hidden container | group size 0 divides | fixed | a 0 size never reaches the math (no layout: constraints in px are skipped) |
| RRP | #720 | pixel `minSize` grows as a percent after a window resize | stored as percent | fixed | re-resolve pixel constraints on every group resize and re-clamp |
| RRP | #726 | numbers are pixels, docs read as percent | ambiguous unit | documented | numbers are percent; pixels only as `"200px"` |
| reka | #2481 | pixel panels reported percent in events | mixed units | open | one unit in events (percent), conversion at the boundary |
| RRP | #707, #709 | a collapsed-on-load panel cannot expand to its default | no remembered size | fixed | expand restores the size before collapse, else `defaultSize`, else min |
| RRP | #650, #629 | collapsible panel jumps while dragging | snapping thresholds | fixed | snap at the halfway point between collapsed and min, model-tested |
| Ark | #3921, zag#3179 | collapses to `minSize`, not `collapsedSize` | wrong field in the style | fixed | one clamp function used by every path |
| Ark | #2967 | crash when a size prop is ignored below `minSize` | sizes validated nowhere | fixed | validate every incoming size array (length, total, constraints) |
| Zag | #3371 | first programmatic collapse emits no `onCollapse` | last-notified map empty | fixed | derive collapse from sizes, no notification cache |
| Ark | #3337 | cannot drag again after a release over the trigger | state left in `hover` | fixed | no hover state; drag starts from any state |
| reka | #2003 | CSP violation from an injected cursor stylesheet | `<style>` injected at runtime | fixed (nonce) | no injected styles; cursor from the theme on `data-dragging` |
| RRP | #727 | panel wrapper forced `overflow:auto`, not focusable (axe) | library-owned scroll container | fixed | no forced overflow; scrolling is the consumer's (Scroll Area) |
| RRP | #543 | nested groups example broken in v4 | global hit regions across groups | fixed | every Root is independent; nested Roots tested |

## Known pitfalls

- **Percent vs pixel**: every library converted pixel constraints at one moment and kept
  the percent; the fix is to resolve pixels against the current group size on every
  resize (RRP#720) and never mix units in callbacks (reka#2481).
- **SSR**: registration-based panels (RRP, Reka) have no sizes on the server — the layout
  shift is structural. Declaring sizes and constraints on the Root removes it.
- **Drag lifecycle**: iframes, `pointercancel`, window blur, secondary buttons — the same
  four bugs in every tracker. `core/dom/pointer-drag` already handles them for the Slider.
- **Hover states** in a machine get stuck (iframes, re-press). CSS `:hover` is enough.
- **Orientation**: two orientations are in play (panel axis, separator line); both
  libraries that ship it got one wrong once.

## Testing notes

- The resize math is pure (sizes in percent, constraints in percent): Node tests and the
  model test's oracle run it without layout.
- Drags need layout: browser mode only; jsdom walks the keyboard (like the Slider).
- The contract reads sizes from each handle's `aria-valuenow` and the panels'
  `data-size` (exact, unrounded strings).
- Driver actions: `step(handle, "increase" | "decrease")`, `toEdge(handle, "min" | "max")`,
  `toggleCollapse(handle)`, `drag(handle, deltaPercent)`; queries `sizes`, `isDragging`,
  `isCollapsed(index)`.

## Decisions

- Parts: `Root` (the group, a flex container), `Panel` (`index`), `Handle` (`index`: the
  boundary after panel `index`). Indices, as Slider's `Thumb`, so the server render knows
  every size.
- Machine states and events: `idle | dragging`. Events `POINTER.DOWN { handle }`,
  `POINTER.MOVE { delta }`, `POINTER.UP`, `DRAG.CANCEL`, `STEP { handle, direction }`,
  `TO_EDGE { handle, edge }`, `TOGGLE { handle }`, `LAYOUT.SYNCED` (constraints changed
  after a group resize), `SIZES.SYNCED` (controlled prop). No hover or focus state.
- Sizes: one controllable `sizes` array in percent of the panels' space (handles excluded),
  rendered as `flex-grow` with a zero basis. Constraints on the Root's `panels` prop:
  numbers are percent, `"Npx"` strings are pixels (resolved against the measured group
  on every resize).
- Resize algorithm: RRP's `adjustLayoutByDelta` (MIT, attributed), keyboard collapse
  rules included.
- `data-*`: `data-orientation`, `data-dragging` (root, panel, the dragged handle),
  `data-state="collapsed|expanded"` on collapsible panels, `data-size` on panels,
  `data-disabled`, `data-focus` / `data-focus-visible` on handles.
- Contract: actions `step`, `toEdge`, `toggleCollapse`, `drag` (pointer/touch with a
  keyboard twin through steps), `pointerDown/Move/Up`, `cancelDrag`; queries `sizes`,
  `isDragging`, `orientation`; trait `valued`, `directional`.
- Deliberately different:
  - Constraints and default sizes on the Root, not on the panels: no SSR shift.
  - Numbers are percent; pixels need a unit (RRP#726).
  - No hover/focused machine states (zag#3223, reka#2893, Ark#3337).
  - No built-in storage: `onSizesCommit` once per interaction is the persistence hook; a
    cookie or storage read into `defaultSizes` keeps SSR stable.
  - No injected cursor stylesheet (reka#2003).

## Open questions

- F6 pane cycling (APG optional): not in v1; the backlog has it.
- Dragging at the intersection of nested splitters (Zag registry, RRP hit regions): v1 has
  one handle per drag.
- `preserve-pixel-size` on group resize (RRP `groupResizeBehavior`): v1 keeps percent,
  re-clamping pixel constraints only.
- Double click to reset (RRP): not in v1.
