## Context

See proposal.md and [docs/research/splitter.md](../../../docs/research/splitter.md)
(binding decisions). Reused infrastructure:

| From | Used for |
|---|---|
| `add-slider` | `pointer-drag` (`pointerDragSession`, `isDragPress`): capture, document listeners while active, cancel on `pointercancel` / lost capture / hidden document, `buttons === 0` release over an iframe, RTL-aware fractions |
| `add-a11y-foundations` | key description, focus attributes, modality, `focusSafely` |
| `add-foundations` | machine runtime (controllable values, `onProps`), contracts, drivers, `testMachine` |

## Goals / Non-Goals

**Goals:** a two-state machine whose transitions run in Node on percentages; no new
`core/dom` module.

**Non-Goals:** see proposal.

## Decisions

### 1. Units: percent in the machine, pixels at the boundary

The machine sees sizes and constraints as percentages of the panels' space (the group's
content box minus the handles). The Root resolves constraints: a number is a percent; a
`"Npx"` string is converted with the space measured by a ResizeObserver, re-resolved on
every resize (RRP#720); without a measurement (server, hidden container) a pixel
constraint is skipped, never divided by zero (RRP#536). Callbacks report percent only
(reka#2481).

### 2. Machine

```
idle ──POINTER.DOWN [canResize(handle)]──► dragging   (start ← sizes, handle ← index)
dragging ──POINTER.MOVE { delta }──► dragging          (sizes ← resize(start, handle, delta))
dragging ──POINTER.UP──► idle                          (commit when sizes ≠ start)
dragging ──DRAG.CANCEL──► idle                         (sizes ← start, no commit)
idle ──STEP / TO_EDGE / TOGGLE [canResize(handle)]──► idle (resize, commit)
any ──LAYOUT.SYNCED──► (re-validate sizes against the new constraints)
```

- Controllable `sizes` (`defaultSizes`, `onSizesChange`); `onSizesCommit(sizes,
  { reason })`. `onProps`: `panels` → `LAYOUT.SYNCED` (content equality), `disabled` →
  `DRAG.CANCEL`.
- Context: `start`, `handle` (dragged), `focused` (handle with DOM focus), `expanded`
  (each collapsible panel's size before it collapsed).
- No hover or focus states: keys are guarded by props only (zag#3223), hover is CSS.
- `resolveSizes(props, value)`: the value if it has one entry per panel, else
  `defaultSizes`, else an equal split; scaled to 100 and clamped (RRP `validateLayout`).

### 3. Resize algorithm (`splitter.math.ts`)

A port of react-resizable-panels' `adjustLayoutByDelta` (MIT, attributed in the file):
the delta (positive grows the panel before the handle) is clamped by the room on the
growing side, panels on the shrinking side shrink outward from the handle (each clamped;
a collapsible panel snaps to `collapsedSize` below the halfway point between it and
`min`), the panel next to the handle on the growing side grows by what was taken, any
remainder goes further out, and a step whose total is no longer 100 is rejected.
One deviation: a collapsed panel on the growing side that passes the halfway point snaps
open to `min` (the delta takes the difference from the shrinking side), where RRP rejects
the step until the pointer reaches `min` (spec "Collapse": symmetric snap).
Keyboard steps collapse a panel sitting at `min` and expand a collapsed one to `min`
whatever the step. Home / End are deltas of ∓100. Bounds for ARIA are the results of
those two deltas, so they are exact for any number of panels (RRP#740).

### 4. Connect

- Root: `display: flex`, `flex-direction` from the orientation, `dir`, `data-orientation`,
  `data-dragging`, `data-disabled`.
- Panel: `flex: <size> 1 0px` (sizes as flex-grow: the handles never break the total, and
  the server renders the same style, RRP#692, #714), `min-width`/`min-height: 0`,
  `data-size`, `data-state` for collapsible panels, generated `id`.
- Handle: `role="separator"`, `tabindex=0` (none when disabled), `aria-orientation`
  perpendicular to the panel axis, `aria-valuenow/min/max` rounded, `aria-controls` the
  primary panel, `aria-disabled`, `touch-action: none`, `user-select: none`, focus
  attributes, `data-dragging` on the dragged handle.
- Keys: the handle's axis only (Left/Right for a horizontal group, Up/Down for a vertical
  one); ArrowRight / ArrowDown move the boundary right / down; in RTL ArrowLeft moves it
  left, which grows the primary pane (it is on the right). No modifiers (Alt, Ctrl, Meta
  belong to the browser). Escape cancels a drag only.

### 5. Parts

`Splitter.Root`, `Splitter.Panel index`, `Splitter.Handle index` (the boundary after panel
`index`). The Root measures the panels' space (ResizeObserver) for pixel constraints and
the pointer scale; the Handle's `pointerdown` presses the shared `pointerDragSession` on
the Root, focuses itself without a ring (Safari does not focus on press) and sends
`POINTER.DOWN`; the drag capability converts each fraction to a percent delta (sign per
orientation; RTL comes from pointer-drag).

### 6. Contract

Locate by the handle (`separator` + name). Actions `step`, `toEdge`, `toggleCollapse`,
`setSize` (keyboard steps or a drag), `pointerDown`, `pointerMove` (to a percent delta
from the press), `pointerUp`, `cancelDrag`. Queries `sizes` (each panel's `data-size`),
`isDragging`, `orientation`. Traits `valued` (each handle's rounded primary size) and
`directional`. Invariants: sizes sum to 100; each handle's value within its bounds;
`aria-controls` names a rendered panel.

## Risks / Trade-offs

- Index props on Panel and Handle (as Slider's Thumb) are less ergonomic than
  registration; they are what makes the server render exact.
- A controlled parent that refuses a proposal still receives `onSizesCommit` with the
  proposal; the Slider's pending mechanism can be added when a consumer needs it.
