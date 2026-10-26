## Context

Research: [docs/research/floating-panel.md](../../../docs/research/floating-panel.md)
("Accessibility decisions", "Decisions").

## Decisions

### 1. Two machines, composed by the parts

Open/close: `dialogMachine` with `modal: false` and `closeOnInteractOutside: false` (its reasons,
layer, Escape and focus rules). Rect: `floatingPanelMachine`, states `idle | moving | resizing`,
running while open. A drag sends `DRAG.START { mode, axis }` and `DRAG.END { dx, dy }` (or
`DRAG.CANCEL`); the parts write each move to the Positioner's CSS variables only.

### 2. Rect

`position` / `defaultPosition` / `onPositionChange(position, { reason })`, `size` /
`defaultSize` / `onSizeChange`, `stage` / `defaultStage` / `onStageChange` (`default |
minimized | maximized`). Reasons: `drag`, `resize`, `keyboard`, `boundary`, `api`. The rect is in
the boundary's content-box coordinates. `BOUNDARY { width, height }` (from a ResizeObserver)
re-clamps.

### 3. Clamp (`dom/rect-bounds.ts`)

Size between `minSize` (default 200×120) and `maxSize` (default the boundary). Position keeps at
least `minVisible` (default 48) px of the panel inside the boundary on each axis, and the top
edge (the header) never above 0. Resizing from a west or north edge keeps the opposite edge
fixed.

### 4. Keyboard

The DragTrigger is a `button` named "Move panel", described by a hint. Arrows move by `step`
(10 px; Shift: `largeStep`, 50); Alt+Arrow resizes from the south-east corner; Enter or Space
toggles maximised; Escape during a drag cancels it. ResizeTriggers are `aria-hidden` pointer
handles, not focusable.

### 5. Stages

`STAGE { stage }`: minimised keeps only the header (Body `inert` and hidden), maximised fills the
boundary (`data-stage`, not inline sizes); restoring brings back the previous rect. Stage
triggers are buttons named by what they will do ("Minimise", "Maximise", "Restore").

### 6. Attributes

`data-scope="floating-panel"`, `data-part`, `data-instance`, `data-state` (`open|closed`),
`data-stage`, `data-dragging`, `data-resizing`, `data-disabled`; ResizeTrigger `data-axis`;
StageTrigger `data-stage-target`. Positioner variables `--rind-floating-panel-x`, `-y`,
`-width`, `-height` (px).

### 7. Contract

Locate by the Title's text (the dialog's name). Actions `open`, `close`, `moveBy(dx, dy)` (keys
on the DragTrigger, pointer drag of the DragTrigger), `resizeBy(dx, dy)`, `minimize`,
`maximize`, `restore`; queries `isOpen`, `position`, `size`, `stage`, `isDragging`.
