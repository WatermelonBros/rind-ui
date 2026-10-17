## 1. API

- [x] 1.1 Remove the standalone colour exports from `@rind-ui/react` (and the part modules' barrels); add `ColorPickerAreaProps`, `ColorPickerChannelSliderProps`, `ColorPickerSwatchGroupProps`, `ColorPickerSwatchTriggerProps`, `ColorPickerSwatchProps`
- [x] 1.2 Remove the standalone drivers from `@rind-ui/testing`; `getColorPicker` gains `swatch(name)`; part tests import through `components/color-parts.ts` (React's workspace-only `color-internals` entry)

## 2. One selected mark

- [x] 2.1 `SwatchIndicator` carries the `data-color-swatch-picker` hook; theme and site skin draw one centred mark (dot when empty, the content otherwise)
- [x] 2.2 Browser test in three engines: one visible mark, centred within 1 px, theme and site skin, dot and glyph; the site examples drop the "✓"

## 3. Docs, site, inventory

- [x] 3.1 One `docs/components/color-picker.md` with a Parts section; delete the five part pages; the colour-model guide points to the picker
- [x] 3.2 Site examples: Color Picker only, the parts' examples as inline pickers, state examples for `color-area` and `color-field`, ARIA snapshots migrated
- [x] 3.3 `docs/components.md`: the colour rows merged into Color Picker (Color Wheel kept)

## 4. Proof

- [x] 4.1 Colour tests (node, jsdom, Chromium; Firefox and WebKit for the browser tests; the Playwright fixture), lint, docs check, typecheck; changeset
