## Why

The colour work shipped six components: Color Area, Color Slider, Color Swatch, Color Field (with Color Channel Field),
Color Swatch Picker and Color Picker. The user decided there is one component, Color Picker, and the others are its parts,
customisable but not components of their own. A standalone Color Swatch on the site "does nothing", which shows it was
never a component. Separately, a checked swatch showed a dot and a check mark, the check off-centre.

## What Changes

- **BREAKING (unreleased)**: `@rind-ui/react` no longer exports `ColorArea`, `ColorSlider`, `ColorSwatch`, `ColorField`,
  `ColorChannelField` or `ColorSwatchPicker`; `@rind-ui/testing` no longer exports their drivers. They remain the internals of
  `ColorPicker`'s parts. `ColorPicker` gains named prop types for its parts, and `getColorPicker` gains `swatch(name)`.
- One docs page (`color-picker.md`) with a Parts section; the five part pages are deleted. One inventory row.
- Site examples: Color Picker only, with the parts' examples as inline pickers (area axes, channel sliders, swatches,
  field only, invalid entry, channel fields), and their state examples and ARIA snapshots.
- A checked swatch shows one centred mark: an empty `SwatchIndicator` is a ringed dot, a glyph replaces it (theme and site
  skin), with a browser test.

## Capabilities

### Modified Capabilities

- `color-picker`: the only colour component; one selected swatch mark; part drivers.
- `color-area`, `color-slider`, `color-field`, `color-swatch`, `color-swatch-picker`: each is a Color Picker part, not
  exported on its own.

## Impact

`packages/react/src/index.ts`, `packages/react/src/color-picker/*`, the part modules' barrels (deleted),
`packages/testing/src/index.ts`, `packages/testing/src/components/color-*`, theme and site skin swatch-picker rules,
`apps/site/examples/color-*`, `docs/components/color-*.md`, `docs/components.md`, the ARIA snapshots.
