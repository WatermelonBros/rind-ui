# Floating Panel — research

Status: done · Wave: 3

A Floating Panel is a window inside the page: a titled box the user can **drag** by its header, **resize**
from its edges and corners, **minimise**, **maximise** and close, that stays open while the user works
in the page behind it. Think of a chat popout, an inspector, a debug console, a picture-in-picture
note. It is a **non-modal dialog** with a position and a size. Of the nine libraries only Ark/Zag
ships one (`floating-panel`, Ark `FloatingPanel`). Radix, Base UI, Headless UI, Ariakit, React Aria,
Reka UI, Bits UI and Kobalte have none (searches "floating panel", "window", "draggable", 2026-10-26;
a modal Dialog, a Popover and a Drawer are different things). The reusable pieces on the market
are drag and resize libraries (`react-rnd`, `react-draggable`) with no accessibility model at all.
This note records Zag's design and bug history, the platform facts a window needs (boundaries,
touch, stacking, focus), and the decisions for `add-floating-panel`.

Builds on [dialog.md](dialog.md) (non-modal dialog, the reason-carrying `onOpenChange`, the layer
stack, focus restore, Escape rules), [popover.md](popover.md), [splitter.md](splitter.md) (keyboard
resize of a boundary, `trackPointer` lifecycle), [overlay-infrastructure.md](overlay-infrastructure.md)
(layer stack, portal, presence), [drawer.md](drawer.md) (CSS-variable movement from `dom/swipe.ts`),
and [accessibility.md](accessibility.md) §4 (focus), §6 (keyboard), §10 (hidden content),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes D, H.

Sources read (local shallow clone, 2026-10-26):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/floating-panel/src/{floating-panel.machine,floating-panel.connect,floating-panel.dom,floating-panel.types,floating-panel.anatomy,floating-panel.props,floating-panel.store,get-resize-axis-style}.ts`, `CHANGELOG.md` (1.46.0 at read time) |
| Trackers | chakra-ui/zag and chakra-ui/ark (search "floating panel"); bokuweb/react-rnd and react-grid-layout/react-draggable (searches "touch", "bounds", "keyboard"); "title only" marks issues not opened |
| rind-ui | `core/src/dom/{pointer-drag,layer-stack,non-modal-tab-order,focus-restore,css-zoom,swipe,presence}.ts`, `components/dialog/*` |
| Standards | APG [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) roles for a non-modal dialog; [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) for keyboard resize; WCAG 2.5.7, 2.5.8, 1.4.10 |

## Pattern

- WAI-ARIA APG: a **non-modal dialog**. `role="dialog"` with `aria-labelledby` the title,
  `aria-modal` absent or `false`, no focus trap, no `inert` outside, no scroll lock. The APG has no
  window-manager pattern: moving and resizing a window is not covered, so the keyboard design is
  ours.
- WCAG 2.5.7 Dragging Movements (AA): **everything done by dragging has a single-pointer or
  keyboard alternative**. Moving by the header and resizing by an edge are drags: they need keys.
  Zag moves the panel with the arrow keys when the panel itself is focused; it has **no** keyboard
  resize (the resize triggers have only `onPointerDown`).
- WCAG 2.5.8 Target Size (Minimum): resize edges are thin. A 24 CSS px target (or spacing) applies
  to the corners and, on coarse pointers, the edges.
- WCAG 1.4.10 Reflow and 1.4.4: at a narrow viewport or high zoom a panel larger than the viewport
  must not trap content; its maximum size is the boundary, and **maximise** is the escape hatch.
- WCAG 2.4.3 / 2.4.11 Focus Not Obscured: a panel over the page can hide the focused element behind
  it; the user can move it or close it, and Escape closes the topmost panel.
- Stacking: several panels overlap; the one the user interacts with comes to the front. The panels
  and the page share one z-order (no `aria-hidden` on the page).
- Native: `<dialog>.show()` is the non-modal element, but it brings no position or size model;
  the `popover="manual"` attribute puts an element in the top layer (above a modal dialog). Both are
  considered in Open questions.

## How Zag / Ark built it

- **Anatomy**: `trigger`, `positioner`, `content`, `header`, `body`, `title`, `resizeTrigger`
  (`axis`: `n e s w ne se sw nw`), `dragTrigger`, `stageTrigger` (`stage`: `minimized | maximized |
  default`), `closeTrigger`, `control`.
- **Props**: `open` / `defaultOpen` / `onOpenChange`; `position` / `defaultPosition` /
  `onPositionChange` / `onPositionChangeEnd`; `size` / `defaultSize` / `onSizeChange` /
  `onSizeChangeEnd`; `minSize`, `maxSize`; `draggable`, `resizable`; `lockAspectRatio`;
  `closeOnEscape`; `strategy` (`fixed` default, `absolute`); `allowOverflow` (default true);
  `getBoundaryEl`; `getAnchorPosition` (initial position from the trigger); `gridSize` (snap and
  keyboard step); `persistRect`; `initialFocusEl`, `finalFocusEl`, `restoreFocus`; `disabled`;
  `onStageChange`; `translations` (`minimize`, `maximize`, `restore`).
- **States**: `closed` and `open` with sub-states `idle`, `dragging`, `resizing`. The stage
  (`default | minimized | maximized`) is context, not state; `canDrag` is false while maximised,
  `canResize` only in `default`. The previous position and size are kept to restore.
- **Drag**: the drag trigger's `pointerdown` records the offset; `trackPointerMove` on the document
  sends `DRAG` for every move; the machine clamps against the boundary rect and writes
  `position`/`size` back, then CSS is applied by `setPositionStyle` / `setSizeStyle` (so every
  move goes through machine state; see zag#3005 below).
- **Escape**: in `idle`, Escape closes when `closeOnEscape` **and** the panel is topmost; in
  `dragging` or `resizing`, Escape restores the previous position or size and returns to `idle`.
- **Keyboard**: the Content is `role="dialog"`, `tabIndex=0`. When the Content itself is focused
  (`event.currentTarget === target`), the arrow keys send `MOVE` with a step (`getEventStep` times
  `gridSize`).
- **ARIA**: `role="dialog"`, `aria-labelledby` the title, no `aria-modal`; Trigger has `aria-controls`;
  the close button has a **hard-coded English** `aria-label="Close Window"`; the stage triggers use
  the translations (and `data-stage`).
- **Stack**: a store keeps the open panels; `data-topmost` / `data-behind` on the Content and
  `bringToFrontOfPanelStack` on open and on focus, `removeFromPanelStack` on close.
- **Header**: double-clicking it maximises, or restores when minimised (fixed 1.33.0).
- **Boundary**: `getBoundaryRect` (the viewport, or the element from `getBoundaryEl`); a
  `ResizeObserver` and the boundary's scroll ancestors keep the panel in the boundary
  (1.45.0, below).

## Bug history

| Bug | Where | Cause | Decision |
|---|---|---|---|
| Boundary does not follow scroll: the panel stays at its screen position until moved | [zag#3339](https://github.com/chakra-ui/zag/issues/3339) (read), fixed 1.45.0 | Position was computed once in viewport coordinates | Position is stored relative to the boundary; the boundary's own resize and its scroll ancestors are observed and the panel re-clamped; an `absolute` strategy is the CSS, not a second coordinate system (also 1.45.0: `absolute` was placed outside its boundary). |
| `allowOverflow` allows overflow left, right and down, not up | [zag#3164](https://github.com/chakra-ui/zag/issues/3164) (read), closed 2026-06 | An asymmetry in `getBoundaryRect` | No `allowOverflow`. A single rule: the header always keeps at least `minVisible` pixels (default 48) inside the boundary on **every** side, so the panel is never unreachable. |
| Focusing a panel does not bring it to the front; closing does not update `topmost` | [zag#3242](https://github.com/chakra-ui/zag/issues/3242) (read), [#3243](https://github.com/chakra-ui/zag/issues/3243) (title only), fixed 1.43.1 | The stack changed but z-order was applied to the wrong element | The layer stack owns order; `--rind-layer-index` is applied to the Positioner; a focus-in or press on a panel raises it; closing releases it. |
| Escape during drag or resize does not restore (other frameworks) | [zag#3027](https://github.com/chakra-ui/zag/issues/3027) (read), fixed 1.37.0; earlier fix in 1.36.0 | Framework-specific timing | Escape during a drag is `DRAG.CANCEL`: the rect before the press is restored; it does not close the panel. Tested through the machine, so all frameworks share it. |
| Escape does not close when focus is on a child (an input) | zag 1.38.0 changelog | The key handler was on the Content only | The layer stack routes Escape to the topmost layer from the document; a child focus does not matter, and a child's own Escape handling (`defaultPrevented`) wins. |
| "Maximum update depth exceeded" when content has `ResizeObserver`s | [zag#3005](https://github.com/chakra-ui/zag/issues/3005) (read), fixed 1.36.0 | `sync: true` on the size and position state during a drag | Per-move position and size go through **CSS variables** written through the CSSOM (`dom/swipe.ts` pattern, base-ui#4863); the machine gets `DRAG.START` and `DRAG.END { rect }`. |
| Maximise / minimise restore goes to (0, 0) in controlled mode; `setPosition` / `setSize` tied to drag state | zag 1.36.0 changelog | Restore data derived from controlled props | The rect to restore is machine context saved at the moment of the stage change; controlled props only set the current rect. |
| Minimise button shown while minimised | [zag#2919](https://github.com/chakra-ui/zag/issues/2919) (title and template only), closed 2026-01 | Not established | One `StageTrigger` per action that **toggles** (minimise ↔ restore, maximise ↔ restore) and is named by state; never hidden (timer.md). |
| Double-click on the title bar while minimised maximises instead of restoring | zag 1.33.0 changelog | Header handler ignored the stage | Header double-click is maximise ↔ restore; from minimised it restores. |
| `resizable={false}` still resizes; `draggable={false}` ignored | [zag#2860](https://github.com/chakra-ui/zag/issues/2860) (read), fixed 1.29.1 | The flag was not read by the handlers | `canMove` / `canResize` are computed once and read by every handler and by the parts' `data-disabled`. |
| `dir` not delegated to parts | [zag#2873](https://github.com/chakra-ui/zag/issues/2873) (title only), fixed 1.30.0 | Prop not connected | `dir` is applied by the shared helper; keys swap in RTL for the horizontal arrows. |
| Clicking the trigger while open does not close | zag 1.10.0 changelog | Trigger always sent OPEN | Trigger toggles (as Dialog's). |
| Resize trigger on the `n` axis not at `top: 0` | zag 1.29.1 changelog | CSS | The axis styles are the theme's (`data-axis`); the core ships none. |
| Lazy mount and unmount-on-exit never mount / unmount (Solid) | [ark#3935](https://github.com/chakra-ui/ark/issues/3935) (title only) | Adapter | Shared presence machine, adapter tests. |
| Touch: a button does not work on touch devices; dragging resumes after `disableDragging` while a touch is still down | [react-rnd#760](https://github.com/bokuweb/react-rnd/issues/760), [#880](https://github.com/bokuweb/react-rnd/issues/880), [react-draggable#550](https://github.com/react-grid-layout/react-draggable/issues/550) (titles only) | Not read | A drag starts only from `DragTrigger` and `ResizeTrigger`, which are not buttons; buttons in the header are excluded by role (Zag excludes `button` and `[data-no-drag]`). `touch-action: none` only on those parts. |
| Bounds: `parent` ignores the border; wrong when the window resizes; wrong under `scale` | [react-rnd#761](https://github.com/bokuweb/react-rnd/issues/761), [#714](https://github.com/bokuweb/react-rnd/issues/714), [#700](https://github.com/bokuweb/react-rnd/issues/700), [#959](https://github.com/bokuweb/react-rnd/issues/959) (titles only); [react-draggable#639](https://github.com/react-grid-layout/react-draggable/issues/639) (parent with `overflow-x`, title only) | Not read | The boundary is measured from the **content box** of the boundary element on every use; a `ResizeObserver` re-clamps on boundary and window resize; `css-zoom.ts` corrects pointer deltas under CSS zoom; a CSS `transform: scale` ancestor is a documented limit. |
| Initial and programmable bounds requested | [react-rnd#388](https://github.com/bokuweb/react-rnd/issues/388), [#724](https://github.com/bokuweb/react-rnd/issues/724) (titles only) | Not read | `boundary` accepts an element getter or `"viewport"` / `"parent"`. |

## Accessibility decisions

- **Content**: `role="dialog"`, `aria-labelledby` the Title (a dev warning without a title or an
  `aria-label`), no `aria-modal`. `tabindex="-1"` (focus target, not a tab stop).
- **Focus**: on open, focus goes to the first tabbable inside Body (or the Content), as the
  non-modal Dialog; Tab leaves the panel in DOM order through `trackNonModalTabOrder` (the panel
  follows its trigger, wherever it is rendered). Closing returns focus to the trigger, or to the
  element focused before opening, unless focus has already moved somewhere intentional
  (`focus-restore`). Raising on focus-in.
- **Escape**: closes the topmost panel when focus is inside it and the key was not handled; during a
  drag it cancels the drag instead. A panel never traps or captures Escape for the page behind.
- **Keyboard move and resize**: `DragTrigger` is a focusable element (`tabindex="0"`,
  `role="button"`, named "Move panel" from messages, `aria-describedby` a hidden hint "Arrow keys
  move, Alt plus arrow keys resize"). Arrow keys move by `step` (default 10 px; Shift: 50 px);
  Alt+Arrow resizes from the south-east corner by the same steps; Home / End are not used;
  Enter or Space on it toggles maximise (the keyboard twin of header double-click).
  The eight `ResizeTrigger`s are pointer handles: `aria-hidden`, not focusable. This is the same
  split as Splitter (one focusable thing with keys, decorative hit areas).
- **Stage triggers**: buttons named by what they will do ("Minimise", "Maximise", "Restore"), so no
  `aria-pressed`; `data-stage` carries the state. A maximised panel fills the boundary.
- **Minimised**: only the header remains, and Body is `inert` (hidden from AT and tab order);
  focus on a Body element when the panel minimises moves to the DragTrigger.
- **Announcements**: none by default. A position change by keyboard is visible and has no spoken
  equivalent in any library; screen-reader users operating a floating window by keys are rare, and
  the panel is also operable by the stage triggers alone.
- **Reduced motion**: minimise and maximise transitions follow `prefers-reduced-motion` (theme).
- **Reflow**: `maxSize` defaults to the boundary; at narrow widths the theme maximises by default
  (`@container`/media rule on the theme side).
- **Forced colors**: the header and the edges keep a border.

## Decisions for `add-floating-panel`

1. **Parts**: `Root`, `Trigger`, `Portal`, `Positioner` (the positioned wrapper), `Content`,
   `Header`, `DragTrigger`, `Title`, `Description`, `Control` (group), `StageTrigger` (`stage`),
   `CloseTrigger`, `Body`, `ResizeTrigger` (`axis`). Only `Root`, `Positioner`, `Content` and `Title` are
   required. Naming follows Ark (dialog.md: Reado migrates from Ark).
2. **Machine**: two layers. Open/close is the Dialog machine's graph with non-modal defaults
   (`modal: false`, `closeOnInteractOutside: false`, reasons `TRIGGER_PRESS`, `CLOSE_TRIGGER_PRESS`,
   `ESCAPE_KEY`, `OPEN`, `CLOSE`), composed, not copied; a rect machine runs inside `open` with
   states `idle | moving | resizing`. Events: `DRAG.START { mode, axis }`, `DRAG.END { rect }`,
   `DRAG.CANCEL`, `MOVE.STEP { dx, dy, large }`, `RESIZE.STEP { dx, dy, large }`,
   `STAGE { stage }`, `RAISE`, `BOUNDARY.CHANGED`, `RECT.SYNCED` (controlled props). Per-move
   position goes only through CSS variables; the machine sees start and end.
3. **Props**: `open` / `defaultOpen` / `onOpenChange({ open, reason })`; `position` /
   `defaultPosition` / `onPositionChange({ position, reason })` (once per interaction, per keyboard
   step); `size` / `defaultSize` / `onSizeChange`; `stage` / `defaultStage` / `onStageChange`;
   `minSize`, `maxSize`; `draggable`, `resizable`; `boundary` (`"viewport" | "parent" | () => Element`);
   `minVisible` (48); `step`, `largeStep`; `lockAspectRatio`; `initialFocus`, `finalFocus`; `disabled`;
   `messages`; `dir`. A `defaultPosition` of `"center"` or an anchor to the trigger is computed
   on open from the boundary.
4. **Rect**: stored relative to the boundary's content box, clamped on every change; `translate`
   (not `top/left`) with `--rind-floating-panel-x/y` and `--rind-floating-panel-width/height`
   on the Positioner. Maximised is `inset: 0` of the boundary by `data-stage`, not by inline sizes.
5. **Reuse**: `trackPointer` for move and resize (capture, `pointercancel`, lost capture, hidden
   document); the layer stack for order, Escape and "inside a higher overlay" (a new
   `kind: "window"`, non-modal); `trackNonModalTabOrder`; `focus-restore`; presence; portal;
   `css-zoom.ts`; the `swipe.ts` CSSOM variable pattern. No new `dom/` module other than a
   `dom/rect-bounds.ts` (clamp and `minVisible` rules, observed boundary).
6. **`data-*`**: `data-scope="floating-panel"`, `data-part`, `data-state="open|closed"`,
   `data-stage="default|minimized|maximized"`, `data-dragging`, `data-resizing`, `data-topmost`,
   `data-behind`, `data-axis` (ResizeTrigger), `data-disabled`.
7. **Contract**: locate by the Title's text or the panel's name. Actions `open`, `close`,
   `drag(dx, dy)` (pointer, with `moveBy` as the keyboard twin), `resize(axis, dx, dy)` (and
   `resizeBy` by keys), `minimize`, `maximize`, `restore`, `raise`, `cancelDrag`; queries
   `isOpen`, `position`, `size`, `stage`, `isTopmost`, `isDragging`.
8. **Deliberately different from Zag, and why**: no per-move machine events; Escape restores a
   drag, never closes it; no hidden stage triggers (toggling, named by action); `minVisible`
   instead of `allowOverflow`; keyboard resize (Zag has none); localised close name (Zag
   hard-codes "Close Window"); rect restore data owned by the machine; the dialog graph is shared.
9. **Non-goals**: docking and tiling, snap-to-edge layouts, tabs inside panels, a window manager
   (taskbar, minimise-to-dock), persistence to storage (`onPositionChange` is the hook), a modal mode
   (that is Dialog), multi-monitor (`window.open`) panels, `lockAspectRatio` in v1.

## Open questions

- **Top layer**: should the panel use `popover="manual"` so it stays above a modal Dialog and
  `position: fixed` stacking contexts? It would also change focus and `inert` interplay with modal
  dialogs. Test before choosing; the layer stack gives order either way.
- **Keyboard resize keys**: Alt+Arrow is a choice, not a standard; it conflicts with browser or OS
  shortcuts (Alt+Left is Back in some browsers). Check Chrome, Firefox, Safari and screen readers
  (JAWS and NVDA pass Alt combinations through only in application mode); the alternative is a
  separate focusable resize handle per corner or a "resize mode" toggled with Enter.
- **`DragTrigger` as a button with arrow keys**: it is not an APG pattern. Screen readers announce
  "button"; the hidden hint is the only description. Consider `role="slider"`-less
  alternatives after an AT test.
- **Scale and zoom**: `css-zoom.ts` handles the CSS `zoom` property; an ancestor with
  `transform: scale` makes pointer deltas wrong (react-rnd#959). Document as unsupported, or
  measure the scale from the element's rect over `offsetWidth`.
- **Live updates during drag** (`onPositionChange` per frame, as Zag): a chart that follows the
  panel needs them. Provide a throttled `onPositionDrag`, or leave the CSS variables for CSS-only
  consumers?
