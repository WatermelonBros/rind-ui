## Why

Colour controls are the place where every library's value handling breaks: a colour that is
converted to hex and back loses its hue at grey, black and white (react-spectrum#9509,
zag#2503, and exactly what Reado's picker does by re-parsing sRGB on every render); a
`format` prop that is both the value space and the display, so channels throw outside it
(zag#1567, ark#1649, zag#2389); one gesture that fires `onChange` twice (kobalte#592,
react-spectrum#2247); typed hex that is lost when the popover closes (react-spectrum#9748,
#10445); an area that announces degrees instead of a colour (react-spectrum#4111); a picker in a
Dialog that closes once and then never (zag#3043, ark#3414); a dead eye-dropper button in
Firefox (ark#2764). Five libraries ship parts of it (Ark/Zag one machine, React Aria, Kobalte and
Reka as separate components on a shared model), and none ships the whole stack on a model that is
plain data, localisable and testable without a DOM. Reado's editor swatch popover uses Ark's
picker and will migrate.

Research: [color-picker](../../../docs/research/color-picker.md) ·
[slider](../../../docs/research/slider.md) · [popover](../../../docs/research/popover.md) ·
[number-input](../../../docs/research/number-input.md) ·
[radio-group](../../../docs/research/radio-group.md) ·
[accessibility](../../../docs/research/accessibility.md) §5, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4,
causes G, J, K · [native-platform](../../../docs/research/native-platform.md) §8

Depends on: `add-slider` (the Slider machine and parts for the channel slider, `pointer-drag`,
`core/shared/step-math.ts`, the accessible native input rule of `hidden-form-input`),
`add-popover` (`popover`, `non-modal-tab-order`, `scope`), `add-number-input` (channel inputs),
`add-radio-group` (archived: swatch picker), `add-checkbox` (`hidden-form-input`,
`control-label`), `add-field` / `add-text-field` (`field-control`, Root-as-Field),
`add-overlay-infrastructure` and `add-floating-positioning` (archived; used through Popover),
`add-theme-system`, and the archived `add-foundations` / `add-a11y-foundations` (machine
runtime, contracts, drivers, `testMachine`, press, modality, keys, announcer, `i18n-messages`).
Requests to `add-slider`, `add-number-input` and `field-control` are listed in design.md.

## What Changes

- **`color-model`** (shared, `@rind-ui/core`, framework-neutral): colour as plain immutable data in
  `rgb`, `hsl` or `hsb` with alpha; pure functions to parse, format, convert (with hue memory),
  read and write channels, compare, name (React Aria's OKLCH-based heuristic, localisable
  messages) and draw CSS gradients; the **controlled colour value** rule every component shares
  (accept `string | Color`, ignore an echo of the same sRGB colour).
- **Color Area**: a 2D channel picker with two native range inputs, one write per pointer move,
  2D keys, RTL, commit once per interaction. Parts `Root`, `Background`, `Thumb`.
- **Color Slider**: a Slider (reused, not re-specified) bound to one channel of a colour, with a
  gradient track, a thumb colour and value text carrying the colour name.
- **Color Swatch**: a named preview chip (`role="img"`), transparency-aware.
- **Color Field** and **Color Channel Field**: a hex/CSS text field (commit on Enter/blur, never
  while typing, alpha kept) and a numeric channel field built on Number Input.
- **Color Swatch Picker**: a palette on Radio Group; `null` when no swatch matches.
- **Color Picker**: Ark's anatomy (`Root`, `Label`, `Control`, `Trigger`, `Portal`, `Positioner`,
  `Content`, `Area*`, `ChannelSlider*`, `ChannelInput`, `EyeDropperTrigger`, `SwatchGroup`,
  `SwatchTrigger`, `SwatchIndicator`, `Swatch`, `ValueSwatch`, `FormatSelect`, `FormatTrigger`,
  `View`, `ValueText`, `HiddenInput`, `TransparencyGrid`) as one coordinator owning the colour,
  the display `format` and the open state, driving Popover and the bound children; an `inline`
  mode without layer or positioning (Reado); draft flush before close; an eye dropper that is
  hidden where unsupported.
- Contracts and drivers (`getColorArea`, `getColorSlider`, `getColorSwatchPicker`,
  `getColorField`, `getColorPicker`), colour invariants, model-based tests with the model as
  oracle, theme stylesheets (families `range`, `field`, `panel`), site examples, docs pages.

## Capabilities

### New Capabilities

- `color-model`: the colour data model, parsing, formatting, conversion, channels, equality,
  names, gradients and the controlled-value rule.
- `color-area`: the Color Area component.
- `color-slider`: the Color Slider component (a Slider bound to a channel).
- `color-swatch`: the Color Swatch component.
- `color-field`: the Color Field (text) and Color Channel Field (number).
- `color-swatch-picker`: the Color Swatch Picker component.
- `color-picker`: the Color Picker component and its composition rules.

### Modified Capabilities

None. Additions to other changes are listed in design.md under "Requests to other changes".

## Non-goals

- **Color Wheel** (React Aria, Kobalte): a polar pointer mapping and ring hit test; additive on this
  model and `pointer-drag` later (`components.md` keeps it `todo`).
- **OKLCH / Lab / Display-P3 spaces** (zag#2438, reka-ui#2798): the model's space list is open but
  out-of-gamut axes need a gamut policy nobody asked for here; OKLCH is used privately for names.
- **CSS named colours** (zag#1908) other than `transparent`, `color()` and `color-mix()` parsing.
- **Autoscroll while dragging** (react-spectrum#6299), a loupe under touch, momentum.
- **Native `<input type=color>`** as the visible control (no alpha, no area; native-platform §8).
- Steppers or wheel on the hex field (React Aria's spinbutton hex), colour history or palettes
  management, contrast-ratio readouts.
- Multiple triggers or detached triggers (Popover non-goal), modal sheets (`modal` passes through).
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/shared/color/` (`color-model`), `packages/core/src/components/{color-area,
  color-slider,color-swatch,color-field,color-swatch-picker,color-picker}/`, `packages/react/src/color-*/`,
  `getColor*` drivers in `@rind-ui/testing`, `packages/theme/src/color-*.css`, site examples
  (`apps/site/examples/color-*.tsx`), docs pages.
- `docs/components.md`: Color Area, Color Slider, Color Swatch, Color Field, Color Swatch Picker and
  Color Picker → `spec`.
- No new runtime dependency (the OKLCH conversion used for names is ~30 lines of the CSS Color 4 matrices).
- Reado: `ColorPickerPopover.tsx` migrates from Ark's `ColorPicker` (`inline`, `Content`, `ValueText`,
  `Area*`, two `ChannelSlider`s); `parseColor(rgba(...))` per render keeps working through the Echo rule.
