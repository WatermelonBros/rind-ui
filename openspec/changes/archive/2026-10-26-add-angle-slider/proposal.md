## Why

A circular control that picks an angle (a gradient direction, a rotation, a wind heading). Zag/Ark
and Mantine ship one; both announce a range they cannot reach (Zag: 360 announced, 359 used),
step down on ArrowUp (Zag), snap up instead of to the nearest step, and track mouse and touch
separately (Mantine). rind-ui has the drag lifecycle, step math and range-input pattern (Slider,
Color Area) to do it with a native `input[type=range]`.

Research: [angle-slider](../../../docs/research/angle-slider.md) ·
[slider](../../../docs/research/slider.md)

Depends on: `add-slider` (step math, pointer-drag), `add-color-area` (STEP / EDGE / INPUT.CHANGE),
`add-theme-system`.

## What Changes

- A public **Angle Slider** in `@rind-ui/core` and every framework package: parts `Root`,
  `Label`, `Control`, `Thumb`, `Input` (a native range input), `Value`, `MarkerGroup`, `Marker`.
- A value in `[0, 360)`, snapped to the nearest `step`, wrapping at the ends (`wrap`, default on);
  the angle of a press around the Control's centre; one drag lifecycle with cancel.
- New `dom/pointer-angle.ts` (shared with the Color Wheel).
- `getAngleSlider` driver, `angle-slider.css`, site example, docs page.

## Capabilities

### New Capabilities

- `angle-slider`: anatomy, value space, pointer, keyboard, form, data attributes, messages,
  contract, theme.

### Modified Capabilities

None.

## Non-goals

- Partial arcs, counter-clockwise or non-top origins (rotate with CSS), multiple thumbs.

## Impact

- New: `packages/core/src/components/angle-slider/`, `packages/core/src/dom/pointer-angle.ts`,
  framework parts, driver, theme file, site example and skin, `docs/components/angle-slider.md`.
- Modified: `families.ts` (`angle-slider` in `field`).
