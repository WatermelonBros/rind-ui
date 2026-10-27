## Context

Research: [docs/research/angle-slider.md](../../../docs/research/angle-slider.md) ("Decisions").

## Decisions

### 1. Value space

Degrees in `[0, 360)`. The input's range is `0` to `gridMax(0, 360, step)` when 360 is not a
multiple of `step`, else `360 - step`; the announced max is the reachable one. A value is
normalised (`((v % 360) + 360) % 360`) and snapped to the nearest step (360 snaps to 0).

### 2. Machine

States `idle | dragging`. Controllable `value` (number). Events `POINTER.DOWN { angle | null,
onThumb }`, `POINTER.MOVE { angle }`, `POINTER.UP`, `DRAG.CANCEL`, `STEP { steps, page }`,
`EDGE { edge }`, `INPUT.CHANGE { value }`, `RESET`. A press off the thumb sets the angle at once;
on the thumb it keeps the value and drags with the grab offset. `onValueCommit` once per
interaction (pointer up, a key, an input change). A cancel restores the value at the press.

### 3. Pointer

`dom/pointer-angle.ts`: the angle of a point around the centre of an element's border box,
clockwise from the top, in degrees; a press within 10% of the radius from the centre is ignored
for direction (null). Not mirrored in RTL (a compass does not mirror). Built on `trackPointer`.

### 4. Keyboard

On the Input: ArrowRight and ArrowUp add `step`, ArrowLeft and ArrowDown subtract it (not
mirrored: clockwise is clockwise); Shift or PageUp/PageDown use `largeStep` (15); Home is 0, End
the max. With `wrap` (default) a step past an end wraps; without it, it clamps. Escape cancels a
drag.

### 5. Accessibility

The Input is a native `input type="range"` labelled by the Label (or `aria-label`), with
`aria-valuetext` from `messages.valueText` ("90 degrees"). Thumb, Control and markers are
presentation. The Value is an `<output>` hidden from assistive technology (the input announces).

### 6. Attributes

Every part: `data-scope="angle-slider"`, `data-part`, `data-instance`, `data-dragging`,
`data-disabled`, `data-readonly`, `data-invalid`; Thumb: focus attributes; Marker:
`data-value`, `data-state` (`under-value | at-value | over-value`). Root CSS variables
`--rind-angle-slider-angle` (deg) and `--rind-angle-slider-fraction`.

### 7. Contract

Locate by the Label or the only one. Actions `setAngle(angle)`, `step(steps)`, `toEdge(edge)`;
queries `value`, `valueText`, `isDragging`.
