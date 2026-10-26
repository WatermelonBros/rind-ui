## Why

A hue ring: the colour picker shape people know from design tools. React Aria and Kobalte ship
one; both make the consumer pass the ring's radii as props (react-spectrum#1605), and both
announce the hue differently from their own colour slider. rind-ui already has the angle machine
(Angle Slider) and the colour binding (Color Slider): a Color Wheel is the two together.

Research: [color-wheel](../../../docs/research/color-wheel.md) ·
[angle-slider](../../../docs/research/angle-slider.md) · [color-picker](../../../docs/research/color-picker.md)

Depends on: `add-angle-slider`, `add-color-slider`, `add-theme-system`.

## What Changes

- A public **Color Wheel** in `@rind-ui/core` and every framework package: parts `Root`, `Label`,
  `Track` (the ring, the pointer surface), `Thumb`, `Input` (a native range input), `Value`.
- No machine of its own: the Angle Slider machine drives the hue; `colorWheelConnect` maps the
  colour to the hue and back with Color Slider's binding (space, memory, hue name, value text).
- A press counts only on the ring (between the inner and outer radius, the inner one read from
  `--rind-color-wheel-thickness`); a drag then follows the angle anywhere.
- `pointerRadius` in `dom/pointer-angle.ts`; `getColorWheel` driver; `color-wheel.css`; site
  example; docs page.

## Capabilities

### New Capabilities

- `color-wheel`: anatomy, binding, ring hit test, keyboard, form, data attributes, messages,
  contract, theme.

### Modified Capabilities

None.

## Non-goals

- Saturation and lightness inside the ring (Color Area), a triangle, alpha, hosting the wheel in
  Color Picker (a later change).

## Impact

- New: `packages/core/src/components/color-wheel/`, framework parts, driver, theme file, site
  example and skin, `docs/components/color-wheel.md`.
- Modified: `dom/pointer-angle.ts` (`pointerRadius`), `families.ts` (`color-wheel` in `field`).
