## 0. Prerequisites

- [x] 0.1 Confirm `add-slider` (Slider, `pointer-drag`, `step-math`, accessible native input), `add-popover`, `add-number-input` (with `number-parsing` `unit`/`percent`), `add-checkbox` (`hidden-form-input`), `add-field`/`add-text-field` (`field-control`, Root-as-Field helper) and `add-theme-system` are merged, and that the requests in design.md (2D `pointer-drag`, optional Slider `Control`, `field-control` embedded boundary, Number Input honouring it, family matrix rows) are applied or answered

## 1. Colour model (`color-model`)

- [x] 1.1 `shared/color/color.ts`, `parse.ts`, `format.ts`: the `Color` type, `ColorParseError`, hex (3/4/6/8, any case), `rgb()`/`hsl()` legacy and modern syntax, `hsb()`, `transparent`, hue mod 360 with 360 kept, formatting incl. alpha-in-hex and locale independence; Node tests incl. RA#7547, RA#6202, RA#6363, ZG#884
- [x] 1.2 `convert.ts`, `channels.ts`: `toSpace` with `ColorMemory`, `colorMemory`, `channelRange`, `getChannel`/`withChannel` for channels the space lacks (ZG#2389, ARK#1649, RA#4561), clamp, precision, decimal-safe stepping through `core/shared/step-math.ts`; property tests: round trip over a 4096-colour grid plus every grey and primary, hsl/hsb agreement, no-op identity
- [x] 1.3 `equal.ts`: `isEqualColor`, `isSameColor` (8-bit sRGB, alpha byte); tests across spaces
- [x] 1.4 `name.ts`, `messages.ts`: `describeColor` (private OKLCH conversion, thresholds, compound hues), `colorName`, typed `messages` with every hue key, transparency, channel and format names; tests for the thresholds, translated pseudo-locale, `colorName` override
- [x] 1.5 `gradient.ts`: `channelGradient` (hue 7 stops, lightness 3, others 2, alpha, directions), `areaGradient` per `(space, x, y)`; tests: stop colours equal the model, corner and mid-point colours within 4/255, no `NaN`, RTL direction (ZG#2666)
- [x] 1.6 `value.ts` (`colorValue`): string | Color normalisation, invalid string error, working vs emission space, Echo rule, no callback for an unchanged emitted colour, `details.space`, refused proposal; Node tests incl. ZG#2503 (fresh object per render), RA#9509 (hue at black), external set in the working space

## 2. Color Area

- [x] 2.1 `color-area.axes.ts` (pure): default axes per space, axis validation, fraction → channels with pointer resolution, thumb position, key steps; Node tests incl. RA#7553 (large area), kobalte#592 (one write)
- [x] 2.2 `color-area.machine.ts`: states `idle`/`dragging`, events per design §4, `colorValue`, commit actions, `trackDrag` effect (2D `pointer-drag`), form inputs service; Node tests: keys in every direction, RTL, press jump, thumb grab without jump, cancel/Escape revert (RA#2252), double tap (RA#2814), commit counts (RA#2247), AT adjust accepted/refused, reset without commit
- [x] 2.3 `color-area.connect.ts`, `color-area.messages.ts`: parts per spec, two inputs with names, roving tab stop between them, focus follows a cross-axis key, value text (first focus all channels, then the changed one; RA#4110), position variables, inline `forced-color-adjust`/`touch-action`, `data-*`
- [x] 2.4 React parts `ColorArea.Root`, `Background`, `Thumb` (`render` on all); tests: SSR + hydration, attributes forwarded (REKA#2545), no extra tab stop

## 3. Color Swatch

- [x] 3.1 `color-swatch.connect.ts`, contract, React part: `role=img`, name from the colour name or `colorName`, `transparent`, `respectAlpha`, `data-transparent`, variables, `TransparencyGrid`; tests incl. children (RA#7262)

## 4. Color Slider

- [x] 4.1 `color-slider.machine.ts` (coordinator over the Slider service), `color-slider.connect.ts` (Slider connect + gradient `backgroundImage`, thumb `--rind-color`, `data-channel`, `data-space`, value text through `messages.valueText`); Node tests: channel the value lacks, hue 360 at the edge, hue at black, alpha keeps the colour, vertical (ZG#3010), RTL (ZG#2666), PageUp steps
- [x] 4.2 React parts `ColorSlider.Root`, `Label`, `ValueText`, `Control` (optional), `Track`, `Thumb`, `Description`, `TransparencyGrid`; tests: unlabelled slider named by channel (Reado), Escape in a Popover, commit once

## 5. Color Field and Channel Field

- [x] 5.1 `color-field.machine.ts` + pure helpers (`acceptHexText`, `commitHex`, `parseLenient`): draft, commit points, invalid state, Escape on a dirty draft, `flush`, controlled text, alpha handling; Node tests incl. RA#5484, RA#10445, RA#7547, RA#3985 (resulting-text filter), RA#6363, ZG#884
- [x] 5.2 `color-field.connect.ts`: Input attributes (`spellcheck=false`, `autocomplete=off`, no `maxlength`), hidden input (`hidden-form-input`, canonical hex, validity element), Field host; React parts; tests: Android composition (browser), paste, form submit, required focus
- [x] 5.3 `color-channel-field.connect.ts`: props mapping onto Number Input (`min`, `max`, `step`, `formatOptions` degree/percent/integer, `commitBehavior: "snap"`, commit → `withChannel`, empty restores); React `ColorChannelField`; tests incl. ZG#1567 (every channel clamps), kobalte#589 (alpha percent), channel the value lacks

## 6. Color Swatch Picker

- [x] 6.1 `matchSwatch` (pure: last key, first match, none) and `color-swatch-picker.connect.ts` (coordinator over the Radio Group; names from colour names; `Indicator`; variables); Node tests incl. RA#7918, RA#10251, match across spaces
- [x] 6.2 React parts `ColorSwatchPicker.Root`, `Item`, `Swatch`, `Indicator`; tests: nested input check, one tab stop, disabled item, form value

## 7. Color Picker

- [x] 7.1 `core/dom/eye-dropper.ts` (`isSupported`, `pick`, abort handling) with a fake for tests; tests: supported, unsupported, abort, result opaque (ZG#2782)
- [x] 7.2 `flush-registry.ts` and `color-picker.machine.ts`: states `closed`/`open`/`inline`, one commit path, `colorValue` + `format` + `open` controllables, Popover child wiring (`scope: "color-picker"`), `closeOnSelect`, flush before close, eye-dropper effect, reset/adopt; Node tests incl. Dialog repeat dismissal (ZG#3043, ZG#3067), drag released outside (RA#3994), flush (RA#9748), emptied input (RA#6363), format change without emission, Echo with fresh objects (Reado)
- [x] 7.3 `color-picker.connect.ts`, `color-picker.messages.ts`: Control/Trigger/Content naming, hidden input, Root/Content variables, `View`, `FormatSelect`/`FormatTrigger`, `ValueText`/`ValueSwatch`, inline-mode output, `data-*`
- [x] 7.4 React parts (all anatomy parts; bound children read the picker context; `ChannelInput` chooses Color Field or Channel Field; `FlushRegistry` provider; `FieldControlBoundary` around Content); tests: SSR + hydration incl. hidden EyeDropperTrigger and `View`, `render` on every part (ARK#1922), Reado's anatomy

## 8. Contracts and drivers

- [x] 8.1 Contracts and drivers `getColorArea`, `getColorSlider` (extends `getSlider`), `getColorSwatch`, `getColorField`/`getColorChannelField`, `getColorSwatchPicker` (extends `getRadioGroup`), `getColorPicker` (children drivers scoped, fake `EyeDropper` injection); "needs layout" failure for pointer actions
- [x] 8.2 Invariants `colorAreaInvariants`, `colorSliderInvariants`, `colorFieldInvariants`, `colorPickerInvariants` per spec; broken-wrapper fixtures prove each fails (extra tab stop, second bound Area with its own value, NaN style, stale hidden input, idle listener in inline mode)
- [x] 8.3 The same driver tests pass in `browser`, `jsdom` and Playwright for each driver

## 9. Model-based tests

- [x] 9.1 `testMachine` for each contract with the configurations of design §9, the colour model as oracle; pointer and touch in browser mode, keyboard and virtual in both, `dir="rtl"` runs
- [x] 9.2 Scenario tests outside the model: picker in a Dialog (open → dismiss → open → click inside, ZG#3043/ARK#3414), slider drag released outside a Popover (RA#3994), Escape layering with a dirty hex input, controlled fresh-object echo through a hue drag to 360 and to black (ZG#2503, RA#9509), eye dropper unsupported (ARK#2764), inline picker installs nothing while idle, picker in a Field and form with reset

## 10. Theme

- [x] 10.1 `color-checker.css` (shared `--rind-color-checker-*`), `color-area.css`, `color-slider.css`, `color-swatch.css`, `color-field.css`, `color-swatch-picker.css`, `color-picker.css` per specs: `@layer rind.components`, `:where()` selectors, `--rind-color-*` tokens read with fallbacks and never declared, families `range`/`field`/`panel`/`decoration`, `data-variant`/`data-size`, `data-tone="danger"`, thumb double rings, hit areas ≥ 24 px, forced-colors rules (`forced-color-adjust: none` on colour surfaces), RTL, vertical, no transitions while dragging; imported from `index.css`
- [x] 10.2 Playwright captures: forced colors (RA#2949), RTL, vertical slider, alpha checkerboard, themed popover content, reduced motion

## 11. Site examples

- [x] 11.1 Site examples (`apps/site/examples/color-*.tsx`, per `openspec/changes/retire-storybook`: every zero-prop export is an example, state examples for contract states, hidden fixtures): Color Area (hsb, hsl, rgb, hue axis, RTL, read-only, in a form), Color Slider (hue, alpha with checkerboard, vertical, labelled/unlabelled), Color Swatch (opaque, transparent, children), Color Field (hex, alpha, css, invalid, in a form), Color Channel Field, Color Swatch Picker (matching, no match, duplicate keys), Color Picker (popover, modal, inline controlled like Reado, with swatches and `closeOnSelect`, format select and `View`, eye dropper, in a Dialog, in a Field and form, translated messages), driver example; state examples with ARIA snapshots; axe clean

## 12. Docs

- [x] 12.1 Docs pages (generated API facts) for each component plus a "Colour model" page: spaces and channels, parsing and formatting, Echo rule, hue memory, names and translating them, `format` vs emission space, keyboard tables, commit semantics, form behaviour, inline mode, Reado migration recipe, known AT notes (iOS VoiceOver steps), driver examples, `llms.txt` entry

## 13. Proof

- [x] 13.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
