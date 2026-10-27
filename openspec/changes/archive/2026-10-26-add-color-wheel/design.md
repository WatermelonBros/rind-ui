## Context

Research: [docs/research/color-wheel.md](../../../docs/research/color-wheel.md) ("Decisions").

## Decisions

### 1. Binding, not a machine

The parts run `angleSliderMachine` with `value` = the colour's hue (snapped to `step`) and
`wrap` true. `onValueChange(hue)` maps back with `colorWithChannel` + `withChannel(…, "hue",
hue)` in the working space (`colorSpace`: `hsl` default, or `hsb`), keeping the colour's memory
(a grey keeps the hue it was given). Commit, cancel and keys are the Angle Slider's.

### 2. Ring hit test

`pointerRadius(surface, p)` returns the distance from the centre over the outer radius (0 to 1+).
A press is accepted when it is between `1 - thickness / outerRadius` and 1, where `thickness`
is the Track's computed `--rind-color-wheel-thickness` (default 30px); a press elsewhere does
nothing. A drag, once started, follows the angle wherever the pointer goes.

### 3. Accessibility

One native range input (`role="slider"`), named by the Label or `aria-label` (default
"Hue"), `aria-valuetext` from Color Slider's messages ("Hue 240°, blue"). Root is a `group`.

### 4. Attributes and styles

`data-scope="color-wheel"`, `data-part`, `data-instance`, `data-dragging`, `data-disabled`,
`data-readonly`, `data-invalid`, `data-space`; focus attributes on the Thumb and Input. Track:
`--rind-color-wheel-gradient` (a `conic-gradient` of hues) and `forced-color-adjust: none`;
Root: `--rind-color-wheel-angle` (deg) and `--rind-color-wheel-thumb-color`.

### 5. Form

The Input submits the colour as a string (`formatColor(color, "hex")` by default) through a
hidden input carrying `name`; the range input itself has no name.

### 6. Contract

Locate by the Label or the only one. Actions `setHue(deg)` (a press on the ring), `step`,
`toEdge`; queries `hue`, `value` (hex), `valueText`, `isDragging`.
